'use strict';
const kit = require('../../utils/musicKit');

module.exports = kit.music({
    name: 'randomsong',
    aliases: ['surprise', 'randommusic'],
    emoji: '🎲',
    description: 'A random popular song (optionally from an artist)',
    usage: 'randomsong [artist]',
    needsInput: false,
    async run({ sock, from, msg, say, query }) {
        let list;
        if (query) {
            const a = await kit.searchArtist(query);
            if (!a) throw new Error('Artist not found.');
            list = ((await kit.deezer(`/artist/${a.id}/top`, { limit: 50 })) || {}).data || [];
        } else {
            list = ((await kit.deezer('/chart/0/tracks', { limit: 100 })) || {}).data || [];
        }
        if (!list.length) throw new Error('No songs found.');

        const t = list[Math.floor(Math.random() * list.length)];
        await say(`🎲 *${t.title}* — ${t.artist.name}\n💿 ${t.album.title}\n⏱ ${kit.fmtDuration(t.duration)}`);

        if (t.preview) {
            try {
                const res = await kit.axios.get(t.preview, { responseType: 'arraybuffer', timeout: 30000 });
                await sock.sendMessage(from, { audio: Buffer.from(res.data), mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
            } catch (_) {}
        }
    }
});
