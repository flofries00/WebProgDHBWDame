/**
 * Server für Dame Online: liefert die Seite aus (HTTP und optional HTTPS), bringt Spieler mit gleicher Variante
 * und Bedenkzeit zusammen, prüft jeden Zug und leitet Züge, Chat und Revanche-Wünsche an den Gegner weiter.
 *
 * Cheating-Schutz (im Code mit "Cheating-Schutz [Nr.]" markiert):
 * [1] Name, Bedenkzeit und Variante werden auch hier geprüft, nicht nur im Browser
 * [2] Farben und Partyzeit lost der Server aus, kein Browser kann sie sich aussuchen
 * [3] Eigenes Brett pro Partie: Ein Zug zählt nur, wenn der Spieler am Zug ist und rules.js ihn erlaubt.
 *     Wer eine neue Partie sucht, wird von der laufenden getrennt (nie in zwei Partien gleichzeitig)
 * [4] Weitergeleitet werden nur die geprüften Werte, nie die Originalnachricht
 * [5] Chat: nur Text, höchstens 200 Zeichen, nur an den eigenen Gegner (der Browser zeigt ihn nie als HTML an)
 * [6] Nachrichten über 10 kB werden abgelehnt, ein Fehler bei einer Nachricht bringt den Server nicht zum Absturz
 * [7] Chat-Spam: Höchstens 5 Nachrichten in 3 Sekunden pro Spieler, weitere werden verworfen
 * [8] Bedenkzeit: Der Server zählt die Zeit beider Spieler, meldet das Ende (timeUp) und nimmt danach keine Züge mehr an
 * [9] Private Räume: Codes erzeugt der Server zufällig, Beitreten nur mit gültigem Code, Raten wird gebremst
 * [10] Remis-Angebot: Annehmen kann nur der Gegner, nur bei einem offenen Angebot in einer laufenden Partie,
 *      höchstens 3 Angebote pro Spieler und Partie
 */

import express from 'express';
import { createServer } from 'node:http';
import { createServer as createSecureServer } from 'node:https';
import { Server } from 'socket.io';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomInt } from 'node:crypto';
// Dieselben Spielregeln wie im Browser: So kann der Server jeden Zug selbst prüfen (Schutz gegen Cheating)
import {
    VARIANTS,
    createInitialBoard,
    getLegalMoves,
    findMove,
    applyMove,
    opponentOf,
    getWinner,
    countQuietKingTurns,
    isDraw,
    introSeconds,
} from './public/js/rules.js';

// In ES-Modulen gibt es __dirname nicht automatisch, daher aus der Adresse dieser Datei berechnen
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const http = createServer(app);
const io = new Server(http, { maxHttpBufferSize: 1e4 }); // Cheating-Schutz [6]: Nachrichten über 10kB werden abgelehnt

// Sagt dem Server, dass er nur die Client-Dateien aus dem Ordner 'public' ausliefern soll
// (sonst wären auch server.js, package.json und node_modules abrufbar)
app.use(express.static(path.join(__dirname, 'public')));

// Erlaubte Bedenkzeiten in Minuten, 'party' = beide bekommen dieselbe Zufallszeit von 1 bis 10 Minuten
const TIME_SETTINGS = ['1', '3', '5', '10', 'party'];

// Wartende Spieler, eine Warteschlange pro Variante und Bedenkzeit (es spielen nur Spieler mit gleicher Einstellung gegeneinander)
const waiting = new Map();

// Grenzen für Eingaben vom Client
const MAX_CHAT_LENGTH = 200;
const CHAT_LIMIT = 5; // Cheating-Schutz [7]: höchstens so viele Chat-Nachrichten ...
const CHAT_WINDOW_MS = 3000; // ... in diesem Zeitraum (Millisekunden)

