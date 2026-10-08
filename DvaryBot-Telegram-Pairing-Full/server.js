/**
 * DVARY BOT - BOOTSTRAP
 * Preloads Baileys (ESM-safe) and then starts the real app (app.js).
 */

'use strict';

console.log('==============================================');
console.log('[BOOT] DVARY BOT server.js starting...');
console.log('[BOOT] Node:', process.version);
console.log('==============================================');

require('dotenv').config();

/* ------------------------------------------------------------------
 * MEMORY LIMIT
 * Node's default JS heap is small (~2-4GB max). With hundreds of WhatsApp
 * sessions the process slowly reaches that limit and crashes ("bot inajizima
 * baada ya masaa"). Here we re-launch ourselves ONCE with a bigger heap sized
 * from the real server RAM (75%), or NODE_MAX_HEAP_MB from .env.
 * ------------------------------------------------------------------ */
(function ensureBigHeap() {
  try {
    if (process.env.DVARY_CHILD === '1') return;

    const os = require('os');
    const v8 = require('v8');

    // container limit (Pterodactyl/Docker) if there is one, never more than the real RAM
    const constrained =
      typeof process.constrainedMemory === 'function' ? Number(process.constrainedMemory()) : 0;
    const totalBytes =
      constrained > 0 && constrained < os.totalmem() ? constrained : os.totalmem();
    const totalMb = Math.floor(totalBytes / 1048576);

    let wanted = parseInt(process.env.NODE_MAX_HEAP_MB, 10);
    if (!wanted || wanted < 512) wanted = Math.floor(totalMb * 0.75);
    // never ask for more heap than ~80% of the container (Pterodactyl kills the
    // process with SIGKILL when it passes the panel's RAM limit -> endless reconnects)
    wanted = Math.max(256, Math.min(wanted, 32768, Math.floor(totalMb * 0.8)));

    const currentMb = Math.floor(v8.getHeapStatistics().heap_size_limit / 1048576);
    if (currentMb >= wanted * 0.9) return; // already big enough

    console.log(`[BOOT] Heap limit ${currentMb}MB -> restarting with ${wanted}MB (server RAM ${totalMb}MB)`);

    const { spawn } = require('child_process');

    // SUPERVISOR: if the real bot process ever dies (out-of-memory, crash),
    // start it again automatically after 2s. Works on Pterodactyl, VPS, anywhere.
    // Only a deliberate stop (panel Stop / SIGTERM / clean exit code 0) ends it.
    let stopping = false;
    let child = null;
    let restarts = 0;
    let lastStart = 0;

    const launch = () => {
      lastStart = Date.now();
      child = spawn(
        process.execPath,
        [`--max-old-space-size=${wanted}`, ...process.execArgv, __filename, ...process.argv.slice(2)],
        { stdio: 'inherit', env: { ...process.env, DVARY_CHILD: '1' } }
      );

      child.on('exit', (code, signal) => {
        if (stopping || code === 0) return process.exit(code || 0);
        // ran fine for >2min -> reset the crash counter
        if (Date.now() - lastStart > 120000) restarts = 0;
        restarts += 1;
        const wait = Math.min(2000 * restarts, 15000);
        console.error(`[BOOT] Bot process stopped (code=${code} signal=${signal}). Restarting in ${wait}ms (restart #${restarts})...`);
        setTimeout(launch, wait);
      });

      child.on('error', (err) => { console.error('[BOOT] Could not relaunch:', err.message); });
    };

    for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
      process.on(sig, () => {
        stopping = true;
        try { child && child.kill(sig); } catch (_) {}
        setTimeout(() => process.exit(0), 20000).unref();
      });
    }

    launch();

    // stop here: the child does the real work
    setInterval(() => {}, 1 << 30);
    global.__DVARY_PARENT__ = true;
  } catch (err) {
    console.error('[BOOT] Heap check skipped:', err.message);
  }
})();

if (global.__DVARY_PARENT__) {
  return; // parent only supervises the child process
}

(async () => {
  try {
    console.log('[BOOT] Loading Baileys...');
    await require('./bot/baileys').load();
    console.log('[BOOT] Baileys loaded OK');
    require('./app');
  } catch (err) {
    console.error('[BOOT] FATAL:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
