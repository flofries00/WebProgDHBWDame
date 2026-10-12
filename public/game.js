// Globale Variablen für das Spielfeld
let currentTurn = 'white' // Weiß hat nach den bekannten Dame-Regeln immer den ersten Zug
let selectedPiece = null; // Speichert das HTML-Element des aktuell angeklickten Steins.
let moveCount = 0; // Zählt Züge mit
let whiteTime = 300; // Startzeit Weiß (5min / 300s)
let blackTime = 300; // Startzeit Schwarz (5min / 300s)
let timerInterval = null;
let isMultiJumping = false; // Sperrt andere Steine während eines Multisprungs

/* Hilfsfunktionen */
let computerMoveTimeout = null; // Ausstehender Computerzug (damit er abgebrochen werden kann)

// Alle vier Diagonalen
const DIRECTIONS = [
    { dr: -1, dc: -1 }, // Oben Links
    { dr: -1, dc: 1 }, // Oben Rechts
    { dr: 1, dc: -1 }, // Unten Links
    { dr: 1, dc: 1 } // Unten Rechts
];

/**
 * Liefert ein Feld des ECHTEN Spielbretts (nicht der Kopie im Endbildschirm)
 */
function getCell(r, c) {
    return document.getElementById('board').querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
}

/**
 * Liefert alle Steine einer Farbe auf dem echten Spielbrett (ohne Trophäen und Endbildschirm-Kopie)
 */
function getPieces(color) {
    return document.getElementById('board').querySelectorAll(`.${color}-piece`);
}

/**
 * Prüft, ob Koordinaten auf dem Brett liegen
 */
function isOnBoard(r, c) {
    return r >= 0 && r <= 7 && c >= 0 && c <= 7;
}

/**
 * Ist der lokale Spieler gerade am Zug
 */
function isMyTurn() {
    return (currentTurn === 'white') === playerGetsWhite;
}

/**
 * Berechnet alle möglichen Züge eines Steins (normale Steine und Damen)
 * Rückgabe: Array aus { target: Zielzelle, victim: Zelle des geschlagenen Steins oder null }
 */
function getMoves(piece) {
    const row = parseInt(piece.parentElement.dataset.row);
    const col = parseInt(piece.parentElement.dataset.col);
    const opponentClass = piece.classList.contains('white-piece') ? 'black-piece' : 'white-piece';
    const moves = [];

    if (piece.classList.contains('dame')) {
        // Damen-Logik: Darf beliebig weit ziehen
        DIRECTIONS.forEach(dir => {
            let r = row + dir.dr;
            let c = col + dir.dc;
            let victim = null;

            while (isOnBoard(r, c)) {
                const cell = getCell(r, c);
                if (cell.children.length === 0){
                    //Leeres Feld: vor einem Gegner normaler Zug, dahinter Schlagzug
                    moves.push({ target: cell, victim: victim });
                } else if (!victim && cell.children[0].classList.contains(opponentClass)) {
                    victim = cell;
                } else {
                    break;
                }
                r += dir.dr;
                c += dir.dc;
            }
        });
    } else {
        // Normale Steine: Weiß zieht nach oben (-1), Schwarz nach unten (+1)
        const direction = piece.classList.contains('white-piece') ? -1 : 1;

        [-1, 1].forEach(dc => {
            const r = row + direction;
            const c = col + dc;
            if (!isOnBoard(r, c)) return;

            const cell = getCell(r, c);
            if (cell.children.length === 0) {
                moves.push({ target: cell, victim: null});
            } else if (cell.children[0].classList.contains(opponentClass)) {
                // Feld direkt hinter Gegner prüfen
                const jumpR = r + direction;
                const jumpC = c + dc;
                if (isOnBoard(jumpR, jumpC)) {
                    const jumpCell = getCell(jumpR, jumpC);
                    if (jumpCell.children.length === 0) moves.push({ target: jumpCell, victim: cell });
                }
            }
        });
    }
    return moves;
}





/**
 * Startet das eigentliche Brettspiel.
 */
