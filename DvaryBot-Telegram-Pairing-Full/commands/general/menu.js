'use strict';

/**
 * =====================================================
 *  MENU  (optimized for bursts: 500 people at once)
 *  - menu text is built ONCE and cached (not per message)
 *  - menu image is read from disk ONCE and cached
 *  - when the send queue is busy: no reaction, text only
 *    (text is much lighter than uploading an image)
 *  - .menu <category> shows one small category
 *  Set MENU_WITH_IMAGE=false in .env for text-only menus.
 * =====================================================
 */

const path = require('path');
const fs = require('fs');
const GROUP_EMOJI = require('../../utils/groupEmojis');

const WITH_IMAGE = String(process.env.MENU_WITH_IMAGE || 'false').toLowerCase() === 'true';
const BUSY_QUEUE = Number(process.env.MENU_BUSY_QUEUE) || 8;
const MAX_CAPTION = Number(process.env.MENU_CAPTION_MAX) || 3800;
let OWNER_NAME = process.env.BOT_OWNER || 'Dvary';
try { OWNER_NAME = require('../../config/config').bot.owner || OWNER_NAME; } catch (_) {}

// Ujumbe mwepesi unaotumwa KWANZA, kisha menu inafuata.
// (Unasaidia kuepuka "Waiting for this message" kwa sababu ujumbe mwepesi
//  unafungua session na mtumiaji kabla ya picha/menu nzito kutumwa.)
const LOADING_TEXT = process.env.MENU_LOADING_TEXT || '⏳ Dvary loading....';
const LOADING_DELAY_MS = process.env.MENU_LOADING_DELAY_MS !== undefined
    ? Number(process.env.MENU_LOADING_DELAY_MS) || 0
    : 500;

const CATEGORY_NAMES = {
    general: 'GENERAL',
    media: 'MEDIA',
    group: 'GROUP',
    utility: 'UTILITY',
    owner: 'OWNER',
    admin: 'ADMIN',
    download: 'DOWNLOAD',
    fun: 'FUN',
    other: 'OTHER'
};

const CATEGORY_ORDER = [
    'general', 'media', 'download', 'utility',
    'group', 'admin', 'fun', 'owner', 'other'
];

let cache = null;               // { key, full, header, byCategory, total }
let imageBuffer;                // undefined = not loaded yet, null = none
let imageLoading = null;

