const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Sagt dem Server, dass er unsere HTML/CCS/JS Dateien
// aus dem aktuellen Ordner ausliefern soll
app.use(express.static(__dirname));

// Wartenden Spieler merken
let waiting = null;

// Wartet auf Browser-Verbindungen
io.on('connection', (socket) => {
    console.log('Verbunden: ', socket.id);

    socket.on('findMatch', (name) => {
        if (waiting) {
            // Zweiter Spieler ist da -> Match gefunden
            const p1 = waiting;
            const p2 = { socket: socket, name: name };
            waiting = null; // Warteschlange leeren

            // IDs für spätere Spielzüge merken
            p1.socket.oppId = p2.socket.id;
            p2.socket.oppId = p1.socket.id;

            // Server würfelt Startspieler aus
            const p1White = Math.random() < 0.5;

            // Information an Spieler 1
            p1.socket.emit('matchFound', {
                oppName: p2.name,
                isWhite: p1White
            });

            // Information an Spieler 2
            p2.socket.emit('matchFound', {
                oppName: p1.name,
                isWhite: !p1White
            });
        } else {
            // Erster Spieler wartet
            waiting = { socket: socket, name: name };
        }
    });
    // Wartet auf Züge und schickt diese an den Gegner
    socket.on('makeMove', (moveData) => {
        if (socket.oppId) {
            socket.to(socket.oppId).emit('recieveMove', moveData);
        }
    });

    // Wenn ein Spieler während des Wartens den Tab schließt
    socket.on('disconnect', () => {
        if (waiting && waiting.socket.id === socket.id) {
            waiting = null;
        }
    });
});

// Server auf Port 3000 starten
const PORT = 3000;
http.listen(PORT, () => console.log(`Läuft auf Port ${PORT}`));