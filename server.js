import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
// Dieselben Spielregeln wie im Browser: So kann der Server jeden Zug selbst prüfen (Schutz gegen Cheating)
import { VARIANTS, createInitialBoard, getLegalMoves, findMove, applyMove, opponentOf } from './public/js/rules.js';

// In ES-Modulen gibt es __dirname nicht automatisch, daher aus der Adresse dieser Datei berechnen
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const http = createServer(app);
const io = new Server(http, { maxHttpBufferSize: 1e4 }); // So werden Nachrichten über 10kB abgelehnt

// Sagt dem Server, dass er nur die Client-Dateien aus dem Ordner 'public' ausliefern soll
// (sonst wären auch server.js, package.json und node_modules abrufbar)
app.use(express.static(path.join(__dirname, 'public')));

// Erlaubte Bedenkzeiten in Minuten, 'party' = beide bekommen dieselbe Zufallszeit von 1 bis 10 Minuten
const TIME_SETTINGS = ['1', '3', '5', '10', 'party'];

// Wartende Spieler, eine Warteschlange pro Variante und Bedenkzeit (es spielen nur Spieler mit gleicher Einstellung gegeneinander)
const waiting = new Map();

// Grenzen für Eingaben vom Client
const MAX_CHAT_LENGTH = 200;

/**
 * Prüft, ob ein Wert eine gültige Brettkoordinate auf einem Brett dieser Größe ist
 */
function isValidCoord(value, size) {
    return Number.isInteger(value) && value >= 0 && value < size;
}

/**
 * Registriert einen Socket-Handler mit try/catch: Ein Fehler bei einem einzelnen Ereignis
 * wird protokolliert, bringt aber nicht den ganzen Server zum Absturz
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
 * Startet eine neue Partie zwischen zwei Spielern: Der Server lost die Farben aus,
 * führt ein eigenes Brett und informiert beide Spieler.
 */
function startMatch(p1, p2) {
    const p1White = Math.random() < 0.5;

    // Bedenkzeit: Im Partymodus lost der Server sie aus, damit beide garantiert dieselbe Zeit bekommen
    const timeMinutes = p1.timeSetting === 'party' ? Math.floor(Math.random() * 10) + 1 : Number(p1.timeSetting);

    // Spielstand auf dem Server (beide Sockets zeigen auf dasselbe Objekt)
    const game = {
        variant: p1.variant, // Beide haben in derselben Warteschlange gewartet, also dieselbe Variante
        board: createInitialBoard(p1.variant),
        turn: 'white', // Weiß beginnt
        multiJumpFrom: null, // Während eines Mehrfachsprungs: Position des springenden Steins
    };
    p1.game = game;
    p2.game = game;
    p1.color = p1White ? 'white' : 'black';
    p2.color = p1White ? 'black' : 'white';

    // IDs für spätere Spielzüge merken
    p1.oppId = p2.id;
    p2.oppId = p1.id;

    p1.emit('matchFound', { oppName: p2.name || 'Gegner', isWhite: p1White, timeMinutes });
    p2.emit('matchFound', { oppName: p1.name || 'Gegner', isWhite: !p1White, timeMinutes });
}

/**
 * Trennt einen Spieler von seinem Gegner (beim Verlassen oder Verbindungsabbruch)
 */
function endMatch(socket) {
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
    // Pro Variante und Bedenkzeit: 1 = dort wartet jemand, z.B. { klassisch: { '1': 0, '3': 1 }, international: {} }
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
        // Namen, Bedenkzeit und Variante auch serverseitig prüfen (Client-Prüfung lässt sich umgehen)
        if (typeof name !== 'string' || !/^[a-zA-Z0-9äöüÄÖÜß]{2,16}$/.test(name)) return;
        if (!TIME_SETTINGS.includes(timeSetting)) return;
        if (typeof variant !== 'string' || !Object.hasOwn(VARIANTS, variant)) return;

        leaveQueue(socket); // Falls der Spieler noch mit einer anderen Einstellung wartet
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

    // Spieler bricht die Suche ab
    onSafe(socket, 'cancelSearch', () => {
        leaveQueue(socket);
        broadcastQueueStatus();
    });

    // Wartet auf Züge, prüft sie mit den Spielregeln und schickt nur erlaubte Züge an den Gegner
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

        // Ist der Zug laut Regeln erlaubt? (Schlagzwang und Mehrfachsprung prüft rules.js)
        const legalMoves = getLegalMoves(game.board, game.turn, game.multiJumpFrom, game.variant);
        const move = findMove(legalMoves, fromR, fromC, toR, toC);
        if (!move) {
            console.warn(`Zug abgelehnt (nicht erlaubt): ${socket.id}`, moveData);
            return;
        }

        // Zug auf dem Server-Brett ausführen
        const result = applyMove(game.board, move, game.variant);
        game.board = result.board;

        if (result.mustContinue) {
            // Mehrfachsprung: Derselbe Spieler ist noch einmal dran, aber nur mit diesem Stein
            game.multiJumpFrom = { row: toR, col: toC };
        } else {
            game.multiJumpFrom = null;
            game.turn = opponentOf(game.turn);
        }

        // Nur die vier geprüften Werte weiterleiten
        socket.to(socket.oppId).emit('receiveMove', { fromR, fromC, toR, toC });
    });

    // Wartet auf Chat-Nachrichten, bereinigt sie und schickt sie an den Gegner
    onSafe(socket, 'chatMessage', (msg) => {
        if (!socket.oppId || typeof msg !== 'string') return;

        // Leerzeichen am Rand entfernen und auf Maximallänge kürzen
        const cleanMsg = msg.trim().slice(0, MAX_CHAT_LENGTH);
        if (cleanMsg.length === 0) return; // Leere Nachrichten verwerfen

        // Leitet Nachricht nur an den verknüpften Gegner weiter
        socket.to(socket.oppId).emit('chatMessage', cleanMsg);
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

    onSafe(socket, 'leaveMatch', () => {
        endMatch(socket);
    });

    // Wenn ein Spieler den Tab schließt oder die Verbindung abbricht
    onSafe(socket, 'disconnect', () => {
        leaveQueue(socket);
        endMatch(socket);
        broadcastQueueStatus();
    });
});

// Einstellungen aus .env laden, falls vorhanden (process.loadEnvFile existiert ab Node 20.12)
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envFile);
}

// Port bestimmen: 1. Kommandozeile (npm start -- PORT_NR), 2. Umgebungsvariable PORT, 3. Standardport 3000
const portInput = process.argv[2] || process.env.PORT || '3000';
const PORT = Number(portInput);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    console.error(`Ungültiger Port "${portInput}". Erlaubt sind nur ganze Zahlen von 1 bis 65535.`);
    process.exit(1);
}

// Verständliche Meldung, falls der Port schon belegt ist
http.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} ist bereits belegt. Anderen Port wählen, z.B.: npm start -- 8080`);
    } else {
        console.error('Server konnte nicht gestartet werden.', err.message);
    }
    process.exit(1);
});

http.listen(PORT, () => console.log(`Server läuft auf http://localhost:${PORT}`));