function buildCache(commands) {
    const groups = {};
    const seen = new Set();

    for (const command of commands) {
        if (!command || !command.name) continue;

        const name = String(command.name).toLowerCase();
        if (seen.has(name)) continue;
        seen.add(name);

        const category = String(command.category || 'other').toLowerCase();
        const emoji = command.emoji || (category === 'group' ? (GROUP_EMOJI[name] || '👥') : '') || '•';
        (groups[category] = groups[category] || []).push({ name, emoji });
    }

    const order = [
        ...CATEGORY_ORDER,
        ...Object.keys(groups).filter((c) => !CATEGORY_ORDER.includes(c))
    ];

    const byCategory = {};
    let body = '';

    for (const category of order) {
        const list = groups[category];
        if (!list || !list.length) continue;

        list.sort((a, b) => a.name.localeCompare(b.name));

        const title = CATEGORY_NAMES[category] || category.toUpperCase();
        let block = `╭━━〔 ${title} 〕━━╮\n`;
        for (const item of list) block += `┃ ${item.emoji} {{P}}${item.name}\n`;
        block += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;

        byCategory[category] = { title, count: list.length, text: block.trimEnd() };
        body += block;
    }

    const total = seen.size;

    const usage =
        `╭━━━〔 ⚙️ USAGE 〕━━━╮\n` +
        `┃ • {{P}}menu\n` +
        `┃ • {{P}}menu <category>\n` +
        `┃ • {{P}}help <command>\n` +
        `╰━━━━━━━━━━━━━━━━━━╯\n\n` +
        `🚀 Powered by Dvary`;

    // Short menu that FITS in one image caption (picha + menu pamoja)
    let overview = '{{H}}';
    overview += `╭━━〔 📂 CATEGORIES 〕━━╮\n`;
    for (const category of order) {
        const e = byCategory[category];
        if (!e) continue;
        overview += `┃ ▸ {{P}}menu ${category}  (${e.count})\n`;
    }
    overview += `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;
    overview += `💡 {{P}}menu all = commands zote\n\n` + usage;

    return {
        key: commands.length,
        overview,
        full: '{{H}}' + body + usage,
        byCategory,
        total
    };
}

/* Header ya juu: Prefix / Owner / User / Commands / Node.
 * Inajengwa kwa kila ombi kwa sababu jina la User hubadilika (nyepesi sana). */
function makeHeader(prefix, user, total) {
    return (
        `╭━━━〔 🤖 DVARY BOT 〕━━━╮\n` +
        `┃ 🔰 Prefix   : ${prefix}\n` +
        `┃ 👑 Owner    : ${OWNER_NAME}\n` +
        `┃ 👤 User     : ${user}\n` +
        `┃ 📚 Commands : ${total}\n` +
        `┃ 🟢 Node     : ${process.version}\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━╯\n\n`
    );
}

/* Jina la mtu aliyebonyeza .menu:
 * - aliyepair bot (session owner) -> jina la WhatsApp account yake
 * - mtu mwingine (hajapair)        -> jina lake mwenyewe (pushName) au namba */
function resolveUserName(ctx) {
    const clean = (v) => String(v || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 40);
    const fromMe = !!(ctx.msg && ctx.msg.key && ctx.msg.key.fromMe);
    const push = clean(ctx.msg && ctx.msg.pushName);
    const own = clean(ctx.sock && ctx.sock.user && (ctx.sock.user.name || ctx.sock.user.verifiedName));

    if (ctx.isSessionOwner || fromMe) return own || push || clean(ctx.senderPhone) || 'User';
    return push || clean(ctx.senderPhone) || 'User';
}

/* Weka prefix, header na (kama ipo) jina kwenye text iliyohifadhiwa */
function render(text, prefix, header) {
    return text.replace(/\{\{H\}\}/g, () => header).replace(/\{\{P\}\}/g, () => prefix);
}

/* Gawa text ndefu kwa mistari ili kila ujumbe ubaki chini ya limit */
function splitLines(text, max) {
    if (text.length <= max) return [text];
    const parts = [];
    let cur = '';
    for (const line of text.split('\n')) {
        if (cur.length + line.length + 1 > max && cur) {
            parts.push(cur.trimEnd());
            cur = '';
        }
        cur += line + '\n';
    }
    if (cur.trim()) parts.push(cur.trimEnd());
    return parts;
}

/* Picha: menu-<category>.jpg kama ipo, vinginevyo menu.jpg (zinasomwa mara moja) */
const imageCache = new Map();

function loadImage(category) {
    const key = category || 'menu';
    if (imageCache.has(key)) return imageCache.get(key);

    const dir = path.join(process.cwd(), 'public', 'images');
    const read = (name) => fs.promises.readFile(path.join(dir, name)).catch(() => null);

    const p = (async () => {
        if (category) {
            for (const ext of ['jpg', 'jpeg', 'png']) {
                const b = await read(`menu-${category}.${ext}`);
                if (b) return b;
            }
        }
        for (const name of ['menu.jpg', 'menu.jpeg', 'menu.png']) {
            const b = await read(name);
            if (b) return b;
        }
        return null;
    })();

    imageCache.set(key, p);
    return p;
}

if (WITH_IMAGE) {
    // warm up at startup so the first .menu is already fast
    loadImage();
}

module.exports = {
    name: 'menu',
    category: 'general',
    aliases: ['help', 'commands'],
    description: 'Display the bot command menu',
    usage: '.menu [category]',
    ownerOnly: false,
    // Menu is cached/instant, so it never needs a per-user cooldown —
    // no "please wait" message when many people open it at once.
    cooldown: 0,

    async execute(ctx) {
        const { sock, from, msg } = ctx;

        const queued = typeof sock.__queueSize === 'function' ? sock.__queueSize() : 0;
        const busy = queued > BUSY_QUEUE;

        const send = (content) => sock.sendMessage(from, content, { quoted: msg });

        try {
            const commands = typeof ctx.getCommands === 'function' ? ctx.getCommands() : null;

            if (!Array.isArray(commands)) {
                return send({ text: '❌ Failed to load the command menu.' });
            }

            if (!cache || cache.key !== commands.length) {
                cache = buildCache(commands);
            }

            const prefix = ctx.prefix || '.';
            const header = makeHeader(prefix, resolveUserName(ctx), cache.total);

            const wanted = String((ctx.args && ctx.args[0]) || '').toLowerCase();
            const useImage = WITH_IMAGE && !busy;

            // Tuma picha (kama ipo) + maandishi; maandishi marefu yanagawanywa
            const sendWithImage = async (category, text) => {
                const image = useImage ? await loadImage(category) : null;
                const parts = splitLines(text, MAX_CAPTION);

                if (image) {
                    await send({ image, caption: parts[0] });
                } else {
                    await send({ text: parts[0] });
                }
                for (let i = 1; i < parts.length; i++) {
                    await send({ text: parts[i] });
                }
            };

            /* ---------- .menu <category> : kila category na picha yake ---------- */

            if (wanted && wanted !== 'all') {
                const entry = cache.byCategory[wanted];

                if (!entry) {
                    const names = Object.keys(cache.byCategory).join(', ');
                    return send({ text: `❌ Unknown category "${wanted}".\n\nAvailable: ${names}` });
                }

                const body = `${header}📚 *${entry.title}* (${entry.count})\n\n${entry.text}\n\n_Use {{P}}menu to see everything._`;
                return sendWithImage(wanted, render(body, prefix, header));
            }

            /* ---------- .menu / .menu all ---------- */

            // 1) Tuma "Dvary loading...." KWANZA (ujumbe mwepesi, unafungua
            //    session na mtumiaji), 2) kisha menu inafuata papo hapo.
            if (LOADING_TEXT) {
                try {
                    await send({ text: LOADING_TEXT });
                } catch (_) {}

                if (LOADING_DELAY_MS > 0) {
                    await new Promise((r) => setTimeout(r, LOADING_DELAY_MS));
                }
            }

            const showAll = wanted === 'all';
            const text = render(showAll ? cache.full : cache.overview, prefix, header);

            // .menu = picha + menu kwenye ujumbe MMOJA.
            // .menu all = picha + kichwa, kisha list kamili kama text.
            if (showAll && text.length > MAX_CAPTION) {
                const image = useImage ? await loadImage() : null;
                if (image) await send({ image, caption: header.trimEnd() });
                const body = text.slice(header.length);
                for (const part of splitLines(body, MAX_CAPTION)) {
                    await send({ text: part });
                }
                return;
            }

            return sendWithImage(null, text);

        } catch (error) {
            console.error('[MENU ERROR]', error && error.message ? error.message : error);

            try {
                await send({ text: `❌ Failed to load the menu.\n\n${error && error.message ? error.message : error}` });
            } catch (_) {}
        }
    }
};
