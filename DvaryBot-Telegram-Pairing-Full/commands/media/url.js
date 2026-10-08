'use strict';

const axios = require('axios');
const FormData = require('form-data');
const {
    downloadContentFromMessage
} = require('../../bot/baileys').get();

module.exports = {
    name: 'url',
    category: 'media',
    aliases: ['tourl', 'imgurl'],

    description: 'Convert replied image to URL',
    usage: '.url',

    ownerOnly: false,
    cooldown: 5,

    async execute(ctx) {

        const { sock, msg, from, prefix = '.' } = ctx;

        const reply = async (text) => {
            return sock.sendMessage(
                from,
                { text: String(text) },
                { quoted: msg }
            );
        };

        try {

            // ==============================
            // GET QUOTED MESSAGE
            // ==============================

            const context =
                msg?.message?.extendedTextMessage?.contextInfo ||
                msg?.message?.imageMessage?.contextInfo ||
                msg?.message?.videoMessage?.contextInfo;

            let quoted = context?.quotedMessage;

            if (!quoted) {
                return reply(
                    `❌ *Reply to an image first.*\n\n` +
                    `Example:\n` +
                    `Reply to an image with *${prefix}url*`
                );
            }

            // ==============================
            // HANDLE WRAPPERS
            // ==============================

            if (quoted.ephemeralMessage?.message) {
                quoted = quoted.ephemeralMessage.message;
            }

            if (quoted.viewOnceMessage?.message) {
                quoted = quoted.viewOnceMessage.message;
            }

            if (quoted.viewOnceMessageV2?.message) {
                quoted = quoted.viewOnceMessageV2.message;
            }

            if (quoted.viewOnceMessageV2Extension?.message) {
                quoted = quoted.viewOnceMessageV2Extension.message;
            }

            // ==============================
            // FIND IMAGE
            // ==============================

            const imageMessage = quoted.imageMessage;

            if (!imageMessage) {
                return reply(
                    `❌ *Image not found.*\n\n` +
                    `Reply directly to an image and send *${prefix}url*.`
                );
            }

            await reply('⏳ *Downloading image...*');

            // ==============================
            // DOWNLOAD IMAGE
            // ==============================

            const stream = await downloadContentFromMessage(
                imageMessage,
                'image'
            );

            const chunks = [];

            for await (const chunk of stream) {
                chunks.push(chunk);
            }

            const buffer = Buffer.concat(chunks);

            if (!buffer.length) {
                return reply('❌ Failed to download the image.');
            }

            // ==============================
            // UPLOAD TO CATBOX
            // ==============================

            await reply('☁️ *Uploading image...*');

            const form = new FormData();

            form.append('reqtype', 'fileupload');

            form.append(
                'fileToUpload',
                buffer,
                {
                    filename: 'dvary.jpg',
                    contentType: imageMessage.mimetype || 'image/jpeg'
                }
            );

            const response = await axios.post(
                'https://catbox.moe/user/api.php',
                form,
                {
                    headers: {
                        ...form.getHeaders(),
                        'User-Agent': 'DVARY-BOT/1.0'
                    },

                    timeout: 120000,

                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                }
            );

            const url = String(response.data || '').trim();

            // ==============================
            // CHECK RESPONSE
            // ==============================

            if (
                !url ||
                !url.startsWith('https://files.catbox.moe/')
            ) {
                console.error(
                    '[CATBOX RESPONSE]',
                    response.data
                );

                return reply(
                    `❌ *Upload failed.*\n\n` +
                    `Server response:\n${url || 'Empty response'}`
                );
            }

            // ==============================
            // SUCCESS
            // ==============================

            return reply(
                `✅ *IMAGE URL*\n\n` +
                `${url}\n\n` +
                `━━━━━━━━━━━━━━━━\n` +
                `🚀 *DVARY BOT*`
            );

        } catch (error) {

            console.error(
                '[URL COMMAND ERROR]',
                error
            );

            return reply(
                `❌ *URL Error*\n\n` +
                `${error?.response?.data || error?.message || error}`
            );
        }
    }
};