// Private Räume: Raumcode -> wartender Ersteller. Die Codes haben keine Zeichen, die man leicht verwechselt (0/O, 1/I/L)
const rooms = new Map();
const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 5;
const JOIN_LIMIT = 5; // Cheating-Schutz [9]: höchstens so viele Beitrittsversuche...
const JOIN_WINDOW_MS = 3000; // ... in diesem Zeitraum (ms), damit niemand Codes durchprobieren kann
const MAX_DRAW_OFFERS = 3; // Cheating-Schutz [10]: So oft darf jeder Spieler pro Partie Remis anbieten

// Cheating-Schutz [8]: Die Bedenkzeit zählt der Server. SECOND_MS ist die Länge einer Sekunde in Millisekunden,
// nur die Tests verstellen sie (schnellere Uhr), sonst gilt 1000
const SECOND_MS = Number(process.env.SECOND_MS) > 0 ? Number(process.env.SECOND_MS) : 1000;
const GRACE_MS = 1 * SECOND_MS; // Spielraum für die Übertragung: Ein Zug, der bei 0:00 unterwegs war, zählt noch

/**
 * Prüft, ob ein Wert eine gültige Brettkoordinate auf einem Brett dieser Größe ist
 */
function isValidCoord(value, size) {
    return Number.isInteger(value) && value >= 0 && value < size;
}

/**
 * Cheating-Schutz [1]: Ist der Spielername erlaubt? (2 bis 16 Buchstaben oder Ziffern, wie im Browser)
 */
function isValidName(name) {
    return typeof name === 'string' && /^[a-zA-Z0-9äöüÄÖÜß]{2,16}$/.test(name);
}

/**
 * Cheating-Schutz [1]: Sind Name, Bedenkzeit und Variante erlaubt? (für die Suche und für private Räume)
 */
function isValidSetup(name, timeSetting, variant) {
    return (
        isValidName(name) &&
        TIME_SETTINGS.includes(timeSetting) &&
        typeof variant === 'string' &&
        Object.hasOwn(VARIANTS, variant)
    );
}

/**
 * Merkt sich die Zeitpunkte der letzten Anfragen eines Spielers (z.B. Chat-Nachrichten) und meldet true, wenn es
 * im Zeitraum schon zu viele waren. Die Anfrage zählt dann nicht mit
 */
function isTooFrequent(socket, name, limit, windowMs) {
    const now = Date.now();
    socket[name] = (socket[name] ?? []).filter((time) => now - time < windowMs);
    if (socket[name].length >= limit) return true;
    socket[name].push(now);
    return false;
}

/**
 * Erzeugt einen neuen, noch freien Raumcode wie "K7QXM" (randomInt ist ein sicherer, nicht erratbarer Zufall)
 */
function createRoomCode() {
    let code;
    do {
        code = Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)]).join('');
    } while (rooms.has(code));
    return code;
}

/**
 * Registriert einen Socket-Handler mit try/catch: Ein Fehler bei einem einzelnen Ereignis
 * wird protokolliert, bringt aber nicht den ganzen Server zum Absturz (Cheating-Schutz [6])
 */
function onSafe(socket, eventName, handler) {
    socket.on(eventName, (...args) => {
        try {
            handler(...args);
        } catch (err) {
            console.error(`Fehler bei der Verarbeitung von "${eventName}":`, err);
        }
    });
}

/**
 * Nimmt einen Spieler aus seiner Warteschlange (falls er dort wartet)
 */
function leaveQueue(socket) {
    if (waiting.get(socket.queueKey) === socket) waiting.delete(socket.queueKey);
}

/**
 * Sucht den Raum zu einem Code (für die Vorschau und das Beitreten). Gibt den wartenden Ersteller zurück
 * sonst null und meldet dem Spieler den Grund (roomError)
 */