function startGame() {

    // Spielstatus und Trophäen resetten
    currentTurn = 'white';
    moveCount = 0;
    isMultiJumping = false;
    selectedPiece = null;
    clearTimeout(computerMoveTimeout);

    document.getElementById('p1Captured').innerHTML = '';
    document.getElementById('compCaptured').innerHTML = '';

    // Startzeiten zurücksetzen und Anzeige aktualisieren
    whiteTime = 300;
    blackTime = 300;
    updateTimerDisplays();
    startTurnTimer();

    // Kopfzeile dynamisch anpassen, basierend auf Farbwahl-Zufallsevent
    document.getElementById('p1Color').textContent = playerGetsWhite ? "(Weiß)" : "(Schwarz)";
    document.getElementById('compColor').textContent = playerGetsWhite ? "(Schwarz)" : "(Weiß)";

    // Dynamische Textanzeige
    updateTurnIndicator();

    // Zug-Log für neues Spiel leeren
    const logList = document.getElementById('logList');
    if (logList) logList.innerHTML = '';

    showScreen('gameScreen');
    generateBoard(); // Baut das HTML für das Spielbrett auf

    // Direkt bei Start prüfen, ob Felder hervorgehoben werden müssen
    autoHighlightCaptures();

    // Initiales Sperren der Gegnerischen Steine
    updatePieceCursors();

    // Chatbox nur im Multiplayer aktivieren
    const chatInput = document.getElementById('chatInput');
    const chatBox = document.querySelector('.chat-messages');

    if (chatInput && chatBox) {
        if (gameMode === 'online') {
            chatInput.disabled = false;
            chatInput.placeholder = "Nachricht schreiben...";
            chatBox.innerHTML = '<p class="sys-msg">Chat bereit. Sag Hallo!</p>';
        } else {
            chatInput.disabled = true;
            chatInput.placeholder = "Chat im Singleplayer deaktiviert.";
            chatBox.innerHTML = '<p class="sys-msg">System offline.</p>';
        }
    }

    // Wenn Computer weiß ist, fängt er an
    if (gameMode === 'computer') {
        makeComputerMove();
    }
}

/**
 * Generiert dynamisch das 8x8 Spielbrett und platziert die Steine.
 */
function generateBoard() {
    const boardElement = document.getElementById('board');
    boardElement.innerHTML = ''; // Brett komplett leeren, bevor es neu gebaut wird

    // Zwei ineinandergeschachtelte Schleifen für 8 Zeilen (row) und 8 Spalten (col)
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {

            // Ein neues div für die Kachel (Zelle) erstellen
            const cell = document.createElement('div');

            // Mathematischer Trick zur Schachbrettmuster-Berechnung:
            // Wenn Zeile + Spalte eine ungerade Zahl ergibt, ist das Feld dunkel.
            const isBlackCell = (row + col) % 2 !== 0;

            // Die entsprechenden CSS-Klassen vergeben
            cell.className = 'cell ' + (isBlackCell ? 'black-bg' : 'white-bg');

            // Die Koordinaten (Zeile/Spalte) als Daten-Attribute speichern (wichtig für spätere Spiel-Logik!)
            cell.dataset.row = row;
            cell.dataset.col = col;

            // Spielsteine dürfen nach den Dame-Regeln nur auf dunklen Feldern liegen
            if (isBlackCell) {
                if (row < 3) {
                    const piece = document.createElement('div');
                    piece.className = 'piece black-piece'; // Oben immer Schwarz
                    piece.draggable = true; // Draggable machen
                    piece.addEventListener('click', selectPiece); // Klick-Event hinzufügen
                    piece.addEventListener('dragstart', handleDragStart); // DragDrop
                    piece.addEventListener('dragend', handleDragEnd);
                    cell.appendChild(piece); // Stein in die Kachel legen
                }
                else if (row > 4) {
                    const piece = document.createElement('div');
                    piece.className = 'piece white-piece'; // Unten immer Weiß
                    piece.draggable = true;
                    piece.addEventListener('click', selectPiece); // Klick-Event hinzufügen
                    piece.addEventListener('dragstart', handleDragStart); // DragDrop
                    piece.addEventListener('dragend', handleDragEnd);
                    cell.appendChild(piece); // Stein in die Kachel legen
                }
            }

            // Die fertige Kachel an das Spielbrett im HTML anhängen
            boardElement.appendChild(cell);
        }
    }

    // Brett visuell um 180° drehen, wenn man Schwarz hat
    const wrapper = document.getElementById('boardWrapper');
    if (!playerGetsWhite) {
        wrapper.classList.add('flipped');
    } else {
        wrapper.classList.remove('flipped');
    }
}

