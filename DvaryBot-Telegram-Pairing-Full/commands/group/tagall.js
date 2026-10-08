'use strict';

module.exports = {
    name: 'tagall',
    category: 'group',

    aliases: ['everyone', 'all', 'mentionall'],

    description: 'Mention all group members',
    usage: '.tagall [message]',

    ownerOnly: false,
    cooldown: 5,

    async execute(ctx) {

        const reply = async (text) => {
            await ctx.sock.sendMessage(
                ctx.from,
                { text: String(text) },
                { quoted: ctx.msg }
            );
        };

        try {
            if (!ctx.isGroup) {
                return reply(
                    '❌ This command can only be used in groups.'
                );
            }

            const metadata =
                await ctx.sock.groupMetadata(ctx.from);

            const participants =
                metadata?.participants || [];

            if (!participants.length) {
                return reply(
                    '❌ No group members found.'
                );
            }

            const mentions = participants
                .map(member => member?.id)
                .filter(Boolean);

            const message =
                ctx.args?.length
                    ? ctx.args.join(' ')
                    : 'Attention everyone!';

            const tags = mentions.map(jid => {
                const number = String(jid)
                    .split(':')[0]
                    .split('@')[0];

                return `@${number}`;
            }).join(' ');

            await ctx.sock.sendMessage(
                ctx.from,
                {
                    text:
                        `📢 *TAG ALL*\n\n` +
                        `${message}\n\n` +
                        tags,
                    mentions
                },
                {
                    quoted: ctx.msg
                }
            );

        } catch (error) {
            console.error('[TAGALL ERROR]', error);

            return reply(
                `❌ Failed to tag members.\n\n${error.message}`
            );
        }
    }
};
