# MAREKEBISHO (DvaryBot-Fast)

## 1. Kwa nini bot ilikuwa ina-disconnect / kuzimika
| Tatizo lililokuwepo | Marekebisho |
|---|---|
| Mtandao ukikatika, session iliwekwa `isActive:false` → bot ikirestart HAIWEZI kuzipakia tena (zilibaki disconnected milele) | Session haizimwi tena isipokuwa ukilogout mwenyewe. Zote zinarudi zenyewe baada ya restart |
| Heap ya Node ilikuwa 2GB tu (`--max-old-space-size=2048`) → bot ilikufa baada ya ~23h ikijaza memory | Sasa inajipima yenyewe: 75% ya RAM ya VPS (au weka `NODE_MAX_HEAP_MB` kwenye .env) |
| Kila session ilihifadhi ujumbe 500 kwenye memory (×700 = GB nyingi) | Sasa 40 (`WA_STORE_LIMIT`) |
| Logger ya Baileys ilikuwa `info` → mamilioni ya logs, CPU na disk | Sasa `silent` (`WA_LOG_LEVEL`) |
| Health-check ilipiga query WhatsApp kila session kila dakika 3 (700 sessions = mzigo + false disconnect) | Sasa ni check nyepesi ya WebSocket tu |
| Database ya faili iliandika faili zima kila sekunde 1.5 (ilizuia event loop → keep-alive inashindwa) | Inaandika kwa async kila sekunde 8 (`DB_FLUSH_MS`) |
| Reconnect ilikuwa polepole (5s+ na hadi 60s) | Inaanza 1s, max 30s, inajaribu milele; 515 inarudi papo hapo |
| Session iliyokwama (haina socket wala timer) ilibaki chini | Sweeper ya kila dakika 2 inaziamsha (`ensureAlive`) |
| Version ya WhatsApp ilifetchiwa kwa kila session kila reconnect | Inafetchiwa mara moja na kuhifadhiwa masaa 6 |
| Hakukuwa na `getMessage` → retry za WhatsApp zilishindwa | Imeongezwa |

## 2. Menu haisemi "wait" tena
- Ujumbe wa "⏳ Subiri sekunde..." umeondolewa kabisa (spam inapuuzwa kimya).
- `menu`, `help`, `ping`, `alive`, `owner` hazina cooldown.
- Kikomo cha flood: amri 30 kwa sekunde 10 kwa kila mtu (`FLOOD_MAX_COMMANDS`).

## 3. Commands mpya (72) — zote kwenye `.menu media`
**Sauti (28):** bass, deepvoice, demon, chipmunk, nightcore, slowed, slowedreverb, speedup, slowaudio, reverseaudio, echoaudio, robotvoice, vibrato, tremolo, telephone, radio, muffle, treble, widen, eightd, normalize, fadein, karaoke, ringtone, loud, audiospeed, pitch, trimaudio
**Video (17):** mutevideo, reversevideo, slowvideo, fastvideo, videospeed, videogray, videomirror, videoflip, videoinvert, videosepia, videoblur, squarevideo, lowres, boomerang, asgif, trimvideo, framegrab
**Picha/Sticker (24):** sepia, invert, flipv, fliph, rotate, sharpen, pixelate, brighten, darken, vivid, contrast, tint, frame, resizeimg, mirrorimg, emboss, edges, warm, cool, vignette, bwhard, imginfo, toimg, take
**Muziki (3):** ytmp3, ytmp4 (alias video), ytsearch

Jinsi ya kutumia: reply audio/video/picha kisha andika mfano `.bass`, `.pitch 4`, `.trimaudio 10 30`, `.rotate 90`, `.ytmp3 diamond platnumz`.
Hazitumi ujumbe wa "wait" — zinaonyesha tu "typing/recording". Kazi nzito za ffmpeg zinapangwa foleni (`FFMPEG_CONCURRENCY=3`) ili VPS isijaze.

## 4. Autotyping na Antimention
- `.autotyping on/off/status` — ilikuwepo, inafanya kazi.
- `.antimention on/off` (kwenye group) — imeboreshwa: sasa inaona mention kwenye picha/video/caption pia, si maandishi tu. **Bot lazima iwe admin ya group** ili ifute ujumbe.

## 5. Jinsi ya kuendesha
1. Futa zip ya zamani, weka hii, `npm install` (au acha panel ifanye).
2. Angalia `.env` (mistari mipya chini kabisa). `NODE_MAX_HEAP_MB` tupu = auto.
3. VPS: `npm i -g pm2 && pm2 start ecosystem.config.js && pm2 save && pm2 startup` (inarudisha bot ikizima).
4. Sasisha Baileys mara kwa mara: `npm i @whiskeysockets/baileys@latest` (WhatsApp hubadilika, toleo la zamani hukatika).
5. **Muhimu:** `data/` (auth + db) lazima ibaki kwenye disk ya kudumu — usiifute wakati wa update.

---