function findRoom(socket, code) {
    // Cheating-Schutz [9]: Code prüfen, das Durchprobieren von Codes bremsen
    if (typeof code !== 'string') return null;
    if (isTooFrequent(socket, 'joinTimes', JOIN_LIMIT, JOIN_WINDOW_MS)) {
        socket.emit('roomError', { reason: 'tooFast' });
        return null;
    }

    const host = rooms.get(code.trim().toUpperCase()); // Kleinbuchstaben und Leerzeichen sind beim Abtippen erlaubt
    if (!host) {
        socket.emit('roomError', { reason: 'notFound' });
        return null;
    }
    if (host === socket) {
        socket.emit('roomError', { reason: 'ownRoom' });
        return null;
    }
    return host;
}

/**
 * Löscht den privaten Raum eines Spielers (falls er einen erstellt hat und noch wartet)
 */
function leaveRoom(socket) {
    if (rooms.get(socket.roomCode) === socket) rooms.delete(socket.roomCode);
    socket.roomCode = null;
}

/**
 * Startet eine neue Partie zwischen zwei Spielern: Der Server lost die Farben aus,
 * führt ein eigenes Brett und informiert beide Spieler.
 */
function startMatch(p1, p2) {
    // Bei einer Revanche den Wecker der alten Partie abstellen
    clearTimeout(p1.game?.clockTimer);

    // Cheating-Schutz [2]: Farben und Partyzeit lost der Server aus, kein Browser kann sie sich aussuchen
    const p1White = Math.random() < 0.5;

    // Bedenkzeit: Im Partymodus lost der Server sie aus, damit beide garantiert dieselbe Zeit bekommen
    const timeMinutes = p1.timeSetting === 'party' ? Math.floor(Math.random() * 10) + 1 : Number(p1.timeSetting);

    // Spielstand auf dem Server (beide Sockets zeigen auf dasselbe Objekt)
    const game = {
        variant: p1.variant, // Beide haben in derselben Warteschlange gewartet, also dieselbe Variante
        board: createInitialBoard(p1.variant),
        turn: 'white', // Weiß beginnt
        multiJumpFrom: null, // Während eines Mehrfachsprungs: Position des springenden Steins
        players: [p1, p2],
        // Cheating-Schutz [8]: Restzeit beider Spieler in Millisekunden, die Uhr von Weiß läuft erst nach dem Münzwurf
        clock: { white: timeMinutes * 60 * SECOND_MS, black: timeMinutes * 60 * SECOND_MS },
        turnStartedAt: Date.now() + introSeconds(p1.timeSetting) * SECOND_MS, // Erst nach Münzwurf und Countdown
        clockTimer: null,
        quietKingTurns: 0, // Für die Remis-Regel: Damenzüge ohne Schlag hintereinander
        drawOfferBy: null, // Farbe des Spielers, dessen Remis-Angebot gerade offen ist
        drawOffers: { white: 0, black: 0 }, // Bisherige Remis-Angebote pro Farbe
    };
    startClock(game);
    p1.game = game;
    p2.game = game;
    p1.color = p1White ? 'white' : 'black';
    p2.color = p1White ? 'black' : 'white';

    // IDs für spätere Spielzüge merken
    p1.oppId = p2.id;
    p2.oppId = p1.id;

    // Variante und Bedenkzeit mitschicken: Wer einem privaten Raum beitritt, kennt sie sonst nicht
    const settings = { timeMinutes, variant: game.variant, timeSetting: p1.timeSetting };
    p1.emit('matchFound', { oppName: p2.name, isWhite: p1White, ...settings });
    p2.emit('matchFound', { oppName: p1.name, isWhite: !p1White, ...settings });
}

/**
 * Ab wann ist die Zeit des Spielers am Zug abgelaufen? (Zeitpunkt in Millisekunden, mit Spielraum)
 */
function timeUpAt(game) {
    return game.turnStartedAt + game.clock[game.turn] + GRACE_MS;
}

/**
 * Stellt den Wecker für den Spieler am Zug: Klingelt er, ist dessen Zeit abgelaufen
 */
