'use strict';

/**
 * =====================================================
 *  PAIR COMMAND  (commands/general/pair.js)
 * =====================================================
 *  .pair 2557xxxxxxxx      -> anapata PAIR CODE (kuunganisha WhatsApp yake)
 *  .qrpair 2557xxxxxxxx    -> anapata QR CODE (picha ya ku-scan)
 *  .pair qr 2557xxxxxxxx   -> QR code pia
 *
 *  Bot inatengeneza session MPYA kwa namba ya huyo mtu
 *  (kama Telegram bot), kisha inamtumia code/QR.
 *  Kwenye group, code inatumwa PRIVATE (DM) ili isionekane na wengine.
 * =====================================================
 */

const QRCode = require('qrcode');

const config = require('../../config/config');
const logger = require('../../utils/logger');
const User = require('../../database/models/User');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function formatCode(code) {
    const raw = String(code || '').replace(/[^A-Za-z0-9]/g, '');
    return raw.match(/.{1,4}/g)?.join('-') || raw;
}

async function findOwner() {
    const username = String(process.env.OWNER_USERNAME || '').trim().toLowerCase();

    let owner = null;

    if (username) {
        owner = await User.findOne({ username, isActive: true });
    }

    if (!owner) {
        owner = await User.findOne({ role: 'owner', isActive: true });
    }

    if (!owner) {
        throw new Error('Owner account not found. Check OWNER_USERNAME in .env');
    }

    return owner;
}

async function waitFor(getter, timeoutMs, errorMessage) {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
        const value = getter();
        if (value) return value;
        await sleep(500);
    }

    throw new Error(errorMessage);
}

module.exports = {
    name: 'pair',

    category: 'general',

    aliases: ['paircode', 'getcode', 'qrpair'],

    description: 'Get a WhatsApp pairing code or QR code to link your number',

    usage: 'pair <number>  |  qrpair <number>',

    ownerOnly: false,

    cooldown: 30,

    async execute(ctx) {
        const prefix = ctx.prefix || '.';
        const botName = String(config.bot?.name || 'DVARY BOT').toUpperCase();
        const footer = config.bot?.footer || 'DVARY BOT';

        const say = (jid, content) =>
            ctx.sock.sendMessage(jid, content, { quoted: ctx.msg });

        const reply = (text) => say(ctx.from, { text: String(text) });

        // Group ni public -> tuma code kwa DM ya aliyeomba
        const privateJid =
            (ctx.isGroup && ctx.senderJid) ? ctx.senderJid : ctx.from;

        try {
            if (!ctx.sock) return;

            /* ---------- ARGUMENTS ---------- */

            let args = Array.isArray(ctx.args) ? [...ctx.args] : [];

            let wantQr = String(ctx.command || '').toLowerCase() === 'qrpair';

            args = args.filter((a) => {
                if (/^qr$/i.test(a)) {
                    wantQr = true;
                    return false;
                }
                return true;
            });

            const raw = args.join('');

            /* ---------- USAGE ---------- */

            if (!raw) {
                return reply(
                    `╭━━━〔 *${botName}* 〕━━━\n` +
                    `┃ 🔑 *PAIR YOUR WHATSAPP*\n` +
                    `┃\n` +
                    `┃ 🔐 Pair code:\n` +
                    `┃ ${prefix}pair 2557xxxxxxxx\n` +
                    `┃\n` +
                    `┃ 📷 QR code:\n` +
                    `┃ ${prefix}qrpair 2557xxxxxxxx\n` +
                    `┃\n` +
                    `┃ ℹ️ Use country code, no + sign\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `_${footer}_`
                );
            }

            /* ---------- PHONE ---------- */

            const phone = raw.replace(/\D/g, '');

            if (phone.length < 8 || phone.length > 15) {
                return reply(
                    '❌ Invalid phone number.\n\n' +
                    'Use country code without +.\n' +
                    `Example: ${prefix}pair 255712345678`
                );
            }

            if (!ctx.manager) {
                return reply('❌ Bot manager is not ready. Try again shortly.');
            }

            if (ctx.isGroup) {
                await reply('📩 Nakutumia code private (DM). Angalia inbox yako.');
            }

            await say(privateJid, {
                text:
                    `⏳ *${wantQr ? 'Generating your QR code' : 'Generating your pair code'}...*\n\n` +
                    `Phone: +${phone}\n` +
                    `Please wait up to 60 seconds.`
            });

            const owner = await findOwner();

            /* =================================================
             *  QR MODE
             * ================================================= */

            if (wantQr) {
                const { sessionId } = await ctx.manager.createSession({
                    userId: owner._id,
                    ownerTag: owner.username,
                    phoneNumber: phone,
                    method: 'qr'
                });

                const qrText = await waitFor(
                    () => ctx.manager.getSession(sessionId)?._lastQR,
                    60000,
                    'WhatsApp did not provide a QR code in time. Try again.'
                );

                const buffer = await QRCode.toBuffer(qrText, {
                    type: 'png',
                    width: 900,
                    margin: 2,
                    errorCorrectionLevel: 'M'
                });

                await say(privateJid, {
                    image: buffer,
                    caption:
                        `📷 *SCAN THIS QR CODE*\n\n` +
                        `1️⃣ Open WhatsApp on your phone\n` +
                        `2️⃣ Settings → *Linked Devices*\n` +
                        `3️⃣ *Link a Device*\n` +
                        `4️⃣ Scan this QR (scan from another phone/screen)\n\n` +
                        `⏱️ Expires in about 60 seconds. Send ${prefix}qrpair ${phone} again if it fails.\n` +
                        `⚠️ Keep it private.\n\n` +
                        `_${footer}_`
                });

                return;
            }

            /* =================================================
             *  PAIR CODE MODE
             * ================================================= */

            const { sessionId } = await ctx.manager.createPairingSession({
                userId: owner._id,
                ownerTag: owner.username,
                phoneNumber: phone
            });

            const code = await waitFor(
                () => ctx.manager.getPairingCode(sessionId),
                60000,
                'WhatsApp did not provide a pairing code in time. Try again.'
            );

            await say(privateJid, {
                text:
                    `🔐 *WHATSAPP PAIR CODE*\n\n` +
                    `Your code:\n\n` +
                    `*${formatCode(code)}*\n\n` +
                    `📱 *How to link:*\n` +
                    `1️⃣ Open WhatsApp\n` +
                    `2️⃣ Settings → *Linked Devices*\n` +
                    `3️⃣ *Link a Device*\n` +
                    `4️⃣ Tap *Link with phone number instead*\n` +
                    `5️⃣ Enter the code above\n\n` +
                    `⚠️ Keep this code private. Do not share it.\n\n` +
                    `_${footer}_`
            });

        } catch (error) {
            logger.error(`[pair] ${error.message}`);

            try {
                await reply(`❌ *Pairing failed.*\n\n${error.message}\n\nPlease try again.`);
            } catch (_) {}
        }
    }
};
