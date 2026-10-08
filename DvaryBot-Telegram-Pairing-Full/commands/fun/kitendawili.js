'use strict';

const defineCommand = require('../../utils/cmdKit');

module.exports = defineCommand({
    name: 'kitendawili',
    category: 'fun',
    aliases: [],
    description: 'Swahili riddles: .kitendawili, then .kitendawili jibu <no>',
    usage: 'kitendawili',
    needsInput: false,
    lines: false,
    run: ({ args, prefix }) => {
        const R = [
            ['Nina meno mengi lakini siumi. Mimi ni nani?', 'Kitana (comb)'],
            ['Nakimbia bila miguu na sichoki. Mimi ni nani?', 'Mto / maji (river / water)'],
            ['Nina mikono miwili lakini siwezi kushika chochote; nakwambia wakati.', 'Saa (clock)'],
            ['Kadiri unavyochukua kutoka kwangu ndivyo ninavyokuwa kubwa. Mimi ni nini?', 'Shimo (hole)'],
            ['Nina funguo nyingi lakini siwezi kufungua mlango. Mimi ni nini?', 'Kibodi / piano (keyboard / piano)'],
            ['Nina miji lakini hakuna nyumba, nina milima lakini hakuna miti, nina maji lakini hakuna samaki.', 'Ramani (map)'],
            ['Ukinitaja jina langu, nakuvunjika. Mimi ni nini?', 'Ukimya (silence)'],
            ['Nikilishwa nakua, nikinyweshwa maji nakufa. Mimi ni nini?', 'Moto (fire)'],
            ['Nina kichwa na mkia lakini sina mwili. Mimi ni nini?', 'Sarafu (coin)'],
            ['Nikiwa mzima siwezi kutumika, nikivunjwa ndipo nafaa. Mimi ni nini?', 'Yai (egg)']
        ];
        if (String(args[0] || '').toLowerCase() === 'jibu') {
            const n = parseInt(args[1], 10);
            if (!n || n < 1 || n > R.length) throw new Error(`Usage: ${prefix}kitendawili jibu <1-${R.length}>`);
            return `✅ *JIBU #${n}*\n\n${R[n - 1][1]}`;
        }
        const i = Math.floor(Math.random() * R.length);
        return `🧩 *KITENDAWILI #${i + 1}*\n\n${R[i][0]}\n\n💡 Jibu: ${prefix}kitendawili jibu ${i + 1}`;
    }
});
