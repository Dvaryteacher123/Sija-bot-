/**
 * =====================================================
 *  DVARY BOT - MAIN SERVER
 *  Multi-user WhatsApp bot + Web pairing panel
 * =====================================================
 */

'use strict';

// =====================================================
// BOOT DEBUG
// =====================================================

console.log('==============================================');
console.log('[BOOT] DVARY BOT app.js starting...');
console.log('[BOOT] Node:', process.version);
console.log('[BOOT] PAIR_ONLY:', process.env.PAIR_ONLY);
console.log('[BOOT] PORT:', process.env.PORT);
console.log('==============================================');

// =====================================================
// ENVIRONMENT
// =====================================================

require('dotenv').config();

const PAIR_ONLY =
    String(process.env.PAIR_ONLY || 'false').toLowerCase() === 'true';

// =====================================================
// CORE
// =====================================================

const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs-extra');

// =====================================================
// EXPRESS
// =====================================================

const express = require('express');
const session = require('express-session');
const FileSessionStore = require('./database/fileSessionStore');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

// =====================================================
// SOCKET.IO
// =====================================================

const { Server: SocketServer } = require('socket.io');

// =====================================================
// INTERNAL
// =====================================================

console.log('[BOOT] Loading config...');

const config = require('./config/config');

console.log('[BOOT] Loading logger...');

const logger = require('./utils/logger');

console.log('[BOOT] Loading database...');

const database = require('./database/database');

console.log('[BOOT] Loading BotManager...');

const BotManager = require('./bot/manager');
const startTelegramBot = require('./telegram/bot');

// =====================================================
// MIDDLEWARE
// =====================================================

console.log('[BOOT] Loading middleware...');

const errorHandler = require('./middleware/errorHandler');
const rateLimit = require('./middleware/rateLimit');
const authMiddleware = require('./middleware/auth');

// =====================================================
// ROUTES
// =====================================================

console.log('[BOOT] Loading routes...');

const webRoutes = require('./routes/web.routes');
const pairRoutes = require('./routes/pair.routes');
const botRoutes = require('./routes/bot.routes');
const sessionRoutes = require('./routes/session.routes');
const apiRoutes = require('./routes/api.routes');

console.log('[BOOT] All modules loaded successfully.');


// =====================================================
// DIRECTORIES
// =====================================================

const REQUIRED_DIRS = [
    config.paths.temp,
    config.paths.uploads,
    path.join(config.paths.temp, 'logs'),
    path.join(config.paths.temp, 'auth'),
    path.join(config.paths.temp, 'media')
];

for (const dir of REQUIRED_DIRS) {
    fs.ensureDirSync(dir);
}


// =====================================================
// EXPRESS
// =====================================================

const app = express();

const server = http.createServer(app);


// =====================================================
// SOCKET.IO
// =====================================================

const io = new SocketServer(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },

    pingTimeout: 60000
});

app.set('io', io);

app.set('trust proxy', 1);


// =====================================================
// VIEW ENGINE
// =====================================================

app.set('view engine', 'ejs');

app.set(
    'views',
    path.join(__dirname, 'views')
);


// =====================================================
// SECURITY
// =====================================================

app.use(
    helmet({
        contentSecurityPolicy: false,

        crossOriginEmbedderPolicy: false,

        crossOriginResourcePolicy: {
            policy: 'cross-origin'
        }
    })
);


app.use(
    cors({
        origin: '*',
        credentials: true
    })
);


app.use(compression());

app.use(cookieParser());


// =====================================================
// BODY PARSER
// =====================================================

app.use(
    express.json({
        limit: '50mb'
    })
);


app.use(
    express.urlencoded({
        extended: true,
        limit: '50mb'
    })
);


// =====================================================
// LOGGING
// =====================================================

if (config.env === 'development') {

    app.use(
        morgan('dev')
    );

} else {

    const logStream =
        fs.createWriteStream(
            path.join(
                config.paths.temp,
                'logs',
                'access.log'
            ),
            {
                flags: 'a'
            }
        );

    app.use(
        morgan(
            'combined',
            {
                stream: logStream
            }
        )
    );
}


// =====================================================
// STATIC FILES
// =====================================================

app.use(
    '/public',

    express.static(
        path.join(
            __dirname,
            'public'
        ),
        {
            maxAge: '1d'
        }
    )
);


// =====================================================
// SESSION
// =====================================================

const sessionConfig = {

    name: 'dvary.sid',

    secret: config.session.secret,

    resave: false,

    saveUninitialized: false,

    rolling: true,

    cookie: {

        maxAge:
            config.session.maxAge,

        httpOnly: true,

        secure:
            config.env === 'production',

        sameSite: 'lax'
    }
};


// =====================================================
// WEBSITE SESSION STORE (LOCAL FILE)
// =====================================================
//
// In PAIR_ONLY mode we still connect to MongoDB,
// but we don't use MongoDB as the Express session
// store unless the normal bot runtime is active.
//
// =====================================================

if (!PAIR_ONLY) {

    sessionConfig.store =
        new FileSessionStore({
            ttlMs:
                config.session.maxAge
        });
}


