'use strict';
const kit = require('../../utils/musicKit');

module.exports = kit.music({
    name: 'charts',
    aliases: ['top10', 'toptracksnow', 'hits'],
    emoji: '📈',
    description: 'Global top 10 songs right now',
    usage: 'charts',
    needsInput: false,
    async run({ say }) {
        const data = await kit.deezer('/chart/0/tracks', { limit: 10 });
        const list = (data && data.data) || [];
        if (!list.length) throw new Error('Charts are not available right now.');
        return say(
            `📈 *GLOBAL TOP 10*\n\n` +
            list.map((t, i) => kit.trackLine(t, i)).join('\n') +
            `\n\nSample: *.preview <song>*`
        );
    }
});