function startClock(game) {
    clearTimeout(game.clockTimer);
    game.clockTimer = setTimeout(
        () => {
            // Zeit abgelaufen: Danach nimmt der Server keine Züge mehr an, beide erfahren den Gewinner
            const winner = opponentOf(game.turn);
            game.turn = null;
            game.players.forEach((player) => player.emit('timeUp', { winner }));
        },
        Math.max(timeUpAt(game) - Date.now(), 0)
    );
}

/**
 * Trennt einen Spieler von seinem Gegner (beim Verlassen oder Verbindungsabbruch)
 */
function endMatch(socket) {
    clearTimeout(socket.game?.clockTimer); // Die Partie ist vorbei, der Wecker wird nicht mehr gebraucht
    socket.wantsReplay = false;
    socket.game = null;
    if (!socket.oppId) return;

    socket.to(socket.oppId).emit('opponentLeft');
    const oppSocket = io.sockets.sockets.get(socket.oppId);
    if (oppSocket) {
        oppSocket.oppId = null;
        oppSocket.wantsReplay = false;
        oppSocket.game = null;
    }
    socket.oppId = null;
}

/**
 * Schickt allen Browsern, wo gerade jemand wartet und wie viele Spieler verbunden sind
 * (so sieht man vor der Suche, mit welcher Bedenkzeit man sofort einen Gegner findet)
 */
function broadcastQueueStatus() {
    // Pro Variante und Bedenkzeit: 1 = dort wartet jemand, z.B. { klassisch: { '1': 0, '3': 1 }, international: { ... } }
    const waitingPerSetting = Object.fromEntries(
        Object.keys(VARIANTS).map((variant) => [
            variant,
            Object.fromEntries(TIME_SETTINGS.map((time) => [time, waiting.has(`${variant}:${time}`) ? 1 : 0])),
        ])
    );
    io.emit('queueStatus', { waiting: waitingPerSetting, online: io.of('/').sockets.size });
}

