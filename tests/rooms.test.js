// Integrationstests für private Räume: Raum erstellen, mit Code beitreten, Fehlerfälle und Cheating-Schutz [9]
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';

const SERVER_FILE = fileURLToPath(new URL('../server.js', import.meta.url));
const ROOM_CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/; // 5 Zeichen ohne 0, O, 1, I und L

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
function waitFor(socket, eventName, timeout = 2000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Ereignis "${eventName}" kam nicht an`)), timeout);
        socket.once(eventName, (data) => {
            clearTimeout(timer);
            resolve(data);
        });
    });
}

/**
 * Prüft, dass ein Ereignis innerhalb der Wartezeit NICHT ankommt
 */
function expectNoEvent(socket, eventName, wait = 300) {
    return new Promise((resolve, reject) => {
        const handler = (data) => reject(new Error(`Unerwartetes Ereignis "${eventName}": ${JSON.stringify(data)}`));
        socket.once(eventName, handler);
        setTimeout(() => {
            socket.off(eventName, handler);
            resolve();
        }, wait);
    });
}

/**
 * Verbindet einen neuen Test-Client mit dem Server
 */
async function connectClient() {
    const client = io(serverUrl, { forceNew: true, transports: ['websocket'] });
    clients.push(client);
    await waitFor(client, 'connect');
    return client;
}

/**
 * Ein Spieler erstellt einen Raum und bekommt den Code
 */
async function createRoom(name = 'Anna', timeSetting = '5', variant = 'klassisch') {
    const host = await connectClient();
    const created = waitFor(host, 'roomCreated');
    host.emit('createRoom', name, timeSetting, variant);
    const { code } = await created;
    return { host, code };
}

before(async () => {
    const port = await getFreePort();
    serverUrl = `http://localhost:${port}`;
    serverProcess = spawn(process.execPath, [SERVER_FILE, String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
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

describe('Private Räume', () => {
    it('erstellt einen Raum mit einem Code aus 5 Zeichen ohne Verwechsler', async () => {
        const { code } = await createRoom();
        assert.match(code, ROOM_CODE);
    });

    it('startet die Partie mit Variante und Bedenkzeit des Erstellers', async () => {
        const { host, code } = await createRoom('Anna', '3', 'international');
        const guest = await connectClient();
        const matchHost = waitFor(host, 'matchFound');
        const matchGuest = waitFor(guest, 'matchFound');
        guest.emit('joinRoom', 'Bernd', ` ${code.toLowerCase()} `); // abgetippt: klein und mit Leerzeichen
        const [infoHost, infoGuest] = await Promise.all([matchHost, matchGuest]);

        assert.equal(infoHost.oppName, 'Bernd');
        assert.equal(infoGuest.oppName, 'Anna');
        assert.equal(infoHost.timeMinutes, 3);
        assert.equal(infoGuest.timeMinutes, 3);
        assert.notEqual(infoHost.isWhite, infoGuest.isWhite);

        // Variante International: Der Server nimmt einen Zug auf dem 10x10-Brett an
        const [white, black] = infoHost.isWhite ? [host, guest] : [guest, host];
        const received = waitFor(black, 'receiveMove');
        white.emit('makeMove', { fromR: 6, fromC: 1, toR: 5, toC: 2 });
        await received;
    });

    it('meldet einen unbekannten Code', async () => {
        const guest = await connectClient();
        const error = waitFor(guest, 'roomError');
        guest.emit('joinRoom', 'Bernd', 'ZZZZZ');
        assert.deepEqual(await error, { reason: 'notFound' });
    });

    it('lässt den Ersteller nicht in den eigenen Raum', async () => {
        const { host, code } = await createRoom();
        const error = waitFor(host, 'roomError');
        host.emit('joinRoom', 'Anna', code);
        assert.deepEqual(await error, { reason: 'ownRoom' });
    });

    it('nimmt Räume nicht in die öffentliche Warteschlange', async () => {
        const { host } = await createRoom('Anna', '5', 'klassisch');
        const stranger = await connectClient();
        stranger.emit('findMatch', 'Clara', '5', 'klassisch'); // gleiche Einstellung, trotzdem kein Match
        await expectNoEvent(host, 'matchFound');
        stranger.emit('cancelSearch');
    });

    it('löscht den Raum, wenn der Ersteller abbricht oder die Verbindung trennt', async () => {
        const first = await createRoom();
        first.host.emit('cancelSearch');
        const second = await createRoom();
        second.host.disconnect();

        const guest = await connectClient();
        await new Promise((resolve) => setTimeout(resolve, 100)); // Abbruch und Trennung beim Server ankommen lassen
        for (const code of [first.code, second.code]) {
            const error = waitFor(guest, 'roomError');
            guest.emit('joinRoom', 'Bernd', code);
            assert.deepEqual(await error, { reason: 'notFound' });
        }
    });

    it('ignoriert ungültige Namen und Einstellungen', async () => {
        const player = await connectClient();
        player.emit('createRoom', '<b>Hacker</b>', '5', 'klassisch');
        player.emit('createRoom', 'Anna', '999', 'klassisch');
        player.emit('createRoom', 'Anna', '5', 'schach');
        player.emit('joinRoom', '<b>Hacker</b>', 'ABCDE');
        player.emit('joinRoom', 'Anna', { code: 'ABCDE' });
        await expectNoEvent(player, 'roomCreated');
        await expectNoEvent(player, 'roomError');
    });

    // Cheating-Schutz [9]: höchstens 5 Versuche in 3 Sekunden, damit niemand Codes durchprobieren kann
    it('bremst das Raten von Codes', async () => {
        const guesser = await connectClient();
        const reasons = [];
        guesser.on('roomError', ({ reason }) => reasons.push(reason));
        for (let i = 0; i < 8; i++) guesser.emit('joinRoom', 'Bernd', 'ZZZZZ');
        await new Promise((resolve) => setTimeout(resolve, 300));
        assert.deepEqual(reasons, [...Array(5).fill('notFound'), ...Array(3).fill('tooFast')]);
    });
});
