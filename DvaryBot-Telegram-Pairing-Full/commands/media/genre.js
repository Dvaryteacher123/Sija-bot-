'use strict';
const kit = require('../../utils/musicKit');

module.exports = kit.music({
    name: 'genre',
    aliases: ['genres', 'aina'],
    emoji: '🎼',
    description: 'List music genres, or top 10 songs of a genre',
    usage: 'genre [name]   (example: genre pop)',
    needsInput: false,
    async run({ say, query }) {
        const all = ((await kit.deezer('/genre')) || {}).data || [];
        const genres = all.filter((g) => g.id !== 0);

        if (!query) {
            return say(
                `🎼 *GENRES*\n\n` +
                genres.map((g) => `• ${g.name}`).join('\n') +
                `\n\nExample: *.genre pop*`
            );
        }

        const q = query.toLowerCase();
        const g = genres.find((x) => x.name.toLowerCase() === q) ||
                  genres.find((x) => x.name.toLowerCase().includes(q));
        if (!g) throw new Error('Genre not found. Send *.genre* to see the list.');

        const list = ((await kit.deezer(`/chart/${g.id}/tracks`, { limit: 10 })) || {}).data || [];
        if (!list.length) throw new Error('No songs found for this genre.');
        return say(
            `🎼 *TOP 10 — ${g.name}*\n\n` +
            list.map((t, i) => kit.trackLine(t, i)).join('\n')
        );
    }
});
