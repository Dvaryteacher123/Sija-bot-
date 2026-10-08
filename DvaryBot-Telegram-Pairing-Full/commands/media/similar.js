'use strict';
const kit = require('../../utils/musicKit');

module.exports = kit.music({
    name: 'similar',
    aliases: ['related', 'likethis'],
    emoji: '🔀',
    description: 'Artists similar to an artist you like',
    usage: 'similar <artist>',
    async run({ say, query }) {
        const a = await kit.searchArtist(query);
        if (!a) throw new Error('Artist not found.');
        const data = await kit.deezer(`/artist/${a.id}/related`, { limit: 10 });
        const list = (data && data.data) || [];
        if (!list.length) throw new Error('No similar artists found.');
        return say(
            `🔀 *Similar to ${a.name}*\n\n` +
            list.map((x, i) => `${i + 1}. ${x.name}  (👥 ${kit.fmtNumber(x.nb_fan)})`).join('\n')
        );
    }
});
