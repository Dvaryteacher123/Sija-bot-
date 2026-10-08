/**
 * COMMAND: id
 * Show chat / user / group JIDs
 */

'use strict';

const config = require('../../config/config');

module.exports = {
  name: 'id',
  category: 'utility',
  aliases: ['jid', 'chatid'],
  description: 'Show chat and user IDs (JIDs)',
  usage: 'id (in a chat or reply to a user)',
  cooldown: 3,

  async run(ctx, { reply }) {
    try {
      const chatJid = ctx.from;
      const senderJid = ctx.senderJid;
      const botJid = ctx.sock.user?.id || '';
      const botLid = ctx.sock.user?.lid || '';
      const chatPhone = chatJid.split('@')[0].split(':')[0];
      const senderPhone = senderJid.split('@')[0].split(':')[0];

      const mentioned =
        ctx.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const quoted =
        ctx.msg.message?.extendedTextMessage?.contextInfo?.participant || null;

      let text = `╭━━━〔 *${config.bot.name.toUpperCase()}* 〕━━━\n`;
      text += `┃ 🆔 *ID INFO*\n`;
      text += `┃\n`;
      text += `┃ 💬 *CHAT*\n`;
      text += `┃ 📛 Type    : ${ctx.isGroup ? 'Group' : 'Private'}\n`;
      text += `┃ 🔗 JID     : ${chatJid}\n`;
      text += `┃ 📞 Phone   : ${chatPhone || 'N/A'}\n`;
      text += `┃\n`;
      text += `┃ 👤 *YOU*\n`;
      text += `┃ 🔗 JID     : ${senderJid}\n`;
      text += `┃ 📞 Phone   : ${senderPhone || 'N/A'}\n`;
      text += `┃\n`;
      text += `┃ 🤖 *BOT*\n`;
      text += `┃ 🔗 JID     : ${botJid}\n`;
      if (botLid) text += `┃ 🆔 LID     : ${botLid}\n`;
      text += `┃ 🆔 Session : ${ctx.sessionId}\n`;

      if (quoted) {
        const qPhone = quoted.split('@')[0].split(':')[0];
        text += `┃\n`;
        text += `┃ 📎 *QUOTED USER*\n`;
        text += `┃ 🔗 JID     : ${quoted}\n`;
        text += `┃ 📞 Phone   : ${qPhone}\n`;
      }

      if (mentioned.length) {
        text += `┃\n`;
        text += `┃ 📢 *MENTIONED (${mentioned.length})*\n`;
        for (const m of mentioned.slice(0, 5)) {
          const p = m.split('@')[0].split(':')[0];
          text += `┃ 🔗 ${p} → ${m}\n`;
        }
      }

      text += `╰━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `\n_${config.bot.footer}_`;
      return reply(ctx, text);
    } catch (err) {
      return reply(ctx, `ID lookup failed: ${err.message}`);
    }
  }
};
