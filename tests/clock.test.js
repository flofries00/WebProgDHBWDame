// Integrationstests für die Bedenkzeit auf dem Server (Cheating-Schutz [8]).
// Der Server läuft hier mit schneller Uhr: SECOND_MS=20, eine "Minute" dauert also nur 1,2 Sekunden
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';

const SERVER_FILE = fileURLToPath(new URL('../server.js', import.meta.url));
const SECOND_MS = 20;
const MINUTE_MS = 60 * SECOND_MS; // 1200 Millisekunden
const INTRO_MS = 12 * SECOND_MS; // Vorlauf für den Münzwurf wie im Server

let serverProcess;
let serverUrl;
const clients = [];

/**
 * Sucht einen freien Port, damit der Test nicht mit einem bereits laufenden Server kollidiert
 */
function getFreePort() {
    return new Promise((resolve) => {
        const probe = createServer();
        probe.listen(0, () => {
            const { port } = probe.address();
            probe.close(() => resolve(port));
        });
    });
}

/**
 * Wartet, bis ein Ereignis ankommt, und liefert dessen Daten (bricht nach einer Zeit mit Fehler ab)
 */
function waitFor(socket, eventName, timeout = 3000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Ereignis "${eventName}" kam nicht an`)), timeout);
        socket.once(eventName, (data) => {
            clearTimeout(timer);
            resolve(data);
        });
    });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Verbindet zwei Spieler mit 1 Minute Bedenkzeit und liefert sie nach Farbe sortiert
 */
async function startGame() {
    const connect = async () => {
        const client = io(serverUrl, { forceNew: true, transports: ['websocket'] });
        clients.push(client);
        await waitFor(client, 'connect');
        return client;
    };
    const a = await connect();
    const b = await connect();
    const matchA = waitFor(a, 'matchFound');
    const matchB = waitFor(b, 'matchFound');
    a.emit('findMatch', 'Anna', '1');
    b.emit('findMatch', 'Bernd', '1');
    const [infoA] = await Promise.all([matchA, matchB]);
    return infoA.isWhite ? { white: a, black: b } : { white: b, black: a };
}

// Eigener Server mit schneller Uhr
before(async () => {
    const port = await getFreePort();
    serverUrl = `http://localhost:${port}`;
    serverProcess = spawn(process.execPath, [SERVER_FILE, String(port)], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, SECOND_MS: String(SECOND_MS) },
    });
    await new Promise((resolve, reject) => {
        serverProcess.stdout.on('data', (data) => {
            if (data.toString().includes('Server läuft')) resolve();
        });
        serverProcess.on('exit', (code) => reject(new Error(`Server wurde beendet (Code ${code})`)));
    });
});

after(() => {
    clients.forEach((client) => client.disconnect());
    serverProcess.kill();
});

describe('Bedenkzeit auf dem Server', () => {
    it('meldet beiden den Gewinner, wenn die Zeit abgelaufen ist', async () => {
        const { white, black } = await startGame();
        const [forWhite, forBlack] = await Promise.all([waitFor(white, 'timeUp'), waitFor(black, 'timeUp')]);
        assert.deepEqual(forWhite, { winner: 'black' });
        assert.deepEqual(forBlack, { winner: 'black' });
    });

    it('nimmt nach Ablauf der Zeit keinen Zug mehr an', async () => {
        const { white, black } = await startGame();
        await waitFor(white, 'timeUp');
        let received = false;
        black.on('receiveMove', () => (received = true));
        white.emit('makeMove', { fromR: 5, fromC: 0, toR: 4, toC: 1 });
        await sleep(200);
        assert.equal(received, false);
    });

    it('zieht die verbrauchte Zeit ab und meldet beiden den Stand der Uhren', async () => {
        const { white, black } = await startGame();
        await sleep(INTRO_MS + 300); // Nach dem Vorlauf 300 ms "nachdenken"
        const syncWhite = waitFor(white, 'clockSync');
        const syncBlack = waitFor(black, 'clockSync');
        white.emit('makeMove', { fromR: 5, fromC: 0, toR: 4, toC: 1 });
        const [clock, clockForBlack] = await Promise.all([syncWhite, syncBlack]);

        assert.deepEqual(clockForBlack, clock);
        assert.equal(clock.black, MINUTE_MS); // Schwarz war noch nicht dran
        assert.ok(clock.white <= MINUTE_MS - 300 && clock.white > MINUTE_MS - 600, `Weiß: ${clock.white}`);
    });

    it('lässt nach einem Zug die Uhr des Gegners laufen', async () => {
        const { white, black } = await startGame();
        white.emit('makeMove', { fromR: 5, fromC: 0, toR: 4, toC: 1 });
        const result = await waitFor(black, 'timeUp');
        assert.deepEqual(result, { winner: 'white' }); // Schwarz hat nicht gezogen
    });

    it('startet die Uhr des Gegners erst mit dem Zug', async () => {
        const { white, black } = await startGame();
        await sleep(INTRO_MS + 600); // Weiß denkt lange nach
        white.emit('makeMove', { fromR: 5, fromC: 0, toR: 4, toC: 1 });
        await waitFor(black, 'receiveMove');
        await sleep(700); // Schwarz hat danach noch seine volle Minute, 700 ms sind kein Problem
        const sync = waitFor(white, 'clockSync');
        black.emit('makeMove', { fromR: 2, fromC: 1, toR: 3, toC: 2 });
        const clock = await sync;
        assert.ok(clock.black <= MINUTE_MS - 700 && clock.black > MINUTE_MS - 1000, `Schwarz: ${clock.black}`);
    });

    it('zählt die Zeit vor dem Ende des Münzwurfs nicht mit', async () => {
        const { white, black } = await startGame();
        const sync = waitFor(black, 'clockSync');
        white.emit('makeMove', { fromR: 5, fromC: 0, toR: 4, toC: 1 }); // Sofort, noch während des Vorlaufs
        assert.equal((await sync).white, MINUTE_MS);
    });
});