/**
 * Wird ausgelöst, wenn ein Spieler auf einen Spielstein klickt.
 */
function selectPiece(event) {
    const piece = event.target;

    // Multischlag-Sperre einbauen, kein Stein anklickbar
    if (isMultiJumping && piece !== selectedPiece) {
        return;
    }

    // a) Prüfen: Gehört der Stein dem Spieler, der gerade am Zug ist?
    // Wenn Weiß am Zug ist, darf man keine schwarzen Steine anklicken und umgekehrt
    if (!piece.classList.contains(currentTurn + '-piece')) {
        return; // Funktion abbrechen
    }

    // Echte Klicks des Spielers blockieren, der nicht am Zug ist
    // event.isTrusted ist 'true' bei echten Mausklicks, 'false' bei simulierten
    if (!isMyTurn() && event.isTrusted) {
        return;
    }

    // Schlagzwang prüfen
    const mandatoryCaptureExists = Array.from(getPieces(currentTurn)).some(p => canCapture(p));

    // Bei Schlagzwang, aber der ausgewählte Stein keinen Gegner schlagen kann
    if (mandatoryCaptureExists && !canCapture(piece)) {
        return;
    }

    // b) Vorherige Auswahl aufheben (falls man doch einen anderen Stein ziehen will)
    clearSelection();

    // c) Neuen Stein als "ausgewählt" markieren
    selectedPiece = piece;
    piece.classList.add('selected');

    // Zeigt alle validen Züge an und teilt Schlagzwang mit
    showValidMoves(piece, mandatoryCaptureExists);
}

/**
 * Entfernt alle Markierungen (ausgewählte Steine und hervorgehobene Felder)
 */
function clearSelection() {
    if (selectedPiece) {
        selectedPiece.classList.remove('selected');
        selectedPiece = null;
    }

    // Entfernt die Hintergrundfarbe von allen eventuell markierten Zielfeldern
    document.querySelectorAll('.cell.highlighted, .cell.highlighted-capture').forEach(cell => {
        cell.classList.remove('highlighted', 'highlighted-capture');
        // Gespeicherte Sprung-Daten vom vorherigen Klick löschen
        delete cell.dataset.jumpR;
        delete cell.dataset.jumpC;
    });
}

/**
 * Berechnet die erlaubten Züge für den ausgewählten Stein
 */
function showValidMoves(piece, mandatoryCaptureExists) {
    getMoves(piece).forEach(move => {
        if (move.victim) {
            move.target.classList.add('highlighted-capture');
            // Koordinaten des Opfers speichern
            move.target.dataset.jumpR = move.victim.dataset.row;
            move.target.dataset.jumpC = move.victim.dataset.col;
        } else if (!mandatoryCaptureExists) {
            move.target.classList.add('highlighted');
        }
    });
}

/**
 * Verarbeitet Klicks auf dem Spielbrett und führt Zug aus, wenn ein
 * gültiges Feld angeklickt wurde
 */
