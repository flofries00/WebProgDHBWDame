const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Sagt dem Server, dass er nur die Client-Dateien aus dem Ordner 'public' ausliefern soll
// (sonst wären auch server.js, package.json und node_modules abrufbar)
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// Wartenden Spieler merken
let waiting = null;

// Wartet auf Browser-Verbindungen
io.on('connection', (socket) => {
    console.log('Verbunden: ', socket.id);

        socket.on('findMatch', (name) => {
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
    socket.on('cancelSearch', () => {
        if (waiting === socket) waiting = null;
    });

    // Wartet auf Züge und schickt diese an den Gegner
    socket.on('makeMove', (moveData) => {
        if (socket.oppId) {
            socket.to(socket.oppId).emit('recieveMove', moveData);
        }
    });

    // Wartet auf Chat-Nachrichten und schickt sie an den Gegner
    socket.on('chatMessage', (msg) => {
        if (socket.oppId) {
            // Leitet Nachricht nur an den verknüpften Gegner weiter
            socket.to(socket.oppId).emit('chatMessage', msg);
        }
    });

    // Replay-Logik
    socket.on('requestReplay', () => {
        socket.wantsReplay = true;
        if (socket.oppId) {
            const oppSocket = io.sockets.sockets.get(socket.oppId);

            if (oppSocket && oppSocket.wantsReplay) {
                // Beide wollen Revanche - Spiel starten
                socket.wantsReplay = false;
                oppSocket.wantsReplay = false;

                const p1White = Math.random() < 0.5;
                socket.emit('matchFound', {
                    oppName: oppSocket.name || "Gegner", isWhite: p1White
                });
                oppSocket.emit('matchFound', {
                    oppName: socket.name || "Gegner", isWhite: !p1White
                });
            } else {
                // Gegner informieren
                socket.to(socket.oppId).emit('opponentWantsReplay');
            }
        }
    });

    socket.on('leaveMatch', () => {
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
    socket.on('disconnect', () => {
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

// Server starten (Port über Umgebungsvariable PORT änderbar, Standard: 3000)
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Läuft auf Port ${PORT}`));