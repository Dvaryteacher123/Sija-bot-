'use strict';

const logger = require('../utils/logger');
const Setting = require('../database/models/Setting');


/*
|--------------------------------------------------------------------------
| CHECK AUTO STATUS
|--------------------------------------------------------------------------
*/

async function isAutoStatusEnabled(
    sessionId,
    userId
) {

    try {

        const settings =
            await Setting.getOrCreate(
                sessionId,
                userId
            );

        return (
            settings?.metadata?.autoStatus === true
        );

    } catch (error) {

        logger?.warn?.(
            '[AUTO STATUS SETTINGS ERROR]',
            error?.message || error
        );

        return false;
    }
}


/*
|--------------------------------------------------------------------------
| VIEW STATUS
|--------------------------------------------------------------------------
*/

async function viewStatus(
    sock,
    statusMessage
) {

    try {

        if (!sock) {
            return false;
        }

        if (!statusMessage) {
            return false;
        }


        const key =
            statusMessage.key ||
            statusMessage;


        if (!key) {
            return false;
        }


        /*
        |--------------------------------------------------------------------------
        | STATUS MESSAGE MUST BE BROADCAST
        |--------------------------------------------------------------------------
        */

        const remoteJid =
            key.remoteJid;


        if (
            remoteJid !==
            'status@broadcast'
        ) {
            return false;
        }


        /*
        |--------------------------------------------------------------------------
        | MARK AS READ / VIEWED
        |--------------------------------------------------------------------------
        |
        | Baileys versions differ.
        | Try readMessages first.
        |
        */

        if (
            typeof sock.readMessages ===
            'function'
        ) {

            try {

                await sock.readMessages([
                    key
                ]);

                return true;

            } catch (error) {

                logger?.warn?.(
                    '[STATUS READ ERROR]',
                    error?.message || error
                );
            }
        }


        /*
        |--------------------------------------------------------------------------
        | FALLBACK
        |--------------------------------------------------------------------------
        */

        if (
            typeof sock.chatModify ===
            'function'
        ) {

            try {

                await sock.chatModify(
                    {
                        markRead: [
                            key
                        ]
                    },
                    'status@broadcast'
                );

                return true;

            } catch (error) {

                logger?.warn?.(
                    '[STATUS CHAT MODIFY ERROR]',
                    error?.message || error
                );
            }
        }


        return false;

    } catch (error) {

        logger?.warn?.(
            '[STATUS VIEW ERROR]',
            error?.message || error
        );

        return false;
    }
}


/*
|--------------------------------------------------------------------------
| HANDLE STATUS UPDATE
|--------------------------------------------------------------------------
*/

async function handleStatusUpdate({
    sock,
    messages,
    sessionId,
    userId
}) {

    if (!sock) {
        return;
    }


    /*
    |--------------------------------------------------------------------------
    | CHECK SETTING
    |--------------------------------------------------------------------------
    */

    const enabled =
        await isAutoStatusEnabled(
            sessionId,
            userId
        );


    if (!enabled) {
        return;
    }


    /*
    |--------------------------------------------------------------------------
    | NORMALIZE MESSAGES
    |--------------------------------------------------------------------------
    */

    let list = [];


    if (
        Array.isArray(messages)
    ) {

        list = messages;

    } else if (
        Array.isArray(
            messages?.messages
        )
    ) {

        list =
            messages.messages;

    } else if (
        messages
    ) {

        list = [
            messages
        ];
    }


    /*
    |--------------------------------------------------------------------------
    | VIEW EACH STATUS
    |--------------------------------------------------------------------------
    */

    for (
        const message of list
    ) {

        try {

            const key =
                message?.key;


            if (
                key?.remoteJid !==
                'status@broadcast'
            ) {
                continue;
            }


            const viewed =
                await viewStatus(
                    sock,
                    message
                );


            if (viewed) {

                logger?.info?.(
                    `[AUTO STATUS] Viewed status for session ${sessionId}`
                );
            }

        } catch (error) {

            logger?.warn?.(
                '[AUTO STATUS MESSAGE ERROR]',
                error?.message || error
            );
        }
    }
}


module.exports = {
    isAutoStatusEnabled,
    viewStatus,
    handleStatusUpdate
};
