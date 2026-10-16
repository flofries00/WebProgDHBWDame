const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { maxHttpBufferSize: 1e4 }); // So werden Nachrichten über 10kB abgelehnt

// Sagt dem Server, dass er nur die Client-Dateien aus dem Ordner 'public' ausliefern soll
// (sonst wären auch server.js, package.json und node_modules abrufbar)
const path = require('path');
const fs = require('fs');
app.use(express.static(path.join(__dirname, 'public')));

// Wartenden Spieler merken
let waiting = null;

// Grenzen für Eingaben vom Client
const MAX_CHAT_LENGTH = 200;
const BOARD_SIZE = 8;

/**
 * Prüft, ob ein Wert eine gültige Brettkoordinate ist
 */
function isValidCoord(value) {
  return Number.isInteger(value) && value >= 0 && value < BOARD_SIZE;
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

// Wartet auf Browser-Verbindungen
io.on('connection', (socket) => {
  console.log('Verbunden: ', socket.id);

  onSafe(socket, 'findMatch', (name) => {
    // Namen auch serverseitig prüfen (Client-Prüfung lässt sich umgehen)
    if (typeof name !== 'string' || !/^[a-zA-Z0-9äöüÄÖÜß]{2,16}$/.test(name)) return;

    socket.name = name; // Namen speichern, wichtig für Revanche
    socket.wantsReplay = false; // Alte Revanche-Wünsche verwerfen

    // Zweiter Spieler ist da (und nicht derselbe Spieler) -> Match gefunden
    if (waiting && waiting !== socket) {
      const p1 = waiting;
      const p2 = socket;
      waiting = null; // Warteschlange leeren

      // IDs für spätere Spielzüge merken
      p1.oppId = p2.id;
      p2.oppId = p1.id;

      // Server würfelt Startspieler aus
      const p1White = Math.random() < 0.5;

      // Information an beide Spieler
      p1.emit('matchFound', { oppName: p2.name, isWhite: p1White });
      p2.emit('matchFound', { oppName: p1.name, isWhite: !p1White });
    } else {
      // Erster Spieler wartet
      waiting = socket;
    }
  });

  // Spieler bricht die Suche ab
  onSafe(socket, 'cancelSearch', () => {
    if (waiting === socket) waiting = null;
  });

  // Wartet auf Züge und schickt diese an den Gegner
  onSafe(socket, 'makeMove', (moveData) => {
    if (!socket.oppId || !moveData) return;

    const { fromR, fromC, toR, toC } = moveData;

    // Nur gültige Koordinaten akzeptieren, sonst Nachricht verwerfen
    if (![fromR, fromC, toR, toC].every(isValidCoord)) return;

    // Nur die vier geprüften Werte weiterleiten
    socket.to(socket.oppId).emit('recieveMove', { fromR, fromC, toR, toC });
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

  // Replay-Logik
  onSafe(socket, 'requestReplay', () => {
    socket.wantsReplay = true;
    if (socket.oppId) {
      const oppSocket = io.sockets.sockets.get(socket.oppId);

      if (oppSocket && oppSocket.wantsReplay) {
        // Beide wollen Revanche - Spiel starten
        socket.wantsReplay = false;
        oppSocket.wantsReplay = false;

        const p1White = Math.random() < 0.5;
        socket.emit('matchFound', {
          oppName: oppSocket.name || 'Gegner',
          isWhite: p1White,
        });
        oppSocket.emit('matchFound', {
          oppName: socket.name || 'Gegner',
          isWhite: !p1White,
        });
      } else {
        // Gegner informieren
        socket.to(socket.oppId).emit('opponentWantsReplay');
      }
    }
  });

  onSafe(socket, 'leaveMatch', () => {
    socket.wantsReplay = false;
    if (socket.oppId) {
      socket.to(socket.oppId).emit('opponentLeft');
      const oppSocket = io.sockets.sockets.get(socket.oppId);
      if (oppSocket) {
        oppSocket.oppId = null;
        oppSocket.wantsReplay = false;
      }
      socket.oppId = null;
    }
  });

  // Wenn ein Spieler während des Wartens den Tab schließt
  onSafe(socket, 'disconnect', () => {
    if (waiting === socket) {
      waiting = null;
    }

    if (socket.oppId) {
      socket.to(socket.oppId).emit('opponentLeft');
      const oppSocket = io.sockets.sockets.get(socket.oppId);
      if (oppSocket) {
        oppSocket.oppId = null;
        oppSocket.wantsReplay = false;
      }
    }
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
  console.error(`Ungüliger Port "${portInput}". Erlaubt sind nur ganze Zahlen von 1 bis 65535.`);
  process.exit(1);
}

// Verständliche Meldung, falls der Port schon belegt ist
http.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} ist bereits belegt. Anderen Port wählen, z.B.: npm start --8080`);
  } else {
    console.error('Server konnte nicht gestartet werden.', err.message);
  }
  process.exit(1);
});

http.listen(PORT, () => console.log(`Server läuft auf http://localhost:${PORT}`));
