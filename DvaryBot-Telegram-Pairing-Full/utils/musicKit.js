'use strict';

/**
 * DVARY BOT - MUSIC KIT
 * Small helper used by the music commands. Uses the free public Deezer API
 * (no key needed) and lyrics.ovh. No yt-dlp / python needed, so it works on
 * Pterodactyl too.
 */

const axios = require('axios');

const DEEZER = 'https://api.deezer.com';
const TIMEOUT = 15000;

async function getJson(url, params) {
    const res = await axios.get(url, {
        params,
        timeout: TIMEOUT,
        headers: { 'User-Agent': 'DvaryBot/1.0' }
    });
    const data = res.data;
    if (data && data.error) {
        throw new Error(data.error.message || 'Music service error');
    }
    return data;
}

const deezer = (path, params) => getJson(DEEZER + path, params);

async function searchTrack(query, limit = 1) {
    const data = await deezer('/search', { q: query, limit });
    return (data && data.data) || [];
}

async function searchArtist(query) {
    const data = await deezer('/search/artist', { q: query, limit: 1 });
    return ((data && data.data) || [])[0] || null;
}

async function searchAlbum(query) {
    const data = await deezer('/search/album', { q: query, limit: 1 });
    return ((data && data.data) || [])[0] || null;
}

function fmtDuration(sec) {
    sec = Number(sec) || 0;
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}

function fmtNumber(n) {
    return Number(n || 0).toLocaleString('en-US');
}

function trackLine(t, i) {
    const n = i !== undefined ? `${i + 1}. ` : '';
    const artist = t.artist && t.artist.name ? t.artist.name : '';
    return `${n}*${t.title}*${artist ? ' — ' + artist : ''}  ⏱ ${fmtDuration(t.duration)}`;
}

function getQuery(ctx) {
    return (Array.isArray(ctx.args) ? ctx.args.join(' ') : String(ctx.args || '')).trim();
}

/** Builds a command with shared reply / error handling. */
function music(def) {
    return {
        name: def.name,
        aliases: def.aliases || [],
        category: 'media',
        description: def.description,
        usage: def.usage,
        emoji: def.emoji || '🎵',
        ownerOnly: false,
        groupOnly: false,
        privateOnly: false,
        adminOnly: false,
        botAdminOnly: false,
        cooldown: 0,

        async execute(ctx) {
            const { sock, from, msg } = ctx;
            const prefix = ctx.prefix || '.';
            const say = (text) => sock.sendMessage(from, { text: String(text) }, { quoted: msg });
            const query = getQuery(ctx);

            if (def.needsInput !== false && !query) {
                return say(`${def.emoji || '🎵'} *Usage:* ${prefix}${def.usage}`);
            }

            try {
                try { sock.sendPresenceUpdate('composing', from).catch(() => {}); } catch (_) {}
                return await def.run({ ctx, say, query, prefix, sock, from, msg });
            } catch (error) {
                const m = error && error.message ? error.message : 'Something went wrong';
                return say(`❌ ${/timeout|ECONN|ENOTFOUND|network/i.test(m) ? 'Music service is not reachable right now, try again.' : m}`);
            }
        }
    };
}

module.exports = {
    axios,
    deezer,
    getJson,
    searchTrack,
    searchArtist,
    searchAlbum,
    fmtDuration,
    fmtNumber,
    trackLine,
    music
};
