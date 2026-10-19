// Integrationstests für den Server: Startet den echten Server auf einem freien Port
// und spielt mit Test-Clients über Socket.io gegen ihn.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { createInitialBoard, getLegalMoves, applyMove, getWinner, opponentOf } from '../public/js/rules.js';

const SERVER_FILE = fileURLToPath(new URL('../server.js', import.meta.url));

let serverProcess;
let serverUrl;
const clients = []; // Alle Test-Clients, damit sie am Ende getrennt werden

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
 * Prüft, dass ein Ereignis innerhalb der Wartezeit NICHT ankommt (z.B. ein abgelehnter Zug)
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
 * Verbindet zwei Spieler und startet eine Partie. Liefert die Clients nach Farbe sortiert.
 */
async function startGame() {
    const a = await connectClient();
    const b = await connectClient();
    const matchA = waitFor(a, 'matchFound');
    const matchB = waitFor(b, 'matchFound');
    a.emit('findMatch', 'Anna');
    b.emit('findMatch', 'Bernd');
    const [infoA] = await Promise.all([matchA, matchB]);
    return infoA.isWhite ? { white: a, black: b } : { white: b, black: a };
}

/**
 * Wandelt einen Zug aus rules.js in das Format um, das der Client an den Server schickt
 */
const toMessage = (move) => ({ fromR: move.fromRow, fromC: move.fromCol, toR: move.toRow, toC: move.toCol });

// Server vor allen Tests starten und warten, bis er bereit ist
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

// Nach allen Tests: Clients trennen und Server beenden
after(() => {
    clients.forEach((client) => client.disconnect());
    serverProcess.kill();
});

describe('Matchmaking', () => {
    it('verbindet zwei Spieler mit unterschiedlichen Farben und den Namen des Gegners', async () => {
        const a = await connectClient();
        const b = await connectClient();
        const matchA = waitFor(a, 'matchFound');
        const matchB = waitFor(b, 'matchFound');
        a.emit('findMatch', 'Anna');
        b.emit('findMatch', 'Bernd');
        const [infoA, infoB] = await Promise.all([matchA, matchB]);

        assert.equal(infoA.oppName, 'Bernd');
        assert.equal(infoB.oppName, 'Anna');
        assert.notEqual(infoA.isWhite, infoB.isWhite);
        assert.equal(infoA.timeMinutes, 5); // Ohne Angabe gelten 5 Minuten
        assert.equal(infoB.timeMinutes, 5);
    });

    it('bringt nur Spieler mit derselben Bedenkzeit zusammen', async () => {
        const oneMinute = await connectClient();
        const threeMinutes = await connectClient();
        const alsoOneMinute = await connectClient();
        oneMinute.emit('findMatch', 'Anna', '1');
        threeMinutes.emit('findMatch', 'Bernd', '3');
        await expectNoEvent(oneMinute, 'matchFound'); // 1 und 3 Minuten passen nicht zusammen

        const matchA = waitFor(oneMinute, 'matchFound');
        const matchC = waitFor(alsoOneMinute, 'matchFound');
        alsoOneMinute.emit('findMatch', 'Clara', '1');
        const [infoA, infoC] = await Promise.all([matchA, matchC]);

        assert.equal(infoA.oppName, 'Clara');
        assert.equal(infoA.timeMinutes, 1);
        assert.equal(infoC.timeMinutes, 1);
        threeMinutes.emit('cancelSearch');
    });

    it('lost im Partymodus für beide dieselbe Zeit von 1 bis 10 Minuten aus', async () => {
        const a = await connectClient();
        const b = await connectClient();
        const matchA = waitFor(a, 'matchFound');
        const matchB = waitFor(b, 'matchFound');
        a.emit('findMatch', 'Anna', 'party');
        b.emit('findMatch', 'Bernd', 'party');
        const [infoA, infoB] = await Promise.all([matchA, matchB]);

        assert.equal(infoA.timeMinutes, infoB.timeMinutes);
        assert.ok(Number.isInteger(infoA.timeMinutes) && infoA.timeMinutes >= 1 && infoA.timeMinutes <= 10);
    });

    it('ignoriert ungültige Bedenkzeiten', async () => {
        const invalid = await connectClient();
        const valid = await connectClient();
        invalid.emit('findMatch', 'Hacker', '999');
        valid.emit('findMatch', 'Clara', '999'); // Auch der zweite Spieler darf damit nicht in eine Warteschlange
        await expectNoEvent(valid, 'matchFound');
    });

    it('ignoriert ungültige Namen', async () => {
        const invalid = await connectClient();
        const valid = await connectClient();
        invalid.emit('findMatch', '<b>Hacker</b>');
        valid.emit('findMatch', 'Clara');

        // Der ungültige Spieler steht nicht in der Warteschlange, also gibt es kein Match
        await expectNoEvent(valid, 'matchFound');
        valid.emit('cancelSearch');
    });
});