app.use(
    session(sessionConfig)
);


// =====================================================
// RATE LIMIT
// =====================================================

app.use(
    rateLimit.global
);


// =====================================================
// LOCALS
// =====================================================

app.use(
    (req, res, next) => {

        res.locals.botName =
            config.bot.name;

        res.locals.botVersion =
            config.bot.version;

        res.locals.botOwner =
            config.bot.owner;

        res.locals.botFooter =
            config.bot.footer;

        res.locals.webTitle =
            config.web.title;

        res.locals.webDescription =
            config.web.description;

        res.locals.webTheme =
            config.web.theme;

        res.locals.currentPath =
            req.path;

        res.locals.user =
            req.session?.user || null;

        next();
    }
);


// =====================================================
// ROUTES
// =====================================================

app.use(
    '/',
    webRoutes
);


app.use(
    '/pair',
    pairRoutes
);


app.use(
    '/bot',
    authMiddleware.optional,
    botRoutes
);


app.use(
    '/sessions',
    authMiddleware.optional,
    sessionRoutes
);


app.use(
    '/api',
    apiRoutes
);


// =====================================================
// HEALTH CHECK
// =====================================================

app.get(
    '/health',
    (req, res) => {

        res.status(200).json({

            success: true,

            status: 'online',

            mode:
                PAIR_ONLY
                    ? 'PAIR_ONLY'
                    : 'BOT_RUNTIME',

            storage:
                'local-files',

            timestamp:
                new Date().toISOString()
        });
    }
);


// =====================================================
// 404
// =====================================================

app.use(
    (req, res) => {

        if (
            req.path.startsWith('/api')
        ) {

            return res
                .status(404)
                .json({

                    success: false,

                    message:
                        'Endpoint not found'
                });
        }

        return res
            .status(404)
            .render(
                'error',
                {

                    code: 404,

                    title:
                        'Page Not Found',

                    message:
                        'The page you are looking for does not exist.'
                }
            );
    }
);


// =====================================================
// ERROR HANDLER
// =====================================================

app.use(
    errorHandler
);


// =====================================================
// SOCKET.IO
// =====================================================

io.on(
    'connection',
    (socket) => {

        logger.info(
            `[Socket] Client connected: ${socket.id}`
        );


        socket.on(
            'join',
            (room) => {

                if (
                    typeof room === 'string' &&
                    room.trim()
                ) {

                    socket.join(room);

                    logger.info(
                        `[Socket] ${socket.id} joined room: ${room}`
                    );
                }
            }
        );


        socket.on(
            'leave',
            (room) => {

                if (
                    typeof room === 'string' &&
                    room.trim()
                ) {

                    socket.leave(room);
                }
            }
        );


        socket.on(
            'disconnect',
            (reason) => {

                logger.info(
                    `[Socket] Client disconnected: ${socket.id} (${reason})`
                );
            }
        );
    }
);


// =====================================================
// BOT MANAGER
// =====================================================

let botManager = null;
let telegramBot = null;


// =====================================================
// STARTUP
// =====================================================

