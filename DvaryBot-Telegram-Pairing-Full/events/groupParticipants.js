'use strict';

const Setting =
    require('../database/models/Setting');

function normalizeJid(jid) {
    return String(jid || '')
        .trim()
        .replace(/^whatsapp:/i, '');
}

function phoneFromJid(jid) {
    return normalizeJid(jid)
        .split(':')[0]
        .split('@')[0]
        .replace(/[^\d]/g, '');
}

async function getProfilePicture(sock, jid) {
    try {
        return await sock.profilePictureUrl(
            jid,
            'image'
        );
    } catch (_) {
        return null;
    }
}

module.exports = {

    name: 'group-participants.update',

    async execute(ctx) {

        const {
            sock,
            sessionId,
            userId,
            event
        } = ctx;

        if (!sock || !event) {
            return;
        }

        const groupId =
            normalizeJid(event.id);

        if (!groupId) {
            return;
        }

        let settings;

        try {

            settings =
                await Setting.getOrCreate(
                    sessionId,
                    userId
                );

        } catch (error) {

            console.error(
                '[GROUP EVENT] Settings error:',
                error
            );

            return;
        }

        if (!settings.metadata) {
            settings.metadata = {};
        }

        if (!settings.metadata.groups) {
            settings.metadata.groups = {};
        }

        const groupSettings =
            settings.metadata.groups[groupId] || {};

        /* Fill {user} {group} {count} in custom welcome/goodbye text */
        let groupName = '';
        let groupCount = 0;
        try {
            const gm = await sock.groupMetadata(groupId);
            groupName = gm.subject || '';
            groupCount = (gm.participants || []).length;
        } catch (_) { /* metadata unavailable */ }

        const fill = (tpl, phone) =>
            String(tpl)
                .replace(/\{user\}/gi, `@${phone}`)
                .replace(/\{group\}/gi, groupName)
                .replace(/\{count\}/gi, String(groupCount));

        /*
        |--------------------------------------------------------------------------
        | BLACKLIST (auto-remove blacklisted numbers when they join)
        |--------------------------------------------------------------------------
        */

        let removedByBlacklist = new Set();

        if (
            event.action === 'add' &&
            Array.isArray(groupSettings.blacklist) &&
            groupSettings.blacklist.length
        ) {
            for (const participant of event.participants || []) {
                const jid = normalizeJid(participant);
                const phone = phoneFromJid(jid);

                if (!phone || !groupSettings.blacklist.includes(phone)) continue;

                try {
                    await sock.groupParticipantsUpdate(groupId, [jid], 'remove');
                    removedByBlacklist.add(jid);
                    await sock.sendMessage(groupId, {
                        text: `⛔ @${phone} is blacklisted and was removed automatically.`,
                        mentions: [jid]
                    });
                } catch (error) {
                    console.error('[BLACKLIST ERROR]', error && error.message ? error.message : error);
                }
            }
        }

        /*
        |--------------------------------------------------------------------------
        | WELCOME
        |--------------------------------------------------------------------------
        */

        if (
            event.action === 'add' &&
            groupSettings.welcome === true
        ) {

            const participants =
                event.participants || [];

            for (const participant of participants) {

                const jid =
                    normalizeJid(participant);

                if (!jid) continue;
                if (removedByBlacklist.has(jid)) continue;

                const phone =
                    phoneFromJid(jid);

                const image =
                    await getProfilePicture(
                        sock,
                        jid
                    );

                const caption = groupSettings.welcomeText
                    ? fill(groupSettings.welcomeText, phone)
                    : `👋 *WELCOME TO THE GROUP!*\n\n` +
                      `Welcome @${phone} 🎉\n\n` +
                      `🤝 Respect other members.\n` +
                      `🚫 No spam or unauthorized links.\n` +
                      `❤️ Enjoy your stay!`;

                try {

                    if (image) {

                        await sock.sendMessage(
                            groupId,
                            {
                                image: {
                                    url: image
                                },
                                caption,
                                mentions: [jid]
                            }
                        );

                    } else {

                        await sock.sendMessage(
                            groupId,
                            {
                                text: caption,
                                mentions: [jid]
                            }
                        );
                    }

                } catch (error) {

                    console.error(
                        '[WELCOME SEND ERROR]',
                        error
                    );
                }
            }
        }

        /*
        |--------------------------------------------------------------------------
        | GOODBYE
        |--------------------------------------------------------------------------
        */

        if (
            (
                event.action === 'remove' ||
                event.action === 'leave'
            ) &&
            groupSettings.goodbye === true
        ) {

            const participants =
                event.participants || [];

            for (const participant of participants) {

                const jid =
                    normalizeJid(participant);

                const phone =
                    phoneFromJid(jid);

                const text = groupSettings.goodbyeText
                    ? fill(groupSettings.goodbyeText, phone)
                    : `👋 *GOODBYE*\n\n` +
                      `@${phone} has left the group.\n\n` +
                      `We wish them all the best. ❤️`;

                try {

                    await sock.sendMessage(
                        groupId,
                        {
                            text,
                            mentions: [jid]
                        }
                    );

                } catch (error) {

                    console.error(
                        '[GOODBYE SEND ERROR]',
                        error
                    );
                }
            }
        }
    }
};
