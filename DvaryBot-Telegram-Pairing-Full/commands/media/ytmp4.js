'use strict';

'use strict';

/**
 * .ytmp4 <name or YouTube link>
 * Download a YouTube video (360p)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const ytdlp = require('youtube-dl-exec');
const kit = require('../../utils/mediaKit');

let ffmpegLocation = kit.FFMPEG;

const MODE = "video";
const MAX_SECONDS = MODE === 'audio' ? 20 * 60 : 10 * 60;

module.exports = {
    name: "ytmp4",
    aliases: ["ytv","video","getmp4"],
    category: 'media',
    description: "Download a YouTube video (360p)",
    usage: '.ytmp4 <song name or link>',
    ownerOnly: false,
    groupOnly: false,
    privateOnly: false,
    adminOnly: false,
    botAdminOnly: false,
    cooldown: 0,

    async execute(ctx) {
        const { sock, msg, from, args } = ctx;
        const say = (text) => sock.sendMessage(from, { text }, { quoted: msg });
        const query = (args || []).join(' ').trim();

        if (!query) return say('❌ Usage: *.ytmp4 <song name or YouTube link>*');

        const base = path.join(os.tmpdir(), 'dv_yt_' + crypto.randomBytes(6).toString('hex'));
        let final = null;

        await kit.acquire();

        try {
            sock.sendPresenceUpdate(MODE === 'audio' ? 'recording' : 'composing', from).catch(() => {});

            const target = /^https?:\/\//i.test(query) ? query : 'ytsearch1:' + query;

            const info = await ytdlp(target, {
                dumpSingleJson: true,
                noWarnings: true,
                skipDownload: true,
                noPlaylist: true,
                quiet: true
            });

            const video = info && info.entries && info.entries.length ? info.entries[0] : info;
            if (!video || !video.webpage_url) throw new Error('Nothing was found.');

            const title = String(video.title || query);
            if (video.duration && video.duration > MAX_SECONDS) {
                throw new Error('Too long. Maximum is ' + (MAX_SECONDS / 60) + ' minutes.');
            }

            const opts = {
                output: base + '.%(ext)s',
                noPlaylist: true,
                noWarnings: true,
                quiet: true,
                ffmpegLocation,
                maxFilesize: '60M',
                extractorArgs: 'youtube:player_client=android',
                retries: 2,
                socketTimeout: 30000
            };

            if (MODE === 'audio') {
                Object.assign(opts, { extractAudio: true, audioFormat: 'mp3', audioQuality: 5, format: 'bestaudio/best' });
            } else {
                Object.assign(opts, { format: 'bestvideo[height<=360]+bestaudio/best[height<=360]/best', mergeOutputFormat: 'mp4' });
            }

            await ytdlp(video.webpage_url, opts);

            const ext = MODE === 'audio' ? '.mp3' : '.mp4';
            final = base + ext;

            if (!fs.existsSync(final)) {
                const found = fs.readdirSync(os.tmpdir()).find((f) => f.startsWith(path.basename(base)));
                if (!found) throw new Error('Download failed.');
                final = path.join(os.tmpdir(), found);
            }

            const size = fs.statSync(final).size;
            if (!size) throw new Error('Downloaded file is empty.');
            if (size > 60 * 1024 * 1024) throw new Error('File is too large for WhatsApp.');

            const data = await fs.promises.readFile(final);
            const safeName = title.replace(/[\\/:*?"<>|]/g, '').slice(0, 80) || 'file';

            if (MODE === 'audio') {
                await sock.sendMessage(from, { audio: data, mimetype: 'audio/mpeg', fileName: safeName + '.mp3' }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { video: data, mimetype: 'video/mp4', caption: '🎬 *' + title + '*' }, { quoted: msg });
            }
        } catch (error) {
            let m = String((error && (error.stderr || error.message)) || 'Something went wrong');
            if (/Sign in|not a bot|age/i.test(m)) m = 'YouTube rejected this video. Try another one.';
            if (/Private video/i.test(m)) m = 'This video is private.';
            if (/unavailable/i.test(m)) m = 'This video is unavailable.';
            await say('❌ ' + m.slice(0, 300)).catch(() => {});
        } finally {
            kit.release();
            try {
                for (const f of fs.readdirSync(os.tmpdir())) {
                    if (f.startsWith(path.basename(base))) fs.unlink(path.join(os.tmpdir(), f), () => {});
                }
            } catch (_) {}
        }
    }
};