## 6. Menu: "Dvary loading...." kwanza
- `.menu` sasa inatuma **⏳ Dvary loading....** kwanza, kisha (baada ya ~0.7s) menu yenyewe inafuata.
- Ujumbe mwepesi wa kwanza unasaidia kuzuia "Waiting for this message" kwa sababu unafungua session na mtumiaji kabla ya picha nzito.
- Badilisha kwenye `.env`: `MENU_LOADING_TEXT`, `MENU_LOADING_DELAY_MS` (0 = bila kuchelewa).
- `.menu group` (category) haitumi loading — ni ujumbe mdogo.

## 7. Commands mpya 50 za GROUP (`commands/group/`)
Zinatumia `utils/groupKit.js` (inaangalia admin/bot-admin yenyewe, hakuna haja ya kuhariri `messages.js`).

**Taarifa:** desc, membercount, members, groupowner, groupcreated, groupstats, groupsettings, groupid, botadmin, linkinfo, whois, isadmin
**Link/Mwaliko:** link, revoke, sendinvite
**Settings:** setdesc, disappear, lockinfo, unlockinfo, addmode, joinapproval, closetime, opentime
**Maombi ya kujiunga:** requests, approve, reject, approveall, rejectall
**Picha ya group:** setppgc, removepp, getgpp
**Maonyo (warn):** warn, unwarn, warnings, resetwarn, setwarnlimit (kikomo cha kawaida 3 -> anaondolewa)
**Sheria:** setrules, rules
**Mute:** mutelist, unmuteall
**Tag/Ripoti:** tagmembers, tagadmins, report
**Michezo/Kura:** poll, randommember, randomadmin, couple
**Owner tu:** leave, join, creategroup

Mfano: `.warn @user spam` · `.closetime 30m` · `.poll Chakula? | Wali | Chips` · `.setwarnlimit 5` · `.approveall`
Kumbuka: bot iwe **admin** kwenye group kwa amri zinazobadilisha group. `closetime`/`opentime` zinatumia timer ya memory (zinapotea bot ikirestart).

---

## 8. "Waiting for this message" - chanzo na dawa
**Chanzo:** WhatsApp ikishindwa kufungua ujumbe wa bot, huomba bot iutume tena (retry). Bot ilikuwa inahifadhi ujumbe ULIOINGIA tu (40) na haikuhifadhi ujumbe ILIOUTUMA (`emitOwnEvents:false`). Kwa hiyo `getMessage` ilirudisha tupu, retry ilishindwa, na ujumbe ukabaki "Waiting for this message" milele.
**Dawa:** Kila ujumbe bot inaotuma sasa unahifadhiwa (`WA_SENT_LIMIT`, kawaida 300 kwa session), na `getMessage` unaupata. Files: `bot/throttle.js`, `bot/connection.js`.
**Kama bado inatokea kwa session fulani:** funga session hiyo (logout) kisha pair upya ili keys mpya zitengenezwe. Pia sasisha Baileys: `npm i @whiskeysockets/baileys@latest`.


---

## 9. Group commands: sasa zote ni English + amri 50 MPYA (kila moja ina emoji)
**Kilichobadilishwa (Kiswahili -> English):** ujumbe, maelezo (description) na usage za amri zote za group (`commands/group/*.js`), `utils/groupKit.js`, `utils/duration.js`, na ujumbe wa welcome/goodbye kwenye `events/groupParticipants.js`. Aliases za Kiswahili (`sheria`, `onyo`, `funga`, `fungua`, `kura`, `alika`, `wapenzi`, `mtuyeyote`, `ripoti`) zimebaki ili watumiaji wa zamani wasipate shida.

**Emoji kwenye menu:** `.menu group` (na `.menu`) sasa inaonyesha emoji mbele ya kila amri ya group, mfano `┃ 🍾 .spin`. Amri mpya zinaweka `emoji` zenyewe; za zamani ziko `utils/groupEmojis.js`.

**Marekebisho madogo:** `.kick` sasa ina-mention mtu vizuri; `.groupsettings` sasa inaonyesha hali sahihi ya welcome/goodbye.

### Amri 50 mpya
**Michezo/Furaha (21):** 🍾 spin · 🎭 tod · 💞 lovepair · 👋 slap · 🤗 hug · ✋ highfive · 🌟 praise · 🔥 roastmember · 🤔 mostlikely · ✨ vibecheck · 🏅 memberoftheday · 🎅 secretsanta · ⚽ splitteams · 🎲 tagrandom · 🎂 wishbday · 🎉 congrats · 🙏 thankyou · 👍 yesno · ⭐ ratethis · 🎟️ raffle · 🧊 icebreaker
**Taarifa (7):** 🌍 countrystats · 📞 listcode · 📣 tagcode · 🚨 topwarned · 🪪 myrole · 📄 exportmembers · 📇 vcf
**Siku za kuzaliwa (2):** 🎈 setbirthday · 🎂 birthdays
**Admin (8):** 🌍 kickcode · ⬇️ demoteall · 🚨 lockdown · ✅ liftlockdown · ⏱️ tempmute · 🚪 kickme · 📢 announce · ⏰ remindall
**Sheria (3):** 📌 addrule · ✂️ delrule · 🧹 clearrules
**Notes (4):** 🗒️ setnote · 📖 note · 📚 notes · 🗑️ delnote
**Welcome/Goodbye maalum (2):** 💬 setwelcome · 👋 setgoodbye  (tumia `{user}` `{group}` `{count}`; kisha `.welcome on` / `.goodbye on`)
**Blacklist (3):** ⛔ blacklist · ✅ unblacklist · 📋 blacklisted  (namba iliyowekwa blacklist ikijiunga tena inaondolewa yenyewe)

