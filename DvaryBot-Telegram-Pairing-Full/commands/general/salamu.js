'use strict';

const defineCommand = require('../../utils/cmdKit');

module.exports = defineCommand({
    name: 'salamu',
    category: 'general',
    aliases: [],
    description: 'Swahili greeting based on the time of day',
    usage: 'salamu',
    needsInput: false,
    lines: false,
    run: ({ ctx }) => {
        const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Dar_es_Salaam', hour: '2-digit', hour12: false }).format(new Date())) % 24;
        const g = h >= 4 && h < 12 ? 'Habari za asubuhi' : h < 16 ? 'Habari za mchana' : h < 19 ? 'Habari za jioni' : 'Habari za usiku';
        const name = (ctx && ctx.msg && ctx.msg.pushName) || '';
        return `👋 *${g}${name ? ', ' + name : ''}!*\n\nKaribu. Andika ${ctx.prefix || '.'}menu kuona amri zote.`;
    }
});
