'use strict';
const kit = require('../../utils/musicKit');

module.exports = kit.music({
    name: 'preview',
    aliases: ['sample', 'clip'],
    emoji: '🎧',
    description: 'Send a 30 second audio preview of a song',
    usage: 'preview <song name>',
    async run({ sock, from, msg, say, query }) {
        const t = (await kit.searchTrack(query, 1))[0];
        if (!t) throw new Error('Song not found.');
        if (!t.preview) throw new Error('No preview available for this song.');

        const res = await kit.axios.get(t.preview, { responseType: 'arraybuffer', timeout: 30000 });
        await sock.sendMessage(
            from,
            {
                audio: Buffer.from(res.data),
                mimetype: 'audio/mpeg',
                ptt: false
            },
            { quoted: msg }
        );
        return say(`🎧 *${t.title}* — ${t.artist.name}\n💿 ${t.album.title}\n⏱ 30s preview`);
    }
});
