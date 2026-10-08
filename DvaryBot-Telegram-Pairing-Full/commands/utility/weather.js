'use strict';

const https = require('https');

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';

            res.on('data', chunk => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', reject);
    });
}

module.exports = {
    name: 'weather',
    category: 'utility',
    aliases: ['hali'],
    description: 'Check weather information',
    usage: '.weather Mwanza',
    ownerOnly: false,
    cooldown: 10,

    async execute(ctx) {
        const reply = async (text) => {
            await ctx.sock.sendMessage(
                ctx.from,
                { text: String(text) },
                { quoted: ctx.msg }
            );
        };

        try {
            const city = Array.isArray(ctx.args)
                ? ctx.args.join(' ').trim()
                : '';

            if (!city) {
                return reply(
                    '❌ Weka jina la mji.\n\n' +
                    'Mfano:\n' +
                    '`.weather Mwanza`'
                );
            }

            const apiKey = process.env.WEATHER_API_KEY;

            if (!apiKey) {
                return reply(
                    '❌ WEATHER_API_KEY haijawekwa kwenye `.env`.'
                );
            }

            const url =
                `https://api.openweathermap.org/data/2.5/weather` +
                `?q=${encodeURIComponent(city)}` +
                `&appid=${apiKey}` +
                `&units=metric`;

            const data = await fetchJson(url);

            if (data.cod !== 200) {
                return reply(
                    `❌ Hali ya hewa ya "${city}" haikupatikana.`
                );
            }

            const temp = Math.round(data.main.temp);
            const feels = Math.round(data.main.feels_like);
            const humidity = data.main.humidity;
            const description = data.weather?.[0]?.description || 'Unknown';

            return reply(
                `╭━━━〔 🌤️ WEATHER 〕━━━╮\n` +
                `┃\n` +
                `┃ 📍 City: ${data.name}\n` +
                `┃ 🌡️ Temperature: ${temp}°C\n` +
                `┃ 🤗 Feels like: ${feels}°C\n` +
                `┃ 💧 Humidity: ${humidity}%\n` +
                `┃ ☁️ Condition: ${description}\n` +
                `┃\n` +
                `╰━━━━━━━━━━━━━━━━━━╯`
            );

        } catch (error) {
            console.error('[WEATHER ERROR]', error);
            return reply(
                `❌ Weather failed.\n\n${error?.message || error}`
            );
        }
    }
};
