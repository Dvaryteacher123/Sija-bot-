'use strict';
const kit = require('../../utils/musicKit');

module.exports = kit.music({
    name: 'album',
    aliases: ['tracklist'],
    emoji: '💿',
    description: 'Show an album and its track list',
    usage: 'album <album name>',
    async run({ say, query }) {
        const found = await kit.searchAlbum(query);
        if (!found) throw new Error('Album not found.');
        const al = await kit.deezer(`/album/${found.id}`);
        const tracks = (al.tracks && al.tracks.data) || [];
        const year = al.release_date ? String(al.release_date).slice(0, 4) : '--';
        return say(
            `💿 *${al.title}*\n` +
            `🎤 ${al.artist && al.artist.name}\n` +
            `📅 ${year}  •  🎼 ${al.nb_tracks} tracks  •  ⏱ ${kit.fmtDuration(al.duration)}\n\n` +
            tracks.slice(0, 30).map((t, i) => `${i + 1}. ${t.title}`).join('\n')
        );
    }
});
