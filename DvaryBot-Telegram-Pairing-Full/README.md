<div align="center">

<img src="https://files.catbox.moe/lqm1lg.jpg" alt="Dvary Bot Banner" width="100%" />

# ⚡ Dvary Bot

### Multi-User WhatsApp Bot · Powered by Baileys + MongoDB

[![Version](https://img.shields.io/badge/version-1.0.0-blueviolet?style=for-the-badge)](https://github.com/)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![License](https://img.shields.io/badge/license-MIT-ff69b4?style=for-the-badge)](LICENSE)
[![Deploy](https://img.shields.io/badge/Deploy-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://render.com/)

**A modern, elegant, multi-user WhatsApp bot with web pairing panel, MongoDB session storage, and 60+ powerful commands.**

[Features](#-features) · [Installation](#-installation) · [Deployment](#-deployment) · [Commands](#-commands) · [Environment](#-environment-variables) · [Credits](#-credits)

</div>

---

## 📖 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Requirements](#-requirements)
- [Installation](#-installation)
- [Environment Variables](#-environment-variables)
- [Deployment](#-deployment)
  - [1. Deploy on Render](#1-deploy-on-render-recommended)
  - [2. Deploy on Koyeb](#2-deploy-on-koyeb)
  - [3. Deploy on Railway](#3-deploy-on-railway)
  - [4. Deploy on VPS](#4-deploy-on-vps-ubuntu)
  - [5. Run Locally](#5-run-locally)
- [Commands](#-commands)
- [Folder Structure](#-folder-structure)
- [Troubleshooting](#-troubleshooting)
- [Credits](#-credits)
- [License](#-license)

---

## ✨ Features

- 🔐 **Multi-User Sessions** — Each user gets an isolated session with a unique `sessionId`
- 💾 **MongoDB Auth Storage** — Baileys credentials are stored securely in MongoDB Atlas
- 🌐 **Web Pairing Panel** — Link your WhatsApp via QR Code or Pair Code, right from the browser
- 🔄 **Auto Reconnect** — Sessions automatically reconnect after restarts
- 🛡️ **Ban & Block System** — Protect your bot from abuse
- ⏱️ **Rate Limiting** — Built-in protection against spam
- 🎨 **Elegant Dashboard** — Real-time session monitoring with beautiful animations
- ⚡ **60+ Commands** — Media tools, group management, utilities, and owner controls
- 🌍 **Multi-Language Support** — Translate command supports all Google Translate languages
- 🔒 **Session Isolation** — Users can only manage their own sessions

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js 18+ |
| **WhatsApp Library** | [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) |
| **Database** | MongoDB Atlas (Mongoose) |
| **Web Framework** | Express.js |
| **View Engine** | EJS (inline CSS) |
| **Realtime** | Socket.IO |
| **Media Tools** | FFmpeg, Sharp, wa-sticker-formatter |
| **Session Store** | connect-mongo |

---

## 📋 Requirements

Before you begin, make sure you have:

- ✅ **Node.js v18 or higher** — [Download](https://nodejs.org/)
- ✅ **MongoDB Atlas account** — [Free](https://www.mongodb.com/atlas)
- ✅ **Git** installed on your machine
- ✅ A phone number to link to WhatsApp (not required for deployment — linking happens on the web panel)

---

## 🚀 Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/dvary-bot.git
cd dvary-bot
```

### Step 2: Install Dependencies

```bash
npm install
```

> ⚠️ If you get a `jimp` peer dependency error, this project already includes `.npmrc` with `legacy-peer-deps=true`. If not, run:
> ```bash
> npm install --legacy-peer-deps
> ```

### Step 3: Setup MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas) → **Sign up** (free)
2. Create a **free M0 cluster**
3. **Database Access** → Add a new user (username + password)
4. **Network Access** → Add IP Address → **Allow Access from Anywhere** (`0.0.0.0/0`)
5. **Connect** → **Drivers** → Copy your connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/Dvarycommunication?retryWrites=true&w=majority
   ```

### Step 4: Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in the values — see [Environment Variables](#-environment-variables).

### Step 5: Run the Bot

```bash
npm start
```

Then open: **http://localhost:3000/pair**

---

## 🔐 Environment Variables

Create a `.env` file in the root directory with the following variables:

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment (`development` / `production`) | `development` |
| `BASE_URL` | Public URL of your app | `http://localhost:3000` |
| `SESSION_SECRET` | Secret for web session cookies | — |
| `JWT_SECRET` | Secret for JWT tokens | — |
| `MONGO_URI` | MongoDB Atlas connection string | — |
| `MONGO_DB_NAME` | Database name | `Dvarycommunication` |
| `MONGO_SESSION_COLLECTION` | Collection for Baileys auth | `sessions` |
| `BOT_NAME` | Display name | `Dvary` |
| `BOT_VERSION` | Bot version | `1.0.0` |
| `BOT_OWNER` | Owner name | `Dvary` |
| `OWNER_NUMBER` | Owner phone number (no `+`) | — |
| `DEFAULT_PREFIX` | Default command prefix | `.` |
| `BOT_MODE` | `public` / `private` / `group` | `public` |
| `BOT_TIMEZONE` | Timezone | `Africa/Dar_es_Salaam` |
| `OWNER_USERNAME` | Web panel owner username | `owner` |
| `OWNER_PASSWORD` | Web panel owner password | — |
| `MULTI_USER_ENABLED` | Allow multi-user sessions | `true` |
| `MAX_SESSIONS_PER_USER` | Session limit per user | `10` |
| `WA_KEEPALIVE_INTERVAL` | Baileys keepalive (ms) | `25000` |
| `WA_CONNECT_TIMEOUT` | Connection timeout (ms) | `90000` |
| `WA_QUERY_TIMEOUT` | Query timeout (ms) | `90000` |
| `RATE_LIMIT_WINDOW` | Rate limit window (ms) | `900000` |
| `RATE_LIMIT_MAX` | Max requests per window | `200` |
| `PAIR_RATE_LIMIT_MAX` | Max pair attempts per window | `10` |
| `LOG_LEVEL` | Logging level | `info` |

---

## ☁️ Deployment

### 1. Deploy on **Render** (Recommended)

**Render** is the easiest way to deploy — free tier available.

#### 📍 Where: [render.com](https://render.com/)

**Steps:**

1. **Push your code to GitHub** (make sure `.env` is NOT pushed — it's in `.gitignore`)

2. Go to [render.com](https://render.com/) → **Sign up with GitHub**

3. Click **New +** → **Web Service**

4. Connect your GitHub repo (`dvary-bot`)

5. Configure:

   | Setting | Value |
   |---|---|
   | **Name** | `dvary-bot` (or any name) |
   | **Region** | Choose closest to you |
   | **Branch** | `main` |
   | **Runtime** | `Node` |
   | **Build Command** | `npm install` |
   | **Start Command** | `npm start` |
   | **Instance Type** | `Free` (or Starter for 24/7) |

6. **Scroll down to Environment Variables** — add these one by one:

   ```
   PORT=3000
   NODE_ENV=production
   BASE_URL=https://your-app-name.onrender.com
   SESSION_SECRET=your_random_secret_here
   JWT_SECRET=your_random_secret_here
   MONGO_URI=mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/Dvarycommunication?retryWrites=true&w=majority
   MONGO_DB_NAME=Dvarycommunication
   BOT_NAME=Dvary
   BOT_OWNER=YourName
   OWNER_NUMBER=2557xxxxxxxx
   OWNER_USERNAME=owner
   OWNER_PASSWORD=YourStrongPassword
   MULTI_USER_ENABLED=true
   MAX_SESSIONS_PER_USER=10
   WA_KEEPALIVE_INTERVAL=25000
   WA_CONNECT_TIMEOUT=90000
   WA_QUERY_TIMEOUT=90000
   ```

7. Click **Create Web Service**

8. Wait ~3 minutes for the deploy. Once done, your app will be live at:
   ```
   https://your-app-name.onrender.com
   ```

#### ⚠️ Important for Render Free Tier

**Render free tier sleeps after 15 minutes of inactivity.** To prevent this:

1. Go to [uptimerobot.com](https://uptimerobot.com/) → Sign up free
2. **Add New Monitor** → HTTP(s)
3. URL: `https://your-app-name.onrender.com/api/health`
4. Interval: **5 minutes**
5. Save

This keeps your bot awake 24/7.

---

### 2. Deploy on **Koyeb**

**Koyeb** offers a free tier with **no sleep**.

#### 📍 Where: [koyeb.com](https://www.koyeb.com/)

**Steps:**

1. Sign up at [koyeb.com](https://www.koyeb.com/) with GitHub
2. Click **Create Service** → **GitHub**
3. Select your repo
4. Configure:
   - **Builder**: Buildpack
   - **Run command**: `npm start`
   - **Port**: `3000`
5. Add **Environment Variables** (same as Render list above)
6. Click **Deploy**

Your app will be at: `https://your-app.koyeb.app`

---

### 3. Deploy on **Railway**

#### 📍 Where: [railway.app](https://railway.app/)

**Steps:**

1. Sign up at [railway.app](https://railway.app/) with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repo
4. Go to **Variables** tab → add all env vars
5. Railway auto-detects Node and runs `npm start`
6. Go to **Settings** → **Networking** → **Generate Domain**

Your app will be at: `https://your-app.up.railway.app`

⚠️ Railway is **not free** ($5 credit/month). If you exceed, you'll be charged.

---

### 4. Deploy on **VPS (Ubuntu)**

Best for **permanent hosting** with full control.

#### 📍 Where: Any VPS provider — [DigitalOcean](https://www.digitalocean.com/), [Contabo](https://contabo.com/), [Vultr](https://www.vultr.com/), [Hetzner](https://www.hetzner.com/)

**Steps:**

```bash
# 1. SSH into your VPS
ssh root@your-server-ip

# 2. Update system
apt update && apt upgrade -y

# 3. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 4. Install Git, FFmpeg, PM2
apt install -y git ffmpeg
npm install -g pm2

# 5. Clone your project
cd /root
git clone https://github.com/YOUR_USERNAME/dvary-bot.git
cd dvary-bot

# 6. Install dependencies
npm install --legacy-peer-deps

# 7. Create .env file
nano .env
# (paste your environment variables, then Ctrl+X → Y → Enter)

# 8. Start with PM2
pm2 start server.js --name dvary-bot

# 9. Make it auto-start on reboot
pm2 startup
pm2 save
```

#### Setup Nginx Reverse Proxy (Optional, for domain):

```bash
apt install -y nginx
nano /etc/nginx/sites-available/dvary
```

Paste:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/dvary /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# Add free SSL with Certbot
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

---

### 5. Run Locally

```bash
# Terminal 1: Make sure MongoDB is running
# (or use MongoDB Atlas — no local install needed)

# Terminal 2:
npm install --legacy-peer-deps
npm start
```

Open: **http://localhost:3000**

---

## 🎮 Commands

Once the bot is connected, use `.menu` in WhatsApp to see all commands.

### 📋 General
| Command | Description |
|---|---|
| `.menu` | Show all commands |
| `.help <cmd>` | Show detailed help for a command |
| `.ping` | Check bot response speed |
| `.alive` | Check if bot is alive |
| `.uptime` | Show bot uptime |
| `.info` | Show bot information |
| `.owner` | Show owner contact |
| `.bot` | Show current session status |
| `.version` | Show bot version |
| `.runtime` | Show system runtime info |

### 🎨 Media
| Command | Description |
|---|---|
| `.sticker` | Convert image/video to sticker |
| `.toimg` | Convert sticker to image |
| `.tomp3` | Convert video/audio to MP3 |
| `.tts <text>` | Text-to-speech |
| `.quote <text> \| <author>` | Create quote image |
| `.meme` | Get random meme |
| `.lyrics <song>` | Search song lyrics |
| `.fancy <style> <text>` | Convert to fancy text |
| `.img <query>` | Search images |
| `.tovn` | Convert to voice note |

### 👥 Group
| Command | Description |
|---|---|
| `.groupinfo` | Show group info |
| `.admins` | List group admins |
| `.tagall [msg]` | Mention all members |
| `.hidetag <msg>` | Silent mention all |
| `.promote @user` | Promote to admin |
| `.demote @user` | Demote admin |
| `.add <number>` | Add user to group |
| `.remove @user` | Remove user |
| `.mute` | Mute group |
| `.unmute` | Unmute group |
| `.welcome on\|off` | Welcome messages |

### 🛠️ Utility
| Command | Description |
|---|---|
| `.calc <expr>` | Calculate math |
| `.time [tz]` | Show time in timezone |
| `.id` | Show chat/user JIDs |
| `.qr <text>` | Generate QR code |
| `.define <word>` | Dictionary lookup |
| `.translate <lang> <text>` | Translate text |
| `.weather <city>` | Show weather |
| `.shorturl <url>` | Shorten URL |
| `.search <query>` | Web search |
| `.country <name>` | Country info |

### 👑 Owner
| Command | Description |
|---|---|
| `.broadcast <msg>` | Broadcast to all chats |
| `.ban @user` | Ban user from bot |
| `.unban @user` | Unban user |
| `.block @user` | Block user |
| `.unblock @user` | Unblock user |
| `.restart` | Restart session |
| `.shutdown` | Shutdown bot |
| `.sessions` | Manage sessions |
| `.eval <code>` | Execute JS (dangerous) |
| `.setprefix <p>` | Change prefix |
| `.mode <public\|private\|group>` | Change mode |
| `.pair <number>` | Get pair code |

---

## 📁 Folder Structure

```
dvary-bot/
├── server.js                    # Entry point
├── package.json
├── .env                         # Environment variables (not pushed)
├── .npmrc                       # legacy-peer-deps=true
├── .gitignore
│
├── config/
│   └── config.js                # Central config
│
├── database/
│   ├── database.js              # MongoDB connection
│   └── models/
│       ├── Session.js           # Baileys auth storage
│       ├── User.js              # Web users
│       ├── Setting.js           # Per-session settings
│       └── Ban.js               # Ban records
│
├── bot/
│   ├── manager.js               # Multi-session manager
│   ├── connection.js            # Baileys socket wrapper
│   ├── messages.js              # Incoming message pipeline
│   └── handler.js               # Command loader & dispatcher
│
├── commands/
│   ├── general/                 # 10 commands
│   ├── media/                   # 10 commands
│   ├── group/                   # 11 commands
│   ├── utility/                 # 10 commands
│   └── owner/                   # 12 commands
│
├── routes/
│   ├── web.routes.js
│   ├── pair.routes.js
│   ├── bot.routes.js
│   ├── session.routes.js
│   └── api.routes.js
│
├── controllers/
│   ├── pair.controller.js
│   ├── bot.controller.js
│   └── dashboard.controller.js
│
├── middleware/
│   ├── errorHandler.js
│   ├── rateLimit.js
│   └── auth.js
│
├── utils/
│   └── logger.js
│
├── views/                       # EJS pages (inline CSS)
│   ├── index.ejs
│   ├── pair.ejs
│   ├── dashboard.ejs
│   ├── status.ejs
│   ├── sessions.ejs
│   ├── commands.ejs
│   ├── settings.ejs
│   └── error.ejs
│
├── public/
│   ├── js/
│   │   └── pair.js
│   ├── images/
│   ├── icons/
│   ├── sounds/
│   └── uploads/
│
└── temp/                        # Runtime temp files
```

---

## 🐛 Troubleshooting

### ❌ `Cannot find module 'jimp'` or peer dependency error
**Fix**: Ensure `.npmrc` exists with:
```
legacy-peer-deps=true
```

Or run: `npm install --legacy-peer-deps`

### ❌ `MongooseServerSelectionError`
**Fix**: 
- Check MongoDB Atlas **Network Access** → add `0.0.0.0/0`
- Verify `MONGO_URI` in `.env`

### ❌ Session stuck at "Logging in..."
**Fix**:
- Delete device from WhatsApp → **Linked Devices**
- Pair again with a fresh code
- Ensure `WA_KEEPALIVE_INTERVAL=25000` in `.env`

### ❌ `E11000 duplicate key error ... key: null`
**Fix**: Delete stale index `key_1` from MongoDB Atlas → **Browse Collections** → `settings` → **Indexes** tab → **Drop `key_1`**

### ❌ `stream errored out (code 515)`
**This is NORMAL** after pairing. The bot auto-reconnects. Wait 10–20 seconds.

### ❌ Bot sleeping / offline
**Fix**: Setup **UptimeRobot** (see [Render deployment](#-deploy-on-render-recommended))

### ❌ Render build fails with `ERESOLVE`
**Fix**: Ensure `package.json` has:
```json
"overrides": { "jimp": "^1.6.0" }
```
And `jimp` in dependencies is `"^1.6.0"`.

---

## 🙏 Credits

- **[Baileys](https://github.com/WhiskeySockets/Baileys)** — WhatsApp Web API
- **[Dvary](https://github.com/)** — Bot author & maintainer
- All open-source contributors whose libraries power this bot ❤️

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**⚡ Made with 💜 by Dvary**

If you found this project useful, please ⭐ **star the repo**!

</div>


## Command system
- Commands are loaded from `commands/` recursively.
- Group moderation commands are protected by the central permission system.
- `.mode public` / `.mode private` is stored per `sessionId` in MongoDB.
- The bot WhatsApp account must be a group admin for WhatsApp actions such as kick/promote/demote and AntiLink deletion.


## Telegram WhatsApp Pairing

Set `TELEGRAM_BOT_TOKEN` and `OWNER_USERNAME` in the Panel environment. Start the bot normally (`PAIR_ONLY=false`). In Telegram use:

```text
/pair 255712345678
```

The bot starts a WhatsApp pairing session, caches the Baileys pairing code, and sends the code to Telegram with these instructions:

1. Open WhatsApp.
2. Settings.
3. Linked Devices.
4. Link a Device.
5. Link with phone number instead.
6. Enter the code sent by Telegram.

Pairing codes are cached temporarily in `BotManager` so Telegram does not miss a code emitted while the session is starting.

## Performance update
- Message event handlers no longer block command processing.
- Multiple incoming WhatsApp messages can be processed concurrently.
- Command usage statistics are written in the background instead of delaying replies.
- Command loader supports both `run()` and `execute()` command exports.


## DVARY BOT V2 - High Concurrency
Hot-path session/settings caching, bounded high concurrency (16 default, max 24), and in-memory menu image/command caching for burst traffic. Set MESSAGE_CONCURRENCY in the environment if needed.
