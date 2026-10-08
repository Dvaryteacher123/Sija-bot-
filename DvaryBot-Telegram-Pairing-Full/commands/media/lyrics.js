'use strict';
const kit = require('../../utils/musicKit');

module.exports = kit.music({
    name: 'lyrics',
    aliases: ['lyric', 'mashairi'],
    emoji: '📝',
    description: 'Get the lyrics of a song',
    usage: 'lyrics <song name>   or   lyrics <artist> - <song>',
    async run({ say, query }) {
        let artist;
        let title;

        if (query.includes('-')) {
            const [a, ...rest] = query.split('-');
            artist = a.trim();
            title = rest.join('-').trim();
        } else {
            const found = (await kit.searchTrack(query, 1))[0];
            if (!found) throw new Error('Song not found.');
            artist = found.artist.name;
            title = found.title;
        }

        let text = '';
        try {
            const data = await kit.getJson(
                `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
            );
            text = String((data && data.lyrics) || '').trim();
        } catch (_) {}

        if (!text) throw new Error(`Lyrics not found for ${artist} - ${title}.`);

        const MAX = 3500;
        const body = text.length > MAX ? text.slice(0, MAX) + '\n\n… (cut, lyrics too long)' : text;
        return say(`📝 *${title}* — ${artist}\n\n${body}`);
    }
});
