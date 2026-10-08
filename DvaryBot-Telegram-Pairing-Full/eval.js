/**
 * COMMAND: eval
 * Execute raw JavaScript code (owner only, DANGEROUS)
 */

'use strict';

const util = require('util');
const config = require('../../config/config');
const logger = require('../../utils/logger');

module.exports = {
  name: 'eval',
  category: 'owner',
  aliases: ['ev', 'exec', '>'],
  description: 'Execute raw JavaScript code (owner only)',
  usage: 'eval <code>',
  ownerOnly: true,
  cooldown: 3,

  async run(ctx, { reply, replyError }) {
    try {
      const code = ctx.query;

      if (!code) {
        let info = `╭━━━〔 *${config.bot.name.toUpperCase()}* 〕━━━\n`;
        info += `┃ ⚠️ *EVAL*\n`;
        info += `┃\n`;
        info += `┃ Usage : ${ctx.prefix}eval <code>\n`;
        info += `┃ Ex    : ${ctx.prefix}eval 1 + 1\n`;
        info += `┃       : ${ctx.prefix}eval return process.version\n`;
        info += `╰━━━━━━━━━━━━━━━━━━━━━\n\n`;
        info += `⚠️ DANGER: Use with caution.\n\n`;
        info += `_${config.bot.footer}_`;
        return reply(ctx, info);
      }

      const start = Date.now();

      let result;
      let error = null;

      try {
        // If code contains "return", wrap in async function
        if (/\breturn\b/.test(code)) {
          const fn = new Function(
            'ctx', 'config', 'logger',
            `return (async () => { ${code} })();`
          );
          result = await fn(ctx, config, logger);
        } else {
          const fn = new Function(
            'ctx', 'config', 'logger',
            `return (async () => { return (${code}); })();`
          );
          result = await fn(ctx, config, logger);
        }
      } catch (e) {
        error = e;
      }

      const elapsed = Date.now() - start;

      if (error) {
        let text = `╭━━━〔 *${config.bot.name.toUpperCase()}* 〕━━━\n`;
        text += `┃ ⚠️ *EVAL ERROR*\n`;
        text += `┃\n`;
        text += `┃ ❌ ${String(error.message || error).slice(0, 300)}\n`;
        text += `┃ ⏱️ ${elapsed}ms\n`;
        text += `╰━━━━━━━━━━━━━━━━━━━━━\n\n`;
        text += `_${config.bot.footer}_`;
        return reply(ctx, text);
      }

      let formatted;
      try {
        if (typeof result === 'string') formatted = result;
        else formatted = util.inspect(result, { depth: 3, maxArrayLength: 50 });
      } catch (_) {
        formatted = String(result);
      }

      if (!formatted || formatted === 'undefined') formatted = 'undefined';
      if (formatted.length > 2500) {
        formatted = formatted.slice(0, 2500) + '\n... (truncated)';
      }

      let text = `╭━━━〔 *${config.bot.name.toUpperCase()}* 〕━━━\n`;
      text += `┃ ✅ *EVAL RESULT*\n`;
      text += `┃\n`;
      text += `┃ ⏱️ ${elapsed}ms\n`;
      text += `╰━━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += `\`\`\`\n${formatted}\n\`\`\`\n\n`;
      text += `_${config.bot.footer}_`;
      return reply(ctx, text);
    } catch (err) {
      logger.error(`[eval] ${err.message}`);
      return replyError(ctx, `Eval failed: ${err.message}`);
    }
  }
};