function handleBoardClick(event) {
    // Überprüfen, ob Klick auf oder in einer der markierten Zellen landete
    const targetCell = event.target.closest('.cell.highlighted, .cell.highlighted-capture');

    // Abbruchbedingung, wenn keine markierte Zelle oder kein Stein ausgewählt wurde
    if (!targetCell || !selectedPiece) return;

    // Echte Klicks kommen nur vom Spieler, der am Zug ist (verhindert Eingriffe in Computer- / Gegnerzüge)
    if (event.isTrusted && !isMyTurn()) return;

    // Sende Zug an Gegner
    if (gameMode === 'online' && event.isTrusted) {
        socket.emit('makeMove', {
            fromR: selectedPiece.parentElement.dataset.row,
            fromC: selectedPiece.parentElement.dataset.col,
            toR: targetCell.dataset.row,
            toC: targetCell.dataset.col
        });
    }

    // 1. Koordinaten VOR dem Wechsel speichern (für die Animation & Board-Log)
    const startRect = selectedPiece.getBoundingClientRect();
    const isCapture = targetCell.dataset.jumpR !== undefined;
    const startRow = parseInt(selectedPiece.parentElement.dataset.row);
    const startCol = parseInt(selectedPiece.parentElement.dataset.col);
    const endRow = parseInt(targetCell.dataset.row);
    const endCol = parseInt(targetCell.dataset.col);

    // Wurde ein Stein geschlagen?
    if (isCapture) {
        // "Opfer" suchen
        const victimCell = getCell(targetCell.dataset.jumpR, targetCell.dataset.jumpC);
        if (victimCell) {
            const victimIsWhite = victimCell.children[0].classList.contains('white-piece');
            victimCell.innerHTML = ''; // Gegnerstein löschen

            // Kleine Trophäe erzeugen und in Kopfzeile packen
            const trophy = document.createElement('div');
            trophy.className = 'captured-piece ' + (victimIsWhite ? 'white-piece' : 'black-piece');
            const tCont = isMyTurn() ? 'p1Captured' : 'compCaptured';
            document.getElementById(tCont).appendChild(trophy);
        }
    }

    // 'appendChild' verschiebt das HTML-Element automatisch in die neue Zelle
    const pieceToAnimate = selectedPiece;
    targetCell.appendChild(pieceToAnimate);
    pieceToAnimate.style.opacity = '1'; // Bugfix: Verhindert unsichtbare Steine bei Drag&Drop

    // 2. Dame-Beförderung vorbereiten
    let getsPromoted = false;

    if (pieceToAnimate.classList.contains('white-piece') && endRow === 0 && !pieceToAnimate.classList.contains('dame')) getsPromoted = true;
    if (pieceToAnimate.classList.contains('black-piece') && endRow === 7 && !pieceToAnimate.classList.contains('dame')) getsPromoted = true;

    // Hilfsfunktion: Dreht die Dame um 180 Grad und blendet die Krone ein
    const playPromoteAnim = () => {
        pieceToAnimate.classList.add('hide-crown', 'dame');
        const wrapper = document.getElementById('boardWrapper');
        const baseRot = wrapper.classList.contains('flipped') ? 180 : 0;
        const spinAnim = pieceToAnimate.animate([
            { transform: `rotate(${baseRot}deg) rotateY(0deg)` },
            { transform: `rotate(${baseRot}deg) rotateY(180deg)` }
        ], { duration: 400, easing: 'ease-in-out' });

        spinAnim.onfinish = () => pieceToAnimate.classList.remove('hide-crown');
    };

    // 3. FLIP-Animation: NUR ausführen, wenn es kein Drag & Drop ('drop') war!
    if (event.type !== 'drop') {
        const endRect = pieceToAnimate.getBoundingClientRect();
        let dx = startRect.left - endRect.left;
        let dy = startRect.top - endRect.top;

        // DER NEUE TRICK: Wenn das Brett um 180 Grad gedreht ist, fliegen die Steine
        // lokal in die falsche Richtung. Wir drehen die Richtung mathematisch einfach um!
        const wrapper = document.getElementById('boardWrapper');
        if (wrapper.classList.contains('flipped')) {
            dx = -dx;
            dy = -dy;
        }

        const moveKeyframes = isCapture
            ? [ // Sprung über gegnerischen Stein
                { transform: `translate(${dx}px, ${dy}px) scale(1)`, zIndex: 10 },
                { transform: `translate(${dx / 2}px, ${dy / 2}px) scale(1.3)`, zIndex: 10 },
                { transform: `translate(0px, 0px) scale(1)`, zIndex: 10 }
            ]
            : [ // Normales, flaches Schweben
                { transform: `translate(${dx}px, ${dy}px)`, zIndex: 10 },
                { transform: `translate(0px, 0px)`, zIndex: 10 }
            ];

        const moveAnim = pieceToAnimate.animate(moveKeyframes, { duration: 350, easing: 'ease-in-out' });

        // Wenn er befördert wird, warten wir den Flug ab und drehen ihn dann
        if (getsPromoted) moveAnim.onfinish = playPromoteAnim;

    } else {
        // Beim Drag & Drop: Keine Flug-Animation, aber falls er befördert wird, Drehung abspielen!
        if (getsPromoted) playPromoteAnim();
    }

    // Zug in Log eintragen (übergibt nun auch getsPromoted)
    addToLog(startRow, startCol, endRow, endCol, isCapture, getsPromoted);

    // Multischlag prüfen
    let canMultiJump = false;
    // Wenn geschlagen hat UND nicht zur Dame befördert wurde
    if (isCapture && !getsPromoted) {
        if (canCapture(pieceToAnimate)) {
            canMultiJump = true;
        }
    }

    if (canMultiJump) {
        isMultiJumping = true; // Brett für andere Steine sperren
        clearSelection();
        selectedPiece = pieceToAnimate;
        selectedPiece.classList.add('selected');
        showValidMoves(selectedPiece, true); // Zeigt zwangsweise nur die nächsten Schläge an

        updatePieceCursors(); // Andere Steine sperren

        // Falls Computer am Zug ist, darf auch er direkt nochmal springen
        if (gameMode === 'computer' && !isMyTurn()) makeComputerMove();
        return; // Funktion hier beenden - Kein Spielerwechsel
    }

    // Normales Zug-Ende - Multijump zurücksetzen
    isMultiJumping = false;

    // Markierungen aufheben
    clearSelection();

    // Zugzähler erhöhen
    moveCount++;

    // Spieler wechseln
    currentTurn = currentTurn === 'white' ? 'black' : 'white';

    // Überprüfen, ob Spiel entschieden ist
    if (checkWinCondition()) return;

    // Statusleiste aktualisieren
    updateTurnIndicator();

    // Nach dem Spielerwechsel prüfen, ob der neue Spieler im Schlagzwang ist
    autoHighlightCaptures();

    // Optischen Fokus der Uhr auf den neuen Spieler wechseln
    updateActiveTimerStyle();

    // Mauszeiger für neuen Spieler aktualisieren
    updatePieceCursors();

    // Falls Computer dran ist, nächsten regulären Zug auslösen
    if (gameMode === 'computer' && !isMyTurn()) makeComputerMove();
}

