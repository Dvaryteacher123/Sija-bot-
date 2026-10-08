'use strict';

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const QRCode = require('qrcode');
const User = require('../database/models/User');
const forceJoin = require('./forceJoin');

const PAIRING_IMAGE = path.join(process.cwd(), 'public', 'images', 'menu.jpg');

const TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const POLL_TIMEOUT = 25;

if (!TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is missing in Panel environment variables.');
}

const API = `https://api.telegram.org/bot${TOKEN}`;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function tg(method, params = {}) {
  const { data } = await axios.post(`${API}/${method}`, params, {
    timeout: (POLL_TIMEOUT + 10) * 1000
  });
  if (!data.ok) throw new Error(data.description || `Telegram ${method} failed`);
  return data.result;
}

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatCode(code) {
  const raw = String(code || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return raw.match(/.{1,4}/g)?.join('-') || raw;
}

async function findOwner() {
  const username = String(process.env.OWNER_USERNAME || '').trim().toLowerCase();
  if (!username) throw new Error('OWNER_USERNAME is missing in Panel environment variables.');
  const user = await User.findOne({ username, isActive: true });
  if (!user) throw new Error(`Owner user "${username}" was not found in the local database.`);
  return user;
}

module.exports = async function startTelegramBot({ botManager }) {
  if (!botManager) throw new Error('BotManager is required for Telegram pairing.');

  const me = await tg('getMe');
  console.log(`[Telegram] Connected as @${me.username}`);

  let offset = 0;
  let stopped = false;

  // Remembers what a user was trying to do (pair/qr + phone) while they
  // go join the required groups, so tapping "I've joined" continues
  // automatically instead of making them retype the command.
  const pendingActions = new Map();

  /**
   * Force-join gate. Returns true if the user may proceed.
   * If not, sends the join prompt (with buttons) and returns false.
   */
  async function requireJoin(chatId, userId, pending) {
    if (!forceJoin.ENABLED) return true;

    const { ok, missing } = await forceJoin.checkMembership(tg, userId);

    if (ok) return true;

    if (pending) {
      pendingActions.set(userId, pending);
    }

    await tg('sendMessage', {
      chat_id: chatId,
      text: forceJoin.joinPromptText(),
      parse_mode: 'Markdown',
      reply_markup: forceJoin.buildJoinKeyboard(missing)
    });

    return false;
  }

  async function waitForPairingCode(sessionId, timeoutMs = 60000) {
    const started = Date.now();
    while (!stopped && Date.now() - started < timeoutMs) {
      const code = botManager.getPairingCode(sessionId);
      if (code) return code;
      await sleep(500);
    }
    throw new Error('WhatsApp did not provide a pairing code within 60 seconds. Please try /pair again.');
  }

  async function sendPairingCode(chatId, sessionId, code) {
    const caption =
      `🔐 *WHATSAPP PAIRING CODE*\n\n` +
      `Your pairing code is:\n\n` +
      `*${formatCode(code)}*\n\n` +
      `📱 *How to link your WhatsApp:*\n\n` +
      `1️⃣ Open *WhatsApp* on your phone.\n\n` +
      `2️⃣ Go to *Settings*.\n\n` +
      `3️⃣ Tap *Linked Devices*.\n\n` +
      `4️⃣ Tap *Link a Device*.\n\n` +
      `5️⃣ Select *Link with phone number instead*.\n\n` +
      `6️⃣ Enter the pairing code shown above.\n\n` +
      `⚠️ *Keep this code private.*\n\n` +
      `Do not share this code with anyone.\n\n` +
      `Session: \`${sessionId}\``;

    // Send the code together with the bot banner image. If the image is
    // missing or the photo upload fails for any reason, fall back to a
    // plain text message so pairing never breaks because of the image.
    try {
      if (fs.existsSync(PAIRING_IMAGE)) {
        const form = new FormData();
        form.append('chat_id', String(chatId));
        form.append('caption', caption);
        form.append('parse_mode', 'Markdown');
        form.append('photo', fs.createReadStream(PAIRING_IMAGE));

        const { data } = await axios.post(`${API}/sendPhoto`, form, {
          headers: form.getHeaders(),
          timeout: 30000
        });

        if (data.ok) return;
        throw new Error(data.description || 'sendPhoto failed');
      }
    } catch (err) {
      console.error('[Telegram] sendPhoto failed, falling back to text:', err.message);
    }

    await tg('sendMessage', {
      chat_id: chatId,
      text: caption,
      parse_mode: 'Markdown'
    });
  }

  async function sendPhotoBuffer(chatId, buffer, filename, caption) {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    if (caption) {
      form.append('caption', caption);
      form.append('parse_mode', 'Markdown');
    }
    form.append('photo', buffer, filename);

    const { data } = await axios.post(`${API}/sendPhoto`, form, {
      headers: form.getHeaders(),
      timeout: 30000
    });

    if (!data.ok) throw new Error(data.description || 'sendPhoto failed');
  }

  async function waitForQR(sessionId, timeoutMs = 60000) {
    const started = Date.now();
    while (!stopped && Date.now() - started < timeoutMs) {
      const conn = botManager.getSession(sessionId);
      if (conn && conn._lastQR) return conn._lastQR;
      await sleep(500);
    }
    throw new Error('WhatsApp did not provide a QR code within 60 seconds. Please try /qr again.');
  }

  async function handleQrPairing(chatId, phone) {
    await tg('sendMessage', {
      chat_id: chatId,
      text:
        `⏳ *Generating your WhatsApp QR code...*\n\n` +
        `Please wait a moment.`,
      parse_mode: 'Markdown'
    });

    const owner = await findOwner();

    const { sessionId: sid } = await botManager.createSession({
      userId: owner._id,
      ownerTag: owner.username,
      phoneNumber: phone,
      method: 'qr'
    });

    const qrText = await waitForQR(sid, 60000);
    const dataUrl = await QRCode.toDataURL(qrText, {
      errorCorrectionLevel: 'M',
      margin: 1,
      scale: 8
    });
    const buffer = Buffer.from(dataUrl.split(',')[1], 'base64');

    const caption =
      `📷 *SCAN THIS QR CODE*\n\n` +
      `📱 *How to link your WhatsApp:*\n\n` +
      `1️⃣ Open *WhatsApp* on your phone.\n\n` +
      `2️⃣ Go to *Settings*.\n\n` +
      `3️⃣ Tap *Linked Devices*.\n\n` +
      `4️⃣ Tap *Link a Device*.\n\n` +
      `5️⃣ Point your camera at this QR code.\n\n` +
      `⚠️ This QR code expires after about 60 seconds — if it times out, send /qr again.\n\n` +
      `Session: \`${sid}\``;

    await sendPhotoBuffer(chatId, buffer, 'whatsapp-qr.png', caption);
  }

  async function handlePairCode(chatId, phone) {
    await tg('sendMessage', {
      chat_id: chatId,
      text:
        `⏳ *Starting WhatsApp pairing...*\n\n` +
        `Phone: +${phone}\n\n` +
        `Please wait while WhatsApp generates your pairing code.`,
      parse_mode: 'Markdown'
    });

    const owner = await findOwner();

    const result = await botManager.createPairingSession({
      userId: owner._id,
      ownerTag: owner.username,
      phoneNumber: phone
    });

    await tg('sendMessage', {
      chat_id: chatId,
      text:
        `🔄 *Pairing session started.*\n\n` +
        `Generating your WhatsApp pairing code...\n\n` +
        `Session: \`${result.sessionId}\``,
      parse_mode: 'Markdown'
    });

    const code = await waitForPairingCode(result.sessionId, 60000);
    await sendPairingCode(chatId, result.sessionId, code);
  }

  async function runPendingAction(chatId, pending) {
    if (!pending) return;

    try {
      if (pending.type === 'qr') {
        await handleQrPairing(chatId, pending.phone);
      } else if (pending.type === 'pair') {
        await handlePairCode(chatId, pending.phone);
      }
    } catch (err) {
      console.error('[Telegram] Pending action error:', err);
      await tg('sendMessage', {
        chat_id: chatId,
        text: `❌ *Pairing failed*\n\n${String(err.message || err)}`,
        parse_mode: 'Markdown'
      });
    }
  }

  async function handleCallbackQuery(cb) {
    const chatId = cb.message?.chat?.id;
    const userId = cb.from?.id;
    if (!chatId || !userId) return;

    if (cb.data === 'forcejoin:check') {
      const { ok, missing } = await forceJoin.checkMembership(tg, userId);

      if (!ok) {
        await tg('answerCallbackQuery', {
          callback_query_id: cb.id,
          text: 'Bado hujajoin makundi yote / You have not joined all groups yet.',
          show_alert: true
        });

        try {
          await tg('editMessageReplyMarkup', {
            chat_id: chatId,
            message_id: cb.message.message_id,
            reply_markup: forceJoin.buildJoinKeyboard(missing)
          });
        } catch (_) {}

        return;
      }

      await tg('answerCallbackQuery', {
        callback_query_id: cb.id,
        text: '✅ Umethibitishwa! / Verified!'
      });

      try {
        await tg('editMessageText', {
          chat_id: chatId,
          message_id: cb.message.message_id,
          text: '✅ *Umeshajoin — unaendelea na pairing...*\n\n✅ *Joined — continuing your pairing...*',
          parse_mode: 'Markdown'
        });
      } catch (_) {}

      const pending = pendingActions.get(userId);
      pendingActions.delete(userId);

      if (pending) {
        await runPendingAction(chatId, pending);
      } else {
        await tg('sendMessage', {
          chat_id: chatId,
          text: 'Sasa unaweza kutumia /pair <namba> au /qr <namba>.\nYou can now use /pair <number> or /qr <number>.',
          parse_mode: 'Markdown'
        });
      }
    }
  }

  async function handleMessage(message) {
    const chatId = message.chat?.id;
    const text = String(message.text || '').trim();
    if (!chatId || !text) return;

    // Setup helper: send /chatid inside any group/channel (with the bot
    // added) to get the numeric chat_id needed for TELEGRAM_FORCE_JOIN_CHAT_IDS.
    if (/^\/chatid(?:@\w+)?$/i.test(text)) {
      await tg('sendMessage', {
        chat_id: chatId,
        text:
          `🆔 *Chat ID*\n\n` +
          `\`${chatId}\`\n\n` +
          `Type: ${message.chat?.type || 'unknown'}\n` +
          `Title: ${message.chat?.title || '-'}`,
        parse_mode: 'Markdown'
      });
      return;
    }

    if (/^\/start(?:@\w+)?$/i.test(text)) {
      await tg('sendMessage', {
        chat_id: chatId,
        text:
          `👋 *Welcome to DVARY BOT*\n\n` +
          `To connect your WhatsApp, choose one:\n\n` +
          `🔐 *Pairing code:*\n/pair 255712345678\n\n` +
          `📷 *QR code:*\n/qr 255712345678\n\n` +
          `Use your WhatsApp number with country code, no + sign.`,
        parse_mode: 'Markdown'
      });
      return;
    }

    const userId = message.from?.id;

    if (/^\/pair(?:@\w+)?$/i.test(text)) {
      if (userId && !(await requireJoin(chatId, userId, null))) return;

      await tg('sendMessage', {
        chat_id: chatId,
        text:
          `📱 *WhatsApp Pairing (code)*\n\n` +
          `Use the command like this:\n\n` +
          `/pair 255712345678\n\n` +
          `Do not use +, spaces or dashes.\n\n` +
          `Prefer scanning instead? Use /qr 255712345678`,
        parse_mode: 'Markdown'
      });
      return;
    }

    if (/^\/qr(?:@\w+)?$/i.test(text)) {
      if (userId && !(await requireJoin(chatId, userId, null))) return;

      await tg('sendMessage', {
        chat_id: chatId,
        text:
          `📷 *WhatsApp Pairing (QR code)*\n\n` +
          `Use the command like this:\n\n` +
          `/qr 255712345678\n\n` +
          `Do not use +, spaces or dashes.`,
        parse_mode: 'Markdown'
      });
      return;
    }

    const qrMatch = text.match(/^\/qr(?:@\w+)?\s+(.+)$/i);
    if (qrMatch) {
      const phone = cleanPhone(qrMatch[1]);
      if (phone.length < 8 || phone.length > 15) {
        await tg('sendMessage', {
          chat_id: chatId,
          text: `❌ *Invalid phone number.*\n\nExample:\n/qr 255712345678`,
          parse_mode: 'Markdown'
        });
        return;
      }

      if (userId && !(await requireJoin(chatId, userId, { type: 'qr', phone }))) return;

      try {
        await handleQrPairing(chatId, phone);
      } catch (err) {
        console.error('[Telegram] /qr error:', err);
        await tg('sendMessage', {
          chat_id: chatId,
          text: `❌ *QR pairing failed*\n\n${String(err.message || err)}`,
          parse_mode: 'Markdown'
        });
      }
      return;
    }

    const match = text.match(/^\/pair(?:@\w+)?\s+(.+)$/i);
    if (!match) return;

    const phone = cleanPhone(match[1]);
    if (phone.length < 8 || phone.length > 15) {
      await tg('sendMessage', {
        chat_id: chatId,
        text: `❌ *Invalid phone number.*\n\nExample:\n/pair 255712345678`,
        parse_mode: 'Markdown'
      });
      return;
    }

    if (userId && !(await requireJoin(chatId, userId, { type: 'pair', phone }))) return;

    try {
      await handlePairCode(chatId, phone);
    } catch (err) {
      console.error('[Telegram] /pair error:', err);
      await tg('sendMessage', {
        chat_id: chatId,
        text: `❌ *Pairing failed*\n\n${String(err.message || err)}`,
        parse_mode: 'Markdown'
      });
    }
  }

  async function poll() {
    while (!stopped) {
      try {
        const updates = await tg('getUpdates', {
          offset,
          timeout: POLL_TIMEOUT,
          allowed_updates: ['message', 'callback_query']
        });

        for (const update of updates) {
          offset = update.update_id + 1;
          if (update.message) await handleMessage(update.message);
          if (update.callback_query) await handleCallbackQuery(update.callback_query);
        }
      } catch (err) {
        if (!stopped) {
          console.error('[Telegram] Polling error:', err.message);
          await sleep(3000);
        }
      }
    }
  }

  poll();

  return {
    stop() {
      stopped = true;
    }
  };
};