// Wartet auf Browser-Verbindungen
io.on('connection', (socket) => {
    console.log('Verbunden: ', socket.id);
    broadcastQueueStatus(); // Neuer Spieler: Anzahl online hat sich geändert, er selbst bekommt den aktuellen Stand

    onSafe(socket, 'findMatch', (name, timeSetting = '5', variant = 'klassisch') => {
        // Cheating-Schutz [1]: Namen, Bedenkzeit und Variante auch serverseitig prüfen (Client-Prüfung lässt sich umgehen)
        if (!isValidSetup(name, timeSetting, variant)) return;

        // Cheating-Schutz [3]: Eine laufende Partie zuerst beenden, der Gegner erfährt es (opponentLeft).
        // Ein normaler Browser hat sie schon verlassen, ein manipulierter wäre sonst in zwei Partien
        endMatch(socket);
        leaveQueue(socket); // Falls der Spieler noch mit einer anderen Einstellung wartet
        leaveRoom(socket); // ... oder in einem eigenen Raum
        socket.name = name; // Namen speichern, wichtig für Revanche
        socket.timeSetting = timeSetting; // Bedenkzeit merken, gilt auch für die Revanche
        socket.variant = variant; // Variante ebenso
        socket.queueKey = `${variant}:${timeSetting}`;
        socket.wantsReplay = false; // Alte Revanche-Wünsche verwerfen

        // Wartet schon ein anderer Spieler mit derselben Variante und Bedenkzeit -> Match gefunden
        const opponent = waiting.get(socket.queueKey);
        if (opponent && opponent !== socket) {
            waiting.delete(socket.queueKey); // Warteschlange leeren
            startMatch(opponent, socket);
        } else {
            // Erster Spieler mit dieser Einstellung wartet
            waiting.set(socket.queueKey, socket);
        }
        broadcastQueueStatus();
    });

    // Spieler bricht die Suche ab (oder das Warten im eigenen Raum)
    onSafe(socket, 'cancelSearch', () => {
        leaveQueue(socket);
        leaveRoom(socket);
        broadcastQueueStatus();
    });

    // Privates Spiel: Raum mit eigener Variante und Bedenkzeit erstellen, der Server schickt den Code zurück
    onSafe(socket, 'createRoom', (name, timeSetting = '5', variant = 'klassisch') => {
        if (!isValidSetup(name, timeSetting, variant)) return; // Cheating-Schutz [1] wie bei der Suche

        endMatch(socket); // Cheating-Schutz [3] wie bei der Suche
        leaveQueue(socket);
        leaveRoom(socket); // Nur ein Raum pro Spieler
        socket.name = name;
        socket.timeSetting = timeSetting;
        socket.variant = variant;
        socket.wantsReplay = false;
        socket.roomCode = createRoomCode();
        rooms.set(socket.roomCode, socket);
        socket.emit('roomCreated', { code: socket.roomCode });
        broadcastQueueStatus(); // Falls der Spieler vorher in der Warteschlange stand
    });

    // Privates Spiel: Vor dem Beitreten zeigen, wessen Raum es ist und was gespielt wird (startet noch nichts)
    onSafe(socket, 'checkRoom', (code) => {
        const host = findRoom(socket, code);
        if (!host) return;
        socket.emit('roomPreview', {
            code: host.roomCode,
            hostName: host.name,
            variant: host.variant,
            timeSetting: host.timeSetting,
        });
    });

    // Privates Spiel beitreten: Die Partie startet mit Variante und Bedenkzeit des Erstellers
    onSafe(socket, 'joinRoom', (name, code) => {
        if (!isValidName(name)) return; // Cheating-Schutz [1]
        const host = findRoom(socket, code);
        if (!host) return;

        leaveRoom(host); // Der Raum ist jetzt voll und wird gelöscht
        endMatch(socket); // Cheating-Schutz [3] wie bei der Suche
        leaveQueue(socket);
        leaveRoom(socket);
        socket.name = name;
        socket.timeSetting = host.timeSetting; // Gilt auch für die Revanche
        socket.variant = host.variant;
        socket.wantsReplay = false;
        startMatch(host, socket); // Der Ersteller zuerst: Seine Einstellungen gelten
        broadcastQueueStatus();
    });

    // Cheating-Schutz [3]: Jeder Zug wird auf dem Server geprüft, nur erlaubte Züge gehen an den Gegner
    onSafe(socket, 'makeMove', (moveData) => {
        const game = socket.game;
        if (!socket.oppId || !game || !moveData) return;

        const { fromR, fromC, toR, toC } = moveData;

        // Nur gültige Koordinaten akzeptieren, sonst Nachricht verwerfen
        if (![fromR, fromC, toR, toC].every((value) => isValidCoord(value, game.board.length))) return;

        // Ist dieser Spieler gar nicht am Zug? Nach Spielende hat der Spieler am Zug keine erlaubten Züge mehr,
        // deshalb wird dann automatisch jeder Zug abgelehnt
        if (game.turn !== socket.color) {
            console.warn(`Zug abgelehnt (nicht am Zug): ${socket.id}`);
            return;
        }

        // Cheating-Schutz [8]: Ist die Zeit schon abgelaufen? Dann zählt der Zug nicht mehr. Meist hat der Wecker
        // das Spiel dann schon beendet (game.turn ist null), dies fängt einen Zug kurz vor dem Klingeln ab
        if (Date.now() > timeUpAt(game)) return;

        // Ist der Zug laut Regeln erlaubt? (Schlagzwang und Mehrfachsprung prüft rules.js)
        const legalMoves = getLegalMoves(game.board, game.turn, game.multiJumpFrom, game.variant);
        const move = findMove(legalMoves, fromR, fromC, toR, toC);
        if (!move) {
            console.warn(`Zug abgelehnt (nicht erlaubt): ${socket.id}`, moveData);
            return;
        }

        // Für die Remis-Regel merken: Begann der Zug mit einer Dame, und wurde (auch im Mehrfachsprung) geschlagen?
        if (!game.multiJumpFrom) {
            game.turnByKing = game.board[fromR][fromC].king;
            game.turnCaptured = false;
        }
        game.turnCaptured ||= Boolean(move.captured);

        // Zug auf dem Server-Brett ausführen
        const result = applyMove(game.board, move, game.variant);
        game.board = result.board;

        if (result.mustContinue) {
            // Mehrfachsprung: Derselbe Spieler ist noch einmal dran, aber nur mit diesem Stein
            game.multiJumpFrom = { row: toR, col: toC };
        } else {
            game.multiJumpFrom = null;

            // Verbrauchte Zeit abziehen (vor dem Münzwurf-Ende zählt nichts), dann läuft die Uhr des Gegners
            const now = Date.now();
            game.clock[game.turn] -= Math.max(now - game.turnStartedAt, 0);
            game.turn = opponentOf(game.turn);
            game.turnStartedAt = now;
            game.quietKingTurns = countQuietKingTurns(game.quietKingTurns, game.turnByKing, game.turnCaptured);

            // Partie entschieden (Sieg oder Remis): Wecker aus, keine Züge mehr. Sonst läuft der Wecker für den Gegner
            if (getWinner(game.board, game.turn, game.variant) || isDraw(game.quietKingTurns)) {
                clearTimeout(game.clockTimer);
                game.turn = null;
            } else {
                startClock(game);
            }
        }

        // Cheating-Schutz [4]: Nur die vier geprüften Werte weiterleiten, nie die Originalnachricht
        socket.to(socket.oppId).emit('receiveMove', { fromR, fromC, toR, toC });

        // Beiden den Stand der Uhren schicken, damit ihre Anzeige zur Uhr des Servers passt
        if (!result.mustContinue) {
            game.players.forEach((player) => player.emit('clockSync', { ...game.clock }));
        }
    });

    // Cheating-Schutz [5]: Chat-Nachrichten nur als Text, gekürzt und nur an den eigenen Gegner
    onSafe(socket, 'chatMessage', (msg) => {
        if (!socket.oppId || typeof msg !== 'string') return;

        // Leerzeichen am Rand entfernen und auf Maximallänge kürzen
        const cleanMsg = msg.trim().slice(0, MAX_CHAT_LENGTH);
        if (cleanMsg.length === 0) return; // Leere Nachrichten verwerfen

        // Cheating-Schutz [7]: bei zu vielen Nachrichten in kurzer Zeit verwerfen
        if (isTooFrequent(socket, 'chatTimes', CHAT_LIMIT, CHAT_WINDOW_MS)) return;

        // Leitet Nachricht nur an den verknüpften Gegner weiter
        socket.to(socket.oppId).emit('chatMessage', cleanMsg);
    });

    // Cheating-Schutz [10]: Remis anbieten. Nur in einer laufenden Partie, nur ein offenes Angebot, höchstens 3 pro Spieler
    onSafe(socket, 'offerDraw', () => {
        const game = socket.game;
        if (!game || !socket.oppId || game.turn === null || game.drawOfferBy) return;
        if (game.drawOffers[socket.color] >= MAX_DRAW_OFFERS) return;

        game.drawOffers[socket.color]++;
        game.drawOfferBy = socket.color;
        socket.to(socket.oppId).emit('drawOffered');
    });

    // Cheating-Schutz [10]: Antwort auf ein Remis-Angebot. Nur der Gegner des Anbietenden darf antworten
    onSafe(socket, 'answerDraw', (accept) => {
        const game = socket.game;
        if (!game || game.turn === null || !game.drawOfferBy || game.drawOfferBy === socket.color) return;

        game.drawOfferBy = null;
        if (accept === true) {
            // Remis: Wecker aus, keine Züge mehr, beide erfahren es
            clearTimeout(game.clockTimer);
            game.turn = null;
            game.players.forEach((player) => player.emit('drawAgreed'));
        } else {
            socket.to(socket.oppId).emit('drawDeclined');
        }
    });

    // Revanche: Startet, sobald beide Spieler sie wollen
    onSafe(socket, 'requestReplay', () => {
        socket.wantsReplay = true;
        if (socket.oppId) {
            const oppSocket = io.sockets.sockets.get(socket.oppId);

            if (oppSocket && oppSocket.wantsReplay) {
                // Beide wollen Revanche: neue Partie mit neu ausgelosten Farben starten
                socket.wantsReplay = false;
                oppSocket.wantsReplay = false;
                startMatch(socket, oppSocket);
            } else {
                // Gegner informieren
                socket.to(socket.oppId).emit('opponentWantsReplay');
            }
        }
    });

    // Spieler verlässt die Partie (Aufgeben oder "Zurück zur Lobby"): Gegner informieren
    onSafe(socket, 'leaveMatch', () => {
        endMatch(socket);
    });

    // Wenn ein Spieler den Tab schließt oder die Verbindung abbricht
    onSafe(socket, 'disconnect', () => {
        leaveQueue(socket);
        leaveRoom(socket);
        endMatch(socket);
        broadcastQueueStatus();
    });
});