/**
 * HILFSFUNKTION: Prüft heimlich (ohne Markierungen), ob ein Stein einen Gegner schlagen kann.
 * Wird für die Schlagzwang-Prüfung genutzt.
 */
function canCapture(piece) {
    return getMoves(piece).some(move => move.victim);
}

/**
 * Prüft das gesamte Brett und blendet rote Schlagfelder automatisch ein.
 */
function autoHighlightCaptures() {
    const allMyPieces = getPieces(currentTurn);

    allMyPieces.forEach(piece => {
        if (canCapture(piece)) {
            // Zeichnet rote Felder sofort ein
            showValidMoves(piece, true);
        }
    });
}

/**
 * Hebt Auswahl auf, wenn Spieler irgendwo anders auf die Seite klickt.
 */
function handleGlobalClick(event) {
    // Klicks des Spielers, der nicht dran ist, dürfen keine fremde Auswahl aufheben
    if (event.isTrusted && !isMyTurn()) return;

    // Wenn kein Stein ausgewählt ist, passiert nix
    if (!selectedPiece) return;

    // Geht Klick auf eigenen Stein, greift selectPiece()
    if (event.target.classList.contains(currentTurn + '-piece')) return;

    // Geht Klick auf ein gültiges Zielfeld greift handleBoardClick()
    if (event.target.closest('.cell.highlighted, .cell.highlighted-capture')) return;

    // Mehrfachsprung darf nicht durch Klick ins Leere abgebrochen werden
    if (isMultiJumping) return;

    // In allen anderen Fällen
    clearSelection();

    // Falls Schlagzwang herrscht müssen alle roten Felder wieder auftauchen
    autoHighlightCaptures();
}

