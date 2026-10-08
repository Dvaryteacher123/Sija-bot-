'use strict';

/**
 * =====================================================
 * FORCE JOIN — Telegram
 * =====================================================
 * Mtumiaji lazima ajoin makundi/channel maalum kabla
 * hajaruhusiwa kutumia /pair au /qr.
 *
 * MUHIMU (lazima ufanye hivi kabla haijafanya kazi):
 * ---------------------------------------------------
 * Telegram Bot API HAIWEZI kuangalia "amejoin ama la"
 * kwa kutumia invite link (https://t.me/+xxxx) peke yake.
 * Inahitaji NUMERIC CHAT ID ya kila kundi (mfano -1001234567890),
 * na bot lazima awe ADMIN kwenye kundi husika.
 *
 * Hatua:
 *  1. Ongeza bot yako kwenye kila kundi 3 kama ADMIN.
 *  2. Tuma ujumbe wowote ndani ya kundi ukiandika: /chatid
 *     Bot itakujibu na Chat ID ya hilo kundi (mfano -1001234567890).
 *  3. BANDIKA ID HIZO TATU HAPA CHINI kwenye DEFAULT_CHAT_IDS
 *     (mpangilio uendane na mpangilio wa DEFAULT_LINKS chini yake).
 *     Hakuna haja ya kugusa .env — hii inatosha peke yake.
 *
 * Kama DEFAULT_CHAT_IDS bado ni tupu (na hakuna env var pia),
 * force-join itaruka moja kwa moja (fail-open) ili bot isikwame
 * - lakini ita-log warning kila mara.
 * =====================================================
 */

const logger = require('../utils/logger');

const DEFAULT_LINKS = [
  'https://t.me/+BqmtkZTgbJ03Njc8',
  'https://t.me/+t8XLd59jlE8xZmM0',
  'https://t.me/+WAm8RNpPw6o5NjQ0'
];

// =====================================================
// BANDIKA CHAT ID ZA MAKUNDI YAKO 3 HAPA (mpangilio uendane
// na DEFAULT_LINKS hapo juu). Pata kila moja kwa kutuma
// /chatid ndani ya kundi husika (bot ikiwa admin humo).
// Mfano: '-1001234567890'
// =====================================================
const DEFAULT_CHAT_IDS = [
  '-5480860079',      // Developer tool
  '-1003992998525',   // All bot
  '-1004407082106'    // Cyber security
];

const LINKS = String(process.env.TELEGRAM_FORCE_JOIN_LINKS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const JOIN_LINKS = LINKS.length ? LINKS : DEFAULT_LINKS;

const ENV_CHAT_IDS = String(process.env.TELEGRAM_FORCE_JOIN_CHAT_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const FILE_CHAT_IDS = DEFAULT_CHAT_IDS
  .map(s => String(s || '').trim())
  .filter(Boolean);

// Env var inashinda ikiwa imewekwa; vinginevyo tunatumia zile
// ulizobandika moja kwa moja hapa juu kwenye faili.
const CHAT_IDS = ENV_CHAT_IDS.length ? ENV_CHAT_IDS : FILE_CHAT_IDS;

const ENABLED = CHAT_IDS.length > 0;

if (!ENABLED) {
  logger.warn(
    '[ForceJoin] Hakuna Chat ID zilizowekwa (wala kwenye DEFAULT_CHAT_IDS ' +
    'ndani ya faili, wala TELEGRAM_FORCE_JOIN_CHAT_IDS kwenye .env) — ' +
    'force-join IMEZIMWA kwa sasa. Tuma /chatid ndani ya kila kundi kupata ' +
    'ID, kisha bandika ndani ya telegram/forceJoin.js (DEFAULT_CHAT_IDS).'
  );
}

// Statuses that count as "still a member"
const JOINED_STATUSES = new Set(['creator', 'administrator', 'member', 'restricted']);

/**
 * Check whether a Telegram user is a member of every required chat.
 * Returns { ok, missing } where missing is a list of { chatId, link }
 * for every chat the user has NOT joined (or could not be verified).
 */
async function checkMembership(tg, userId) {
  if (!ENABLED) {
    return { ok: true, missing: [] };
  }

  const missing = [];

  for (let i = 0; i < CHAT_IDS.length; i++) {
    const chatId = CHAT_IDS[i];
    const link = JOIN_LINKS[i] || JOIN_LINKS[JOIN_LINKS.length - 1];

    try {
      const member = await tg('getChatMember', {
        chat_id: chatId,
        user_id: userId
      });

      const status = member?.status || 'left';

      if (!JOINED_STATUSES.has(status)) {
        missing.push({ chatId, link });
      }

    } catch (err) {
      // If the bot isn't admin yet, or the chat id is wrong, we can't
      // verify — log it clearly but don't hard-block real users forever
      // on a misconfiguration. Treat as "not verifiable" -> ask to join.
      logger.warn(
        `[ForceJoin] getChatMember failed for chat ${chatId}: ${err.message}`
      );
      missing.push({ chatId, link });
    }
  }

  return { ok: missing.length === 0, missing };
}

/**
 * Build the inline keyboard shown to users who haven't joined yet:
 * one URL button per missing group + one "I've joined" recheck button.
 */
function buildJoinKeyboard(missing) {
  const rows = missing.map((m, idx) => ([{
    text: `➡️ Join Group ${idx + 1}`,
    url: m.link
  }]));

  rows.push([{
    text: '✅ Nimeshajoin — Bofya Hapa / I have joined',
    callback_data: 'forcejoin:check'
  }]);

  return { inline_keyboard: rows };
}

function joinPromptText() {
  return (
    `🔒 *Lazima Ujoin Kwanza / You Must Join First*\n\n` +
    `Kabla ya kupata pair code, unatakiwa ujoin makundi yetu yote hapa chini kwanza.\n` +
    `Before you can get a pairing code, you must join all the groups below first.\n\n` +
    `Ukishajoin, bofya *"✅ Nimeshajoin"* chini.\n` +
    `Once you've joined, tap *"✅ I have joined"* below.`
  );
}

module.exports = {
  ENABLED,
  JOIN_LINKS,
  CHAT_IDS,
  checkMembership,
  buildJoinKeyboard,
  joinPromptText
};