// Einstellungen aus .env laden, falls vorhanden (process.loadEnvFile existiert ab Node 20.12)
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envFile);
}

/**
 * Prüft eine Portangabe und beendet den Server mit verständlicher Meldung, wenn sie ungültig ist
 */
function parsePort(input) {
    const port = Number(input);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        console.error(`Ungültiger Port "${input}". Erlaubt sind nur ganze Zahlen von 1 bis 65535.`);
        process.exit(1);
    }
    return port;
}

/**
 * Startet einen Server (HTTP oder HTTPS) mit verständlicher Meldung, falls der Port schon belegt ist
 */
function listen(server, port, protocol) {
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`Port ${port} ist bereits belegt. Anderen Port wählen, z.B.: npm start -- 8080 8443`);
        } else {
            console.error(`${protocol.toUpperCase()}-Server konnte nicht gestartet werden.`, err.message);
        }
        process.exit(1);
    });
    server.listen(port, () => console.log(`Server läuft auf ${protocol}://localhost:${port}`));
}

// Ports: 1. Kommandozeile (npm start -- 8080 8443), 2. Umgebungsvariablen PORT und HTTPS_PORT, 3. HTTP auf 3000
const PORT = parsePort(process.argv[2] || process.env.PORT || '3000');
const httpsPortInput = process.argv[3] || process.env.HTTPS_PORT;

// HTTPS nur, wenn ein HTTPS-Port angegeben ist. Erst alles prüfen, dann starten
let https = null;
let HTTPS_PORT = null;
if (httpsPortInput) {
    HTTPS_PORT = parsePort(httpsPortInput);

    // Zertifikat und privater Schlüssel (Standard: Ordner certs/, wird nicht ins Repository übernommen)
    const certFile = path.resolve(__dirname, process.env.TLS_CERT || 'certs/server.crt');
    const keyFile = path.resolve(__dirname, process.env.TLS_KEY || 'certs/server.key');
    if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
        console.error(`Für HTTPS fehlen Zertifikat oder Schlüssel: ${certFile} und ${keyFile}`);
        console.error(`Wie man sie erzeugt, steht in der README im Abschnitt "HTTPS".`);
        process.exit(1);
    }

    // Derselbe Express-Server liefert die Seite aus, Socket.io hängt zusätzlich am HTTPS-Server.
    // Beide teilen sich Warteschlangen und Partien: Ein Spieler über HTTP kann gegen einen über HTTPS spielen.
    https = createSecureServer({ cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) }, app);
    io.attach(https);
}

listen(http, PORT, 'http');
if (https) listen(https, HTTPS_PORT, 'https');