async function start() {

    try {

        logger.info(
            '====================================================='
        );

        logger.info(
            `${config.bot.name} v${config.bot.version}`
        );

        logger.info(
            `Startup mode: ${
                PAIR_ONLY
                    ? 'PAIR_ONLY'
                    : 'BOT_RUNTIME'
            }`
        );

        logger.info(
            '====================================================='
        );


        // =================================================
        // MONGODB
        // =================================================

        logger.info(
            '[Startup] Loading local file database...'
        );

        await database.connect();

        logger.info(
            '[Startup] Local file database ready.'
        );


        // =================================================
        // PAIR ONLY MODE
        // =================================================

        if (PAIR_ONLY) {

            logger.info(
                '[Startup] PAIR_ONLY=true'
            );

            logger.info(
                '[Startup] BotManager initialization SKIPPED.'
            );

            logger.info(
                '[Startup] Existing bot sessions will NOT be started.'
            );

        }


        // =================================================
        // NORMAL BOT MODE
        // =================================================

        else {

            logger.info(
                '[Startup] Initializing Bot Manager...'
            );


            botManager =
                new BotManager(io);


            await botManager.init();


            logger.info(
                `[Startup] Bot Manager ready. Loaded sessions: ${
                    botManager.getSessionCount()
                }`
            );


            app.set(
                'botManager',
                botManager
            );


            global.botManager =
                botManager;


            // =================================================
            // TELEGRAM PAIRING BOT
            // =================================================
            if (String(process.env.TELEGRAM_BOT_TOKEN || '').trim()) {
                telegramBot = await startTelegramBot({ botManager });
                logger.info('[Startup] Telegram pairing bot ready.');
            } else {
                logger.warn('[Startup] TELEGRAM_BOT_TOKEN not set; Telegram pairing is disabled.');
            }
        }


        // =================================================
        // HTTP SERVER
        // =================================================

        const port =
            Number(
                process.env.PORT ||
                config.port ||
                3000
            );


        const host =
            '0.0.0.0';


        server.listen(
            port,
            host,
            () => {

                logger.info(
                    '====================================================='
                );

                logger.info(
                    `[Startup] Server running on ${host}:${port}`
                );

                logger.info(
                    `[Startup] Base URL: ${config.baseUrl}`
                );

                logger.info(
                    `[Startup] Mode: ${
                        PAIR_ONLY
                            ? 'PAIR_ONLY'
                            : 'BOT_RUNTIME'
                    }`
                );

                logger.info(
                    '====================================================='
                );

                console.log('Dvary Online');


                // =================================================
                // KEEP ALIVE
                // =================================================

                const KEEP_ALIVE_INTERVAL =
                    10 * 60 * 1000;


                setInterval(
                    () => {

                        try {

                            const appUrl =
                                config.baseUrl;


                            if (
                                !appUrl ||
                                appUrl.includes(
                                    'localhost'
                                ) ||
                                appUrl.includes(
                                    '127.0.0.1'
                                )
                            ) {

                                return;
                            }


                            const client =
                                appUrl.startsWith(
                                    'https'
                                )
                                    ? https
                                    : http;


                            client
                                .get(
                                    appUrl,
                                    (res) => {

                                        logger.info(
                                            `[KeepAlive] Ping sent. Status: ${res.statusCode}`
                                        );
                                    }
                                )
                                .on(
                                    'error',
                                    (err) => {

                                        logger.warn(
                                            `[KeepAlive] Ping failed: ${err.message}`
                                        );
                                    }
                                );

                        }
                        catch (err) {

                            logger.warn(
                                `[KeepAlive] Error: ${err.message}`
                            );
                        }

                    },
                    KEEP_ALIVE_INTERVAL
                );

            }
        );

    }

    catch (err) {

        console.error(
            '=============================================='
        );

        console.error(
            '[STARTUP ERROR]'
        );

        console.error(
            err
        );

        console.error(
            err?.stack || ''
        );

        console.error(
            '=============================================='
        );


        try {

            logger.error(
                '[Startup] Fatal error: ' +
                err.message
            );

            logger.error(
                err.stack || ''
            );

        }
        catch (_) {}


        process.exit(1);
    }
}


// =====================================================
// SHUTDOWN
// =====================================================

let shuttingDown = false;


async function shutdown(signal) {

    if (shuttingDown) {
        return;
    }


    shuttingDown = true;


    logger.warn(
        `[Shutdown] Received ${signal}. Cleaning up...`
    );


    // =================================================
    // TELEGRAM BOT
    // =================================================

    try {
        if (telegramBot) {
            telegramBot.stop();
            telegramBot = null;
            logger.info('[Shutdown] Telegram bot stopped.');
        }
    } catch (err) {
        logger.error('[Shutdown] Telegram bot error: ' + err.message);
    }


    // =================================================
    // BOT MANAGER
    // =================================================

    try {

        if (botManager) {

            await botManager.shutdown();

            logger.info(
                '[Shutdown] Bot manager stopped.'
            );
        }

    }
    catch (err) {

        logger.error(
            '[Shutdown] Bot manager error: ' +
            err.message
        );
    }


    // =================================================
    // MONGODB
    // =================================================

    try {

        await database.disconnect();

        logger.info(
            '[Shutdown] Local file database flushed.'
        );

    }
    catch (err) {

        logger.error(
            '[Shutdown] Database error: ' +
            err.message
        );
    }


    // =================================================
    // SOCKET.IO
    // =================================================

    try {

        io.close();

        logger.info(
            '[Shutdown] Socket.io closed.'
        );

    }
    catch (_) {}


    // =================================================
    // HTTP SERVER
    // =================================================

    server.close(
        () => {

            logger.info(
                '[Shutdown] HTTP server closed.'
            );

            process.exit(0);
        }
    );


    // =================================================
    // FORCE EXIT
    // =================================================

    setTimeout(
        () => {

            logger.error(
                '[Shutdown] Force exit after timeout.'
            );

            process.exit(1);

        },
        10000
    );
}


// =====================================================
// SIGNALS
// =====================================================

process.on(
    'SIGINT',
    () => shutdown('SIGINT')
);


process.on(
    'SIGTERM',
    () => shutdown('SIGTERM')
);


// =====================================================
// ERROR HANDLERS
// =====================================================

process.on(
    'uncaughtException',
    (err) => {

        console.error(
            '[UncaughtException]',
            err
        );

        try {

            logger.error(
                '[UncaughtException] ' +
                err.message
            );

            logger.error(
                err.stack || ''
            );

        }
        catch (_) {}
    }
);


process.on(
    'unhandledRejection',
    (reason) => {

        console.error(
            '[UnhandledRejection]',
            reason
        );

        try {

            logger.error(
                '[UnhandledRejection] ' +
                (
                    reason?.message ||
                    reason
                )
            );

            if (reason?.stack) {

                logger.error(
                    reason.stack
                );
            }

        }
        catch (_) {}
    }
);


// =====================================================
// START
// =====================================================

console.log(
    '[BOOT] Calling start()...'
);

start();


// =====================================================
// EXPORT
// =====================================================

module.exports = {
    app,
    server,
    io
};