describe('Zugprüfung', () => {
    it('leitet einen erlaubten Zug an den Gegner weiter', async () => {
        const { white, black } = await startGame();
        const received = waitFor(black, 'receiveMove');
        white.emit('makeMove', { fromR: 5, fromC: 0, toR: 4, toC: 1 });
        assert.deepEqual(await received, { fromR: 5, fromC: 0, toR: 4, toC: 1 });
    });

    it('lehnt einen Zug ab, wenn der Spieler nicht am Zug ist', async () => {
        const { white, black } = await startGame();
        black.emit('makeMove', { fromR: 2, fromC: 1, toR: 3, toC: 0 });
        await expectNoEvent(white, 'receiveMove');
    });

    it('lehnt ab, wenn ein Spieler für den Gegner zieht (auch wenn der Zug für diesen erlaubt wäre)', async () => {
        const { white, black } = await startGame();
        black.emit('makeMove', { fromR: 5, fromC: 0, toR: 4, toC: 1 }); // erlaubter Zug von Weiß, aber von Schwarz gesendet
        await expectNoEvent(white, 'receiveMove');
    });

    it('lehnt einen Zug ab, der gegen die Regeln verstößt', async () => {
        const { white, black } = await startGame();
        white.emit('makeMove', { fromR: 5, fromC: 0, toR: 3, toC: 0 }); // zwei Felder geradeaus
        await expectNoEvent(black, 'receiveMove');
    });

    it('lehnt das Ziehen eines gegnerischen Steins ab', async () => {
        const { white, black } = await startGame();
        white.emit('makeMove', { fromR: 2, fromC: 1, toR: 3, toC: 0 }); // schwarzer Stein
        await expectNoEvent(black, 'receiveMove');
    });

    it('ignoriert kaputte Daten und läuft danach normal weiter', async () => {
        const { white, black } = await startGame();
        for (const garbage of [
            null,
            'abc',
            42,
            {},
            { fromR: '5', fromC: 0, toR: 4, toC: 1 },
            { fromR: 99, fromC: 0 },
        ]) {
            white.emit('makeMove', garbage);
        }
        await expectNoEvent(black, 'receiveMove');

        // Der Server ist nicht abgestürzt: Ein gültiger Zug kommt weiterhin an
        const received = waitFor(black, 'receiveMove');
        white.emit('makeMove', { fromR: 5, fromC: 0, toR: 4, toC: 1 });
        await received;
    });

    it('akzeptiert eine komplette Partie und danach keine Züge mehr', async () => {
        const { white, black } = await startGame();
        const players = { white, black };
        let board = createInitialBoard();
        let turn = 'white';
        let multiJumpFrom = null;

        // Fester Spielverlauf: Weiß nimmt immer den ersten erlaubten Zug, Schwarz den letzten
        // (endet nach 53 Zügen mit Schlägen, Mehrfachsprüngen und einer Beförderung)
        while (!getWinner(board, turn)) {
            const moves = getLegalMoves(board, turn, multiJumpFrom);
            const move = turn === 'white' ? moves[0] : moves[moves.length - 1];
            const opponent = players[opponentOf(turn)];

            const received = waitFor(opponent, 'receiveMove');
            players[turn].emit('makeMove', toMessage(move));
            assert.deepEqual(await received, toMessage(move));

            const result = applyMove(board, move);
            board = result.board;
            if (result.mustContinue) {
                multiJumpFrom = { row: move.toRow, col: move.toCol };
            } else {
                multiJumpFrom = null;
                turn = opponentOf(turn);
            }
        }

        // Nach Spielende darf auch der Gewinner nicht mehr ziehen
        const winner = getWinner(board, turn);
        const lastMoves = getLegalMoves(board, winner);
        if (lastMoves.length > 0) {
            players[winner].emit('makeMove', toMessage(lastMoves[0]));
            await expectNoEvent(players[opponentOf(winner)], 'receiveMove');
        }
    });
});

describe('Chat', () => {
    it('entfernt Leerzeichen am Rand und kürzt auf 200 Zeichen', async () => {
        const { white, black } = await startGame();
        const received = waitFor(black, 'chatMessage');
        white.emit('chatMessage', `   ${'x'.repeat(500)}   `);
        assert.equal(await received, 'x'.repeat(200));
    });

    it('leitet leere Nachrichten und andere Datentypen nicht weiter', async () => {
        const { white, black } = await startGame();
        white.emit('chatMessage', '     ');
        white.emit('chatMessage', { text: 'kein String' });
        await expectNoEvent(black, 'chatMessage');
    });
});

describe('Partie verlassen', () => {
    it('meldet dem Gegner, wenn ein Spieler die Partie verlässt', async () => {
        const { white, black } = await startGame();
        const left = waitFor(black, 'opponentLeft');
        white.emit('leaveMatch');
        await left;
    });

    it('meldet dem Gegner einen Verbindungsabbruch', async () => {
        const { white, black } = await startGame();
        const left = waitFor(black, 'opponentLeft');
        white.disconnect();
        await left;
    });

    it('startet bei einer Revanche eine neue Partie mit frischem Brett', async () => {
        const { white, black } = await startGame();
        white.emit('makeMove', { fromR: 5, fromC: 0, toR: 4, toC: 1 });
        await waitFor(black, 'receiveMove');

        const replayWhite = waitFor(white, 'matchFound');
        const replayBlack = waitFor(black, 'matchFound');
        white.emit('requestReplay');
        black.emit('requestReplay');
        const [infoWhite] = await Promise.all([replayWhite, replayBlack]);

        // Der neue weiße Spieler kann wieder den ersten Zug aus der Startaufstellung machen
        const newWhite = infoWhite.isWhite ? white : black;
        const newBlack = infoWhite.isWhite ? black : white;
        const received = waitFor(newBlack, 'receiveMove');
        newWhite.emit('makeMove', { fromR: 5, fromC: 0, toR: 4, toC: 1 });
        await received;
    });
});