Mifano: `.kickcode 212` (inaonyesha idadi kwanza, kisha `.kickcode 212 confirm`) · `.tempmute @user 30m` · `.setwelcome Karibu {user} kwenye {group}!` · `.remindall 1h Mkutano unaanza` · `.raffle 3 Zawadi` · `.setbirthday 25/12`
Kumbuka: `tempmute` na `remindall` zinatumia timer ya memory (zinapotea bot ikirestart). Amri zinazobadilisha group zinahitaji bot iwe **admin**.

---

## 8. v7: Antilink + Menu
- Antilink: aliyepair bot hafutwi; bot inajitambua admin hata kwenye group za LID; inaangalia links kwenye caption/edited/view-once; cache ya sekunde 20 ya metadata ya group.
- `.menu` inatuma **⏳ Dvary loading....** kwanza kisha menu (`MENU_LOADING_TEXT`, `MENU_LOADING_DELAY_MS` kwenye .env).

---

## 8. v8 — Auto-restart + picha ya menu (Pterodactyl)
- `server.js` sasa ina **supervisor**: bot ikifa (out-of-memory/crash) inawashwa tena yenyewe baada ya sekunde 2-15. Haihitaji PM2. Ukibonyeza Stop kwenye panel inasimama kawaida.
- `.env`: `MENU_WITH_IMAGE=true` (picha ya menu inatumwa tena).
- `public/images/menu.jpg` imepunguzwa (233KB -> 66KB, 900x600) ili menu itoke haraka. Kubadilisha picha: upload picha yako kwa jina `menu.jpg` kwenye `public/images/`.
- Pterodactyl: weka `NODE_MAX_HEAP_MB` chini ya RAM ya server (mfano RAM 1GB -> 800). Usifute folda `data/` unapo-update.

## 9. v9 — Picha na menu pamoja
- `.menu` sasa inatuma **picha + menu kwenye ujumbe MMOJA** (caption fupi: kichwa + categories + usage).
- Orodha ya amri za category: `.menu media`, `.menu group`, n.k.
- `.menu all` = orodha kamili (picha na kichwa, kisha list kamili kama text, kwa sababu ni ndefu mno kutoshea kwenye caption).

## 10. v10 — Header mpya + picha ya kila category
- Juu ya menu sasa: **Prefix, Owner, User, Commands, Node** (prefix inatoka kwenye setting ya session; owner kutoka `BOT_OWNER`).
- **User**: aliyepair bot anaona jina la WhatsApp account yake; mtu mwingine (hajapair) anaona jina lake mwenyewe (pushName), au namba kama hana jina.
- Kila `.menu <category>` inakuja na **picha**. Picha ya category maalum: weka `public/images/menu-<category>.jpg`
  (mfano `menu-media.jpg`, `menu-group.jpg`, `menu-fun.jpg`, `menu-utility.jpg`, `menu-owner.jpg`, `menu-general.jpg`).
  Isipokuwepo, inatumika `menu.jpg`.
- Maandishi marefu yanagawanywa yenyewe. `MENU_CAPTION_MAX=1000` ikiwa picha na maandishi marefu hazitumwi.

---

## 11. v11 — "Online lakini haijibu" + amri 10 za muziki
- **Uchunguzi:** weka `WA_DEBUG=true` kwenye `.env`, restart. Kila ujumbe unaoingia unaonekana kwenye console kama `[RX] ...`.
  - Ukiona `[RX]` lakini hakuna `[COMMAND]` -> prefix/mode/ban ndio tatizo.
  - Ukiona `[DECRYPT] ... NO content` -> keys za session zimeharibika (Bad MAC): fanya logout ya session hiyo kisha pair upya.
  - Usipoona `[RX]` kabisa -> ujumbe haufiki: Baileys ni ya zamani, au session hiyo hiyo inatumika sehemu nyingine (Render/Replit/PC) -> zima huko.
- Makosa ya message handler hayafichwi tena (`[MESSAGE WORKER ERROR]`).
- `server.js`: heap haizidi 80% ya RAM ya panel (kabla ilikuwa kima cha chini 1024MB, kwenye server ndogo Pterodactyl ilikuwa inaua process kila mara -> reconnect bila kikomo).
- **Amri 10 mpya za muziki** (`.menu media`), zinatumia Deezer + lyrics.ovh (hazihitaji yt-dlp/python):
  lyrics, preview, topsongs, artist, album, charts, similar, songinfo, randomsong, genre
