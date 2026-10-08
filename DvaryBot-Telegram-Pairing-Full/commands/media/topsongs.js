'use strict';
const kit = require('../../utils/musicKit');

module.exports = kit.music({
    name: 'topsongs',
    aliases: ['toptracks', 'artisthits'],
    emoji: '🏆',
    description: 'Top 10 songs of an artist',
    usage: 'topsongs <artist>',
    async run({ say, query }) {
        const artist = await kit.searchArtist(query);
        if (!artist) throw new Error('Artist not found.');
        const data = await kit.deezer(`/artist/${artist.id}/top`, { limit: 10 });
        const list = (data && data.data) || [];
        if (!list.length) throw new Error('No songs found.');
        return say(
            `🏆 *TOP SONGS — ${artist.name}*\n\n` +
            list.map((t, i) => `${i + 1}. *${t.title}*  ⏱ ${kit.fmtDuration(t.duration)}`).join('\n') +
            `\n\nPlay a sample: *.preview <song>*`
        );
    }
});
