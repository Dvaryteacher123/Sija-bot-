'use strict';
const kit = require('../../utils/musicKit');

module.exports = kit.music({
    name: 'artist',
    aliases: ['singer', 'msanii'],
    emoji: '🎤',
    description: 'Information about an artist',
    usage: 'artist <name>',
    async run({ sock, from, msg, say, query }) {
        const a = await kit.searchArtist(query);
        if (!a) throw new Error('Artist not found.');
        const info = await kit.deezer(`/artist/${a.id}`);
        const caption =
            `🎤 *${info.name}*\n\n` +
            `👥 Fans: ${kit.fmtNumber(info.nb_fan)}\n` +
            `💿 Albums: ${kit.fmtNumber(info.nb_album)}\n` +
            `🔗 ${info.link}\n\n` +
            `Top songs: *.topsongs ${info.name}*\n` +
            `Similar: *.similar ${info.name}*`;
        const pic = info.picture_xl || info.picture_big || info.picture_medium;
        if (pic) {
            try {
                return await sock.sendMessage(from, { image: { url: pic }, caption }, { quoted: msg });
            } catch (_) {}
        }
        return say(caption);
    }
});
