'use strict';
const kit = require('../../utils/musicKit');

module.exports = kit.music({
    name: 'songinfo',
    aliases: ['trackinfo', 'whatsong'],
    emoji: 'ℹ️',
    description: 'Details about a song (artist, album, release date, length)',
    usage: 'songinfo <song name>',
    async run({ sock, from, msg, say, query }) {
        const found = (await kit.searchTrack(query, 1))[0];
        if (!found) throw new Error('Song not found.');
        const t = await kit.deezer(`/track/${found.id}`);
        const caption =
            `🎵 *${t.title}*\n\n` +
            `🎤 Artist: ${t.artist.name}\n` +
            `💿 Album: ${t.album.title}\n` +
            `📅 Released: ${t.release_date || '--'}\n` +
            `⏱ Length: ${kit.fmtDuration(t.duration)}\n` +
            `🔞 Explicit: ${t.explicit_lyrics ? 'Yes' : 'No'}\n` +
            `🔗 ${t.link}`;
        const cover = t.album.cover_xl || t.album.cover_big || t.album.cover_medium;
        if (cover) {
            try {
                return await sock.sendMessage(from, { image: { url: cover }, caption }, { quoted: msg });
            } catch (_) {}
        }
        return say(caption);
    }
});
