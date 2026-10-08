'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const ytdlp = require('youtube-dl-exec');
const ffmpegPath = require('ffmpeg-static');

module.exports = {
    name: 'song',
    aliases: ['music', 'play', 'mp4song'],
    category: 'media',

    description: 'Search YouTube and download a song as MP4',
    usage: '.song <song name>',

    ownerOnly: false,
    groupOnly: false,
    privateOnly: false,
    adminOnly: false,
    botAdminOnly: false,

    cooldown: 10,

    async run(ctx) {
        const { sock, msg, from, args } = ctx;

        let outputPath = null;

        try {
            const query = args?.join(' ')?.trim();

            if (!query) {
                return await sock.sendMessage(
                    from,
                    {
                        text:
                            '❌ *Song name required*\n\n' +
                            '🎵 Example:\n' +
                            '`.song Diamond Platnumz Komasava`\n\n' +
                            'You can also use:\n' +
                            '`.play Diamond Platnumz`\n' +
                            '`.music Diamond Platnumz`'
                    },
                    { quoted: msg }
                );
            }

            await sock.sendMessage(
                from,
                {
                    text:
                        `🔎 *Searching YouTube...*\n\n` +
                        `🎵 ${query}`
                },
                { quoted: msg }
            );

            /*
             * Search YouTube
             */
            const searchResult = await ytdlp(
                `ytsearch1:${query}`,
                {
                    dumpSingleJson: true,
                    noWarnings: true,
                    skipDownload: true,
                    noPlaylist: true,
                    defaultSearch: 'ytsearch1',
                    quiet: true
                }
            );

            let video = searchResult;

            /*
             * yt-dlp may return an object containing entries
             */
            if (searchResult?.entries?.length) {
                video = searchResult.entries[0];
            }

            if (!video || !video.webpage_url) {
                throw new Error('Song was not found.');
            }

            const title = video.title || query;
            const duration = video.duration || 0;
            const thumbnail = video.thumbnail || null;
            const videoUrl = video.webpage_url;

            /*
             * Limit very long videos
             */
            if (duration && duration > 15 * 60) {
                return await sock.sendMessage(
                    from,
                    {
                        text:
                            '❌ *This song/video is too long.*\n\n' +
                            'Maximum allowed duration is *15 minutes*.'
                    },
                    { quoted: msg }
                );
            }

            await sock.sendMessage(
                from,
                {
                    text:
                        `🎵 *${title}*\n\n` +
                        `⏳ Downloading...\n` +
                        `📦 Format: MP4`
                },
                { quoted: msg }
            );

            /*
             * Temporary output file
             */
            const tempName =
                `dvary-song-${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2, 8)}`;

            outputPath = path.join(
                os.tmpdir(),
                `${tempName}.mp4`
            );

            /*
             * Download + convert to MP4
             *
             * 360p is used to keep WhatsApp file size reasonable.
             */
            const options = {
                output: outputPath,

                format:
                    'bestvideo[height<=360]+bestaudio/best[height<=360]/best',

                mergeOutputFormat: 'mp4',

                noPlaylist: true,
                noWarnings: true,
                quiet: true,

                ffmpegLocation: ffmpegPath,

                /*
                 * Avoid huge files
                 */
                maxFilesize: '50M',

                /*
                 * YouTube extractor settings
                 */
                extractorArgs:
                    'youtube:player_client=android',

                retries: 2,

                socketTimeout: 30000
            };

            await ytdlp(videoUrl, options);

            if (!fs.existsSync(outputPath)) {
                throw new Error(
                    'Downloaded file was not created.'
                );
            }

            const fileStats = fs.statSync(outputPath);

            if (fileStats.size === 0) {
                throw new Error(
                    'Downloaded file is empty.'
                );
            }

            /*
             * WhatsApp file limit protection
             */
            if (fileStats.size > 50 * 1024 * 1024) {
                return await sock.sendMessage(
                    from,
                    {
                        text:
                            '❌ *File is too large for this command.*\n\n' +
                            'Try another song or a shorter video.'
                    },
                    { quoted: msg }
                );
            }

            const videoBuffer = fs.readFileSync(outputPath);

            /*
             * Send MP4
             */
            await sock.sendMessage(
                from,
                {
                    video: videoBuffer,
                    mimetype: 'video/mp4',
                    fileName:
                        `${title
                            .replace(/[\\/:*?"<>|]/g, '')
                            .slice(0, 80)}.mp4`,
                    caption:
                        `🎵 *${title}*\n\n` +
                        `📦 Format: MP4\n` +
                        `🤖 DVARY BOT`,
                    gifPlayback: false
                },
                { quoted: msg }
            );

        } catch (error) {
            console.error('[SONG ERROR]', error);

            let message =
                error?.stderr ||
                error?.message ||
                'Unknown error';

            /*
             * Make common yt-dlp errors easier to understand
             */
            if (
                message.includes('Sign in') ||
                message.includes('bot') ||
                message.includes('age-restricted')
            ) {
                message =
                    'YouTube rejected this video. Try another song/video.';
            }

            if (
                message.includes('Private video')
            ) {
                message =
                    'This video is private and cannot be downloaded.';
            }

            if (
                message.includes('Video unavailable')
            ) {
                message =
                    'This YouTube video is unavailable.';
            }

            await sock.sendMessage(
                from,
                {
                    text:
                        `❌ *Song download failed.*\n\n` +
                        `${String(message).slice(0, 1000)}`
                },
                { quoted: msg }
            );

        } finally {
            /*
             * Delete temporary file
             */
            try {
                if (
                    outputPath &&
                    fs.existsSync(outputPath)
                ) {
                    fs.unlinkSync(outputPath);
                }
            } catch (cleanupError) {
                console.error(
                    '[SONG CLEANUP ERROR]',
                    cleanupError.message
                );
            }
        }
    }
};