/**
 * Funktion, die am Zuganfang prüft, ob der aktuelle Spieler noch ziehen kann.
 */
function checkWinCondition() {
    const myPieces = getPieces(currentTurn);

    // Siegbedingung 1: Keine Steine mehr übrig
    if (myPieces.length === 0) {
        endGame(currentTurn === 'white' ? 'black' : 'white');
        return true;
    }

    // Siegbedingung 2: Kein Zug mehr möglich
    const hasMove = Array.from(myPieces).some(p => getMoves(p).length > 0);

    if (!hasMove) {
        endGame(currentTurn === 'white' ? 'black' : 'white');
        return true;
    }

    return false;
}

/**
 * Funktion, die das Spiel beendet und den Gewinner anzeigt.
 */
function endGame(winnerColor, reason = "") {
    // Uhr anhalten
    clearInterval(timerInterval);

    // Ausstehenden Computerzug abbrechen
    clearTimeout(computerMoveTimeout);

    let winner = "";
    if (winnerColor === 'white') {
        winner = playerGetsWhite ? currentPlayerName : opponentName;
    } else {
        winner = playerGetsWhite ? opponentName : currentPlayerName;
    }

    const textEl = document.getElementById('winnerText');
    if (reason === "timeout") {
        textEl.textContent = `Zeit abgelaufen! ${winner} gewinnt!`;
    } else if (reason === "opponentLeft"){
        textEl.textContent = `${opponentName} hat das Spiel verlassen. ${winner} gewinnt!`;
    } else {
        textEl.textContent = `${winner} hat gewonnen in ${moveCount} Zügen!`;
    }

    // Spielverlauf in Endbildschirm kopieren
    const logList = document.getElementById('logList');
    const endLogList = document.getElementById('endLogList');
    if (logList && endLogList) {
        endLogList.innerHTML = logList.innerHTML;
    }

    // Finales Spielbrett kopieren
    const endBoardCont = document.getElementById('endBoardContainer');
    const origWrapper = document.getElementById('boardWrapper');
    if (endBoardCont && origWrapper) {
        endBoardCont.innerHTML = ''; // Altes Brett löschen
        const clonedBoard = origWrapper.cloneNode(true);
        // Alle IDs in der Kopie entfernen, damit das echte Brett eindeutig bleibt
        clonedBoard.removeAttribute('id');
        clonedBoard.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
        // Alle CSS-Klassen für Markierungen und Auswahl auf dem geklonten Brett entfernen
        clonedBoard.querySelectorAll('.highlighted').forEach(el => el.classList.remove('highlighted'));
        clonedBoard.querySelectorAll('.highlighted-capture').forEach(el => el.classList.remove('highlighted-capture'));
        clonedBoard.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        endBoardCont.appendChild(clonedBoard);
    }

    // Bildschrim wechseln
    showScreen('endScreen');

    // Konfetti zünden nur bei Gewinner
    if ((winnerColor === 'white' && playerGetsWhite) || (winnerColor === 'black' && !playerGetsWhite)) {
        if (typeof fireConfetti === 'function') fireConfetti();
    }

    // Erst nach dem Einblenden nach unten scrollen, sonst berechnet der Browser die Höhe falsch
    if (endLogList) {
        const endLogBox = endLogList.parentElement;
        endLogBox.scrollTop = endLogBox.scrollHeight;
    }
}

/**
 * Startet das Sekundenticken der Uhr
 */
function startTurnTimer() {
    clearInterval(timerInterval);
    updateActiveTimerStyle();

    timerInterval = setInterval(() => {
        if (currentTurn === 'white') {
            whiteTime--;
            if (whiteTime <= 0) {
                whiteTime = 0;
                updateTimerDisplays();
                endGame('black', 'timeout');
                return;
            }
        } else {
            blackTime--;
            if (blackTime <= 0) {
                blackTime = 0;
                updateTimerDisplays();
                endGame('white', 'timeout');
                return;
            }
        }
        updateTimerDisplays();
    }, 1000);
}

/**
 * Formatiert Sekunden in MM:SS und schreibt sie ins HTML und prüft auf <= 30s
 */
function updateTimerDisplays() {
    const format = (sec) => {
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const p1El = document.getElementById('p1Timer');
    const compEl = document.getElementById('compTimer');
    const p1Bar = document.getElementById('p1TimerBar');
    const compBar = document.getElementById('compTimerBar');

    const p1Time = playerGetsWhite ? whiteTime : blackTime;
    const compTime = playerGetsWhite ? blackTime : whiteTime;

    // a) Digitaluhren aktualisieren
    p1El.textContent = format(p1Time);
    compEl.textContent = format(compTime);

    // b) Balkenbreite in Prozent berechnen (Basis: 300s)
    p1Bar.style.height = `${(p1Time / 300) * 100}%`;
    compBar.style.height = `${(compTime / 300) * 100}%`;

    // Warn-Blinken ab 30s aktivieren und für neues Spiel wieder entfernen
    if (p1Time <= 30) {
        p1El.classList.add('low-time');
        p1Bar.classList.add('low-time');
    } else {
        p1El.classList.remove('low-time');
        p1Bar.classList.remove('low-time');
    }
    if (compTime <= 30) {
        compEl.classList.add('low-time');
        compBar.classList.add('low-time');
    } else {
        compEl.classList.remove('low-time');
        compBar.classList.remove('low-time');
    }
}

/**
 * Hebt die Uhr des Spielers hervor, der am Zug ist
 */

function updateActiveTimerStyle() {
    const p1El = document.getElementById('p1Timer');
    const compEl = document.getElementById('compTimer');

    const isP1Turn = isMyTurn();

    if (isP1Turn) {
        p1El.classList.add('active-timer');
        compEl.classList.remove('active-timer');
    } else {
        compEl.classList.add('active-timer');
        p1El.classList.remove('active-timer');
    }
}

/**
 * Züge von Server empfangen und auf dem Brett simulieren
 */
socket.on('recieveMove', (m) => {
    // Number() verhindert, dass manipulierte Daten den Selektor sprengen
    const fCell = getCell(Number(m.fromR), Number(m.fromC));
    const tCell = getCell(Number(m.toR), Number(m.toC));

    if (fCell && tCell && fCell.children[0]) {
        // 1. Stein auswählen
        fCell.children[0].click();

        // 2. Zielfeld anklicken
        tCell.click();
    }
});

/**
 * Startet Ziehen eines Steins
 */
function handleDragStart(event) {
    // Klick simulieren, um Felder zu färben
    selectPiece(event);

    // Wurde der Stein nicht ausgewählt (wegen bspw. Schlagzwang), Drag abbrechen
    if (selectedPiece !== event.target) {
        event.preventDefault();
        return;
    }

    // Stein halbtransparent machen, während er am Mauszeiger hängt
    setTimeout(() => {
        if (selectedPiece === event.target) event.target.style.opacity = '0.3';
    }, 0);
}

/**
 * Setzt Optik des Steins nach Loslassen wieder zurück
 */
function handleDragEnd(event) {
    event.target.style.opacity = '1';
}

/**
 * Erlaubt Fallenlassen NUR auf gültigen Zielfeldern
 */
function handleDragOver(event) {
    const validCell = event.target.closest('.cell.highlighted, .cell.highlighted-capture');
    if (validCell) {
        event.preventDefault(); // Notwendig um Bereich als Drop-Zone freizugeben
    }
}

/**
 * Führt Zug bei Loslassen auf dem Ziel aus
 */
function handleDrop(event) {
    event.preventDefault();
    // Loslassen an bestehende Klick-Funktion übergeben
    handleBoardClick(event);
}


/**
 * Aktualisiert Kopfzeile
 */
function updateTurnIndicator() {
    const text = isMyTurn() ? "Du bist am Zug" : `${opponentName} ist am Zug`;
    document.getElementById('turnIndicator').textContent = text;
}

/**
 * Schreibt einen Zug in den Spielverlauf und scrollt mit
 */
function addToLog(sRow, sCol, eRow, eCol, isCapture, getsPromoted = false) {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    // Array-Indexe in Schach-Koordinaten umwandeln
    const startStr = letters[sCol] + (8 - sRow);
    const endStr = letters[eCol] + (8 - eRow);

    const name = isMyTurn() ? "Du" : opponentName;
    const verb = isCapture ? "schlägt" : "zieht";
    const promoText = getsPromoted ? " und wird zur Dame" : "";

    const li = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = name;
    li.append(strong, ` ${verb} von ${startStr} nach ${endStr}${promoText}`);

    const list = document.getElementById('logList');
    if (list) {
        list.appendChild(li);
        // Box nach unten scrollen lassen
        li.scrollIntoView({block: 'nearest'});
    }
}

/**
 * Führt einen zufälligen, gültigen Zug für den Computer aus.
 */
function makeComputerMove() {

    // Nur agieren, wenn der Computer (der Gegner) dran ist
    if (gameMode !== 'computer' || isMyTurn()) return;

    // Bei Mehrfachsprung darf nur der springende Stein weiterziehen
    const compPieces = (isMultiJumping && selectedPiece) ? [selectedPiece] : Array.from(getPieces(currentTurn));

    // 1. Alle möglichen Züge sammeln
    const allMoves = [];
    compPieces.forEach(piece => {
        getMoves(piece).forEach(move => allMoves.push({ piece: piece, target: move.target, victim: move.victim}));
    });
    
    // 2. Schlagzwang priorisieren
    const captureMoves = allMoves.filter(move => move.victim);
    const movesToPlay = captureMoves.length > 0 ? captureMoves : allMoves;
    if (movesToPlay.length === 0) return;

    // 3. Zufälligen Zug auswählen
    const randomMove = movesToPlay[Math.floor(Math.random() * movesToPlay.length)];

    // 4. Zug mit leichter Verzögerung ausführen. Timeout merken, damit er unterbrochen werden kann
    computerMoveTimeout = setTimeout(() => {
        randomMove.piece.click(); // Stein auswählen
        computerMoveTimeout = setTimeout (() => {
            randomMove.target.click(); // Ziel klicken
        }, 300);
    }, 800);
}

/**
 * Setzt den Mauszeiger für gesperrte Steine auf "Verbot" und deaktiviert Drag & Drop
 */
function updatePieceCursors() {
    const allPieces = document.getElementById('board').querySelectorAll('.piece');

    allPieces.forEach(p => {
        let isLocked = false;

        // Option A: Nicht der eigene Stein
        if (!p.classList.contains(currentTurn + '-piece')) isLocked = true;

        // Option B: Gegner ist am Zug
        if (!isMyTurn()) isLocked = true;

        // Option C: Multischlag läuft, aber falscher Stein
        if (isMultiJumping && p !== selectedPiece) isLocked = true;

        if (isLocked) {
            p.classList.add('locked');
            p.draggable = false; // Verhindert Geister-Drags
        } else {
            p.classList.remove('locked');
            p.draggable = true;
        }
    });
}

// Listener sollen nur einmalig registriert werden (nicht bei jedem Spielstart)
document.getElementById('board').addEventListener('click', handleBoardClick);
document.getElementById('board').addEventListener('dragover', handleDragOver);
document.getElementById('board').addEventListener('drop', handleDrop);
// Dokument überwachen, um Klicks ins Leere abzufangen
document.addEventListener('click', handleGlobalClick);

/**
 * Zwischenstand:
 * TODOs:
 * Build-Process: Lässt sich Projekt nach Checkout bauen? (Build-Datei)
 * UI abschließend kontrollieren
 * Abbrechen-Button während Spiel
 * Move-Sound?
 * Tutorial einbauen
 * Dark-Mode
 */