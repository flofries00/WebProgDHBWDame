import { state } from './state.js';
import { socket } from './socket.js';
import { showScreen, leaveToLobby, fireConfetti, fireRain, showConfirm } from './ui.js';
import { playSound } from './sound.js';
import { BOARD_SIZE, createInitialBoard, getLegalMoves, findMove, applyMove, getWinner } from './rules.js';

// Globale Variablen für das Spielfeld
let board = []; // Spielbrett als Daten
let currentTurn = 'white'; // Weiß hat nach den bekannten Dame-Regeln immer den ersten Zug
let selectedPiece = null; // Speichert das HTML-Element des aktuell angeklickten Steins.
let moveCount = 0; // Zählt Züge mit
let whiteTime = 300; // Startzeit Weiß (5min / 300s)
let blackTime = 300; // Startzeit Schwarz (5min / 300s)
let timerInterval = null;
let isMultiJumping = false; // Sperrt andere Steine während eines Multisprungs

let computerMoveTimeout = null; // Ausstehender Computerzug (damit er abgebrochen werden kann)

/**
 * Liefert ein Feld des ECHTEN Spielbretts (nicht der Kopie im Endbildschirm)
 */
function getCell(r, c) {
    return document.getElementById('board').querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
}

/**
 * Liefert Zeile und Spalte des Feldes, in dem ein Element (Stein oder Feld) liegt
 */
function getPosition(element) {
    const cell = element.closest('.cell');
    return { row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
}

/**
 * Ist der lokale Spieler gerade am Zug
 */
function isMyTurn() {
    return (currentTurn === 'white') === state.playerGetsWhite;
}

/**
 * Erlaubte Züge des Spielers am Zug (Schlagzwang berücksichtigt).
 * Während eines Mehrfachsprungs nur die Schläge des springenden Steins.
 */
function getCurrentLegalMoves() {
    const onlyFrom = isMultiJumping ? getPosition(selectedPiece) : null;
    return getLegalMoves(board, currentTurn, onlyFrom);
}

/**
 * Startet das eigentliche Brettspiel.
 */
export function startGame() {
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
    document.getElementById('p1Color').textContent = state.playerGetsWhite ? '(Weiß)' : '(Schwarz)';
    document.getElementById('compColor').textContent = state.playerGetsWhite ? '(Schwarz)' : '(Weiß)';

    // Dynamische Textanzeige
    updateTurnIndicator();

    // Zug-Log für neues Spiel leeren
    const logList = document.getElementById('logList');
    if (logList) logList.innerHTML = '';

    showScreen('gameScreen');
    generateBoard(); // Baut das HTML für das Spielbrett auf

    // Klicks ins Leere abfangen (nur während des Spiels)
    document.addEventListener('click', handleGlobalClick);

    // Direkt bei Start prüfen, ob Felder hervorgehoben werden müssen
    autoHighlightCaptures();

    // Initiales Sperren der Gegnerischen Steine
    updatePieceCursors();

    // Chatbox nur im Multiplayer aktivieren
    const chatInput = document.getElementById('chatInput');
    const chatBox = document.querySelector('.chat-messages');

    if (chatInput && chatBox) {
        if (state.gameMode === 'online') {
            chatInput.disabled = false;
            chatInput.placeholder = 'Nachricht schreiben...';
            chatBox.innerHTML = '<p class="sys-msg">Chat bereit. Sag Hallo!</p>';
        } else {
            chatInput.disabled = true;
            chatInput.placeholder = 'Chat im Singleplayer deaktiviert.';
            chatBox.innerHTML = '<p class="sys-msg">System offline.</p>';
        }
    }

    // Wenn Computer weiß ist, fängt er an
    if (state.gameMode === 'computer') {
        makeComputerMove();
    }
}

/**
 * Erstellt das Brett in der Startaufstellung und zeichnet es als HTML.
 */
function generateBoard() {
    board = createInitialBoard(); // Startaufstellung als Daten (rules.js)

    const boardElement = document.getElementById('board');
    boardElement.innerHTML = ''; // Brett komplett leeren, bevor es neu gebaut wird

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            // Jedes Feld ist ein Button: So ist es per Tastatur fokussierbar und reagiert auf Enter und Leertaste
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.tabIndex = -1; // Per Tab ist nur ein Feld erreichbar, der Rest geht über die Pfeiltasten

            // Schachbrettmuster: Ist Zeile + Spalte ungerade, ist das Feld dunkel
            const isBlackCell = (row + col) % 2 !== 0;
            cell.className = 'cell ' + (isBlackCell ? 'black-bg' : 'white-bg');

            // Koordinaten speichern, damit ein Klick dem richtigen Feld in den Brett-Daten zugeordnet werden kann
            cell.dataset.row = row;
            cell.dataset.col = col;

            // Stein laut Brett-Daten einsetzen
            const piece = board[row][col];
            if (piece) cell.appendChild(createPieceElement(piece));

            boardElement.appendChild(cell);
        }
    }

    // Startfeld für die Tastatur: das eigene Eckfeld unten links (aus Sicht des Spielers)
    const startCell = state.playerGetsWhite ? getCell(BOARD_SIZE - 1, 0) : getCell(0, BOARD_SIZE - 1);
    startCell.tabIndex = 0;
    // Brett visuell um 180° drehen, wenn man Schwarz hat
    const wrapper = document.getElementById('boardWrapper');
    if (!state.playerGetsWhite) {
        wrapper.classList.add('flipped');
    } else {
        wrapper.classList.remove('flipped');
    }
}

/**
 * Erstellt das HTML-Element für einen Stein aus den Brett-Daten ({ color, king })
 */
function createPieceElement(piece) {
    const element = document.createElement('span');
    element.className = `piece ${piece.color}-piece` + (piece.king ? ' dame' : '');
    element.draggable = true;
    element.addEventListener('dragstart', handleDragStart);
    element.addEventListener('dragend', handleDragEnd);
    return element;
}

/**
 * Wählt einen Stein aus (per Klick, Tastatur oder beim Start von Drag & Drop)
 * isTrusted: true bei echten Eingaben des Spielers, false bei simulierten Klicks
 */
function selectPiece(pieceElement, isTrusted) {
    // Während eines Mehrfachsprungs ist nur der springende Stein anklickbar
    if (isMultiJumping && pieceElement !== selectedPiece) {
        return;
    }

    // a) Gehört der Stein dem Spieler, der gerade am Zug ist? (laut Brett-Daten)
    const { row, col } = getPosition(pieceElement);
    if (board[row][col]?.color !== currentTurn) {
        return;
    }

    // Echte Klicks des Spielers blockieren, der nicht am Zug ist
    if (!isMyTurn() && isTrusted) {
        return;
    }

    // Erlaubte Züge genau dieses Steins (Schlagzwang ist in rules.js bereits berücksichtigt)
    const moves = getCurrentLegalMoves().filter((move) => move.fromRow === row && move.fromCol === col);
    if (moves.length === 0) {
        return; // Stein kann nicht ziehen oder ein anderer Stein muss schlagen
    }

    // b) Vorherige Auswahl aufheben (falls man doch einen anderen Stein ziehen will)
    clearSelection();

    // c) Neuen Stein als "ausgewählt" markieren und seine Zielfelder anzeigen
    selectedPiece = pieceElement;
    pieceElement.classList.add('selected');
    showValidMoves(moves);
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
    document.querySelectorAll('.cell.highlighted, .cell.highlighted-capture').forEach((cell) => {
        cell.classList.remove('highlighted', 'highlighted-capture');
    });
    updateCellLabels();
}

/**
 * Markiert die Zielfelder der übergebenen Züge (grün mit Punkt = ziehen, rot mit Ring = schlagen)
 */
function showValidMoves(moves) {
    moves.forEach((move) => {
        const cell = getCell(move.toRow, move.toCol);
        cell.classList.add(move.captured ? 'highlighted-capture' : 'highlighted');
    });
    updateCellLabels();
}

/**
 * Wandelt Zeile und Spalte in die Brettschreibweise um (z.B. 7, 0 -> "A1")
 */
function toSquareName(row, col) {
    return 'ABCDEFGH'[col] + (BOARD_SIZE - row);
}

/**
 * Beschriftet jedes Feld für Screenreader, z.B. "C3, weißer Stein, ausgewählt" oder "B4, leer, hierhin ziehen"
 */
function updateCellLabels() {
    document
        .getElementById('board')
        .querySelectorAll('.cell')
        .forEach((cell) => {
            const { row, col } = getPosition(cell);
            const piece = board[row][col];
            const parts = [toSquareName(row, col)];

            if (cell.classList.contains('white-bg')) {
                parts.push('helles Feld');
            } else if (piece) {
                const colorName = piece.color === 'white' ? 'weiß' : 'schwarz';
                parts.push(piece.king ? `${colorName}e Dame` : `${colorName}er Stein`);
            } else {
                parts.push('leer');
            }

            if (cell.querySelector('.selected')) parts.push('ausgewählt');
            if (cell.classList.contains('highlighted')) parts.push('hierhin ziehen');
            if (cell.classList.contains('highlighted-capture')) parts.push('hierhin schlagen');

            cell.setAttribute('aria-label', parts.join(', '));
        });
}

/**
 * Verarbeitet Klicks auf dem Spielbrett und führt Zug aus, wenn ein
 * gültiges Feld angeklickt wurde
 */
function handleBoardClick(event) {
    // Klick auf ein Feld mit Stein: Stein auswählen
    const pieceElement = event.target.closest('.cell')?.querySelector('.piece');
    if (pieceElement) {
        selectPiece(pieceElement, event.isTrusted);
        return;
    }
    // Überprüfen, ob Klick auf oder in einer der markierten Zellen landete
    const targetCell = event.target.closest('.cell.highlighted, .cell.highlighted-capture');

    // Abbruchbedingung, wenn keine markierte Zelle oder kein Stein ausgewählt wurde
    if (!targetCell || !selectedPiece) return;

    // Echte Klicks kommen nur vom Spieler, der am Zug ist (verhindert Eingriffe in Computer- / Gegnerzüge)
    if (event.isTrusted && !isMyTurn()) return;

    // Passenden erlaubten Zug suchen. Gibt es ihn laut Regeln nicht, passiert nichts.
    const from = getPosition(selectedPiece);
    const to = getPosition(targetCell);
    const move = findMove(getCurrentLegalMoves(), from.row, from.col, to.row, to.col);
    if (!move) return;

    // Sende Zug an Gegner
    if (state.gameMode === 'online' && event.isTrusted) {
        socket.emit('makeMove', { fromR: move.fromRow, fromC: move.fromCol, toR: move.toRow, toC: move.toCol });
    }

    // 1. Werte VOR dem Zug merken (für Animation und Trophäe)
    const startRect = selectedPiece.getBoundingClientRect();
    const isCapture = move.captured !== null;
    const victimColor = isCapture ? board[move.captured.row][move.captured.col].color : null;

    // 2. Zug in den Brett-Daten ausführen (rules.js liefert auch Beförderung und Mehrfachsprung)
    const result = applyMove(board, move);
    board = result.board;
    const getsPromoted = result.promoted;

    // 3. HTML an die neuen Brett-Daten anpassen
    if (isCapture) {
        getCell(move.captured.row, move.captured.col).innerHTML = ''; // Gegnerstein entfernen

        // Kleine Trophäe erzeugen und in Kopfzeile packen
        const trophy = document.createElement('div');
        trophy.className = `captured-piece ${victimColor}-piece`;
        const tCont = isMyTurn() ? 'p1Captured' : 'compCaptured';
        document.getElementById(tCont).appendChild(trophy);
    }

    // 'appendChild' verschiebt das HTML-Element automatisch in die neue Zelle
    const pieceToAnimate = selectedPiece;
    targetCell.appendChild(pieceToAnimate);
    pieceToAnimate.style.opacity = '1'; // Bugfix: Verhindert unsichtbare Steine bei Drag&Drop

    // Sound abspielen (Schlag oder normaler Zug)
    playSound(isCapture ? 'capture' : 'move');

    // Auf dem gedrehten Brett (Schwarz) sind alle Steine per CSS um 180° gedreht, damit sie aufrecht stehen
    // Animationen ersetzen transform komplett, deshalb muss jeder Schritt diese Drehung selbst enthalten.
    const isFlipped = document.getElementById('boardWrapper').classList.contains('flipped');
    const baseRot = isFlipped ? 180 : 0;
    // Hilfsfunktion: Dreht die Dame um 180 Grad und blendet die Krone ein
    const playPromoteAnim = () => {
        playSound('promote');
        pieceToAnimate.classList.add('hide-crown', 'dame');
        const spinAnim = pieceToAnimate.animate(
            [
                { transform: `rotate(${baseRot}deg) rotateY(0deg)` },
                { transform: `rotate(${baseRot}deg) rotateY(180deg)` },
            ],
            { duration: 400, easing: 'ease-in-out' }
        );

        spinAnim.onfinish = () => pieceToAnimate.classList.remove('hide-crown');
    };

    // 3. FLIP-Animation: NUR ausführen, wenn es kein Drag & Drop ('drop') war!
    if (event.type !== 'drop') {
        const endRect = pieceToAnimate.getBoundingClientRect();
        let dx = startRect.left - endRect.left;
        let dy = startRect.top - endRect.top;

        // DER NEUE TRICK: Wenn das Brett um 180 Grad gedreht ist, fliegen die Steine
        // lokal in die falsche Richtung. Wir drehen die Richtung mathematisch einfach um!
        if (isFlipped) {
            dx = -dx;
            dy = -dy;
        }

        const moveKeyframes = isCapture
            ? [
                  // Sprung über gegnerischen Stein
                  { transform: `translate(${dx}px, ${dy}px) rotate(${baseRot}deg) scale(1)`, zIndex: 10 },
                  { transform: `translate(${dx / 2}px, ${dy / 2}px) rotate(${baseRot}deg) scale(1.3)`, zIndex: 10 },
                  { transform: `translate(0px, 0px) rotate(${baseRot}deg) scale(1)`, zIndex: 10 },
              ]
            : [
                  // Normales, flaches Schweben
                  { transform: `translate(${dx}px, ${dy}px) rotate(${baseRot}deg)`, zIndex: 10 },
                  { transform: `translate(0px, 0px) rotate(${baseRot}deg)`, zIndex: 10 },
              ];

        const moveAnim = pieceToAnimate.animate(moveKeyframes, { duration: 350, easing: 'ease-in-out' });

        // Wenn er befördert wird, warten wir den Flug ab und drehen ihn dann
        if (getsPromoted) moveAnim.onfinish = playPromoteAnim;
    } else {
        // Beim Drag & Drop: Keine Flug-Animation, aber falls er befördert wird, Drehung abspielen!
        if (getsPromoted) playPromoteAnim();
    }

    // Zug in Log eintragen (übergibt nun auch getsPromoted)
    addToLog(move.fromRow, move.fromCol, move.toRow, move.toCol, isCapture, getsPromoted);

    // Mehrfachsprung: Laut Regeln muss derselbe Stein weiterschlagen
    if (result.mustContinue) {
        isMultiJumping = true; // Brett für andere Steine sperren
        clearSelection();
        selectedPiece = pieceToAnimate;
        selectedPiece.classList.add('selected');
        // Nächste Schläge nur anzeigen, wenn man selbst springt
        if (isMyTurn()) showValidMoves(getCurrentLegalMoves());

        updatePieceCursors(); // Andere Steine sperren

        // Falls Computer am Zug ist, darf auch er direkt nochmal springen
        if (state.gameMode === 'computer' && !isMyTurn()) makeComputerMove();
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
    if (state.gameMode === 'computer' && !isMyTurn()) makeComputerMove();
}

/**
 * Blendet bei Schlagzwang die roten Schlagfelder automatisch ein
 */
function autoHighlightCaptures() {
    // Nur für den eigenen Zug anzeigen, Pflichtschläge des Gegners bleiben verborgen
    if (!isMyTurn()) return;
    const moves = getCurrentLegalMoves();

    // Bei Schlagzwang enthält die Liste nur noch Schläge: diese sofort rot markieren
    if (moves.some((move) => move.captured)) {
        showValidMoves(moves);
    }
}

/**
 * Hebt Auswahl auf, wenn Spieler irgendwo anders auf die Seite klickt.
 */
function handleGlobalClick(event) {
    // Klicks des Spielers, der nicht dran ist, dürfen keine fremde Auswahl aufheben
    if (event.isTrusted && !isMyTurn()) return;

    // Wenn kein Stein ausgewählt ist, passiert nix
    if (!selectedPiece) return;

    // Geht Klick auf ein Feld mit eigenem Stein, greift selectPiece()
    if (event.target.closest('.cell')?.querySelector('.' + currentTurn + '-piece')) return;

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
    // Keine Steine oder kein erlaubter Zug mehr: Der Gegner gewinnt
    const winner = getWinner(board, currentTurn);
    if (winner) {
        endGame(winner);
        return true;
    }
    return false;
}

/**
 * Funktion, die das Spiel beendet und den Gewinner anzeigt.
 */
export function endGame(winnerColor, reason = '') {
    // Uhr anhalten
    clearInterval(timerInterval);

    // Ausstehenden Computerzug abbrechen
    clearTimeout(computerMoveTimeout);

    // Listener für Klicks ins Leere wird außerhalb des Spiels nicht mehr gebraucht
    document.removeEventListener('click', handleGlobalClick);

    // Gewinner ist der Spieler, dessen Farbe der Siegerfarbe entspricht
    const winner = (winnerColor === 'white') === state.playerGetsWhite ? state.currentPlayerName : state.opponentName;

    const textEl = document.getElementById('winnerText');
    if (reason === 'timeout') {
        textEl.textContent = `Zeit abgelaufen! ${winner} gewinnt!`;
    } else if (reason === 'opponentLeft') {
        textEl.textContent = `${state.opponentName} hat das Spiel verlassen. ${winner} gewinnt!`;
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
        clonedBoard.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
        // Alle CSS-Klassen für Markierungen und Auswahl auf dem geklonten Brett entfernen
        clonedBoard.querySelectorAll('.highlighted').forEach((el) => el.classList.remove('highlighted'));
        clonedBoard
            .querySelectorAll('.highlighted-capture')
            .forEach((el) => el.classList.remove('highlighted-capture'));
        clonedBoard.querySelectorAll('.selected').forEach((el) => el.classList.remove('selected'));
        // Die Kopie ist nur ein Bild: inert nimmt ihre Felder aus der Tab-Reihenfolge und vor dem Screenreader
        clonedBoard.inert = true;
        endBoardCont.appendChild(clonedBoard);
    }

    // Bildschrim wechseln
    showScreen('endScreen');

    // Konfetti und Fanfare zünden nur bei Gewinner, sonst Regen und Verlierermelodie
    if ((winnerColor === 'white' && state.playerGetsWhite) || (winnerColor === 'black' && !state.playerGetsWhite)) {
        fireConfetti();
        playSound('win');
    } else {
        fireRain();
        playSound('lose');
    }

    // Erst nach dem Einblenden nach unten scrollen, sonst berechnet der Browser die Höhe falsch
    if (endLogList) {
        endLogList.scrollTop = endLogList.scrollHeight;
    }
}

/**
 * Bricht das laufende Spiel nach Rückfrage ab und kehrt zur Lobby zurück
 * Online gewinnt dadurch automatisch der Gegner
 */
export async function abortGame() {
    const text =
        state.gameMode === 'online'
            ? 'Dein Gegner gewinnt dann automatisch.'
            : 'Die aktuelle Partie ist damit beendet.';

    // Auf die Antwort in der Bestätigungs-Box warten
    const confirmed = await showConfirm('Spiel wirklich aufgeben?', text, 'Aufgeben', 'Weiterspielen');
    if (!confirmed) return;

    // Uhr und ausstehenden Computerzug stoppen, sonst laufen sie im Hintergrund weiter
    stopGame();

    // Meldet den Abbruch im Online-Modus dem Server und wechselt zur Modusauswahl
    leaveToLobby();
}

/**
 * Stoppt alles, was im Hintergrund weiterhin laufen könnte
 * Wird beim Aufgeben und bei Verbindungsabbruch benutzt
 */
export function stopGame() {
    clearInterval(timerInterval);
    clearTimeout(computerMoveTimeout);
    document.removeEventListener('click', handleGlobalClick);
    clearSelection();
    isMultiJumping = false;
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
        const m = Math.floor(sec / 60)
            .toString()
            .padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const p1El = document.getElementById('p1Timer');
    const compEl = document.getElementById('compTimer');
    const p1Bar = document.getElementById('p1TimerBar');
    const compBar = document.getElementById('compTimerBar');

    const p1Time = state.playerGetsWhite ? whiteTime : blackTime;
    const compTime = state.playerGetsWhite ? blackTime : whiteTime;

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
socket.on('receiveMove', (m) => {
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
    // Stein auswählen, um Felder zu färben
    selectPiece(event.target, event.isTrusted);

    // Wurde der Stein nicht ausgewählt (wegen bspw. Schlagzwang), Drag abbrechen
    if (selectedPiece !== event.target) {
        event.preventDefault();
        return;
    }

    // Firefox startet das Ziehen nur, wenn Daten gesetzt werden (Chrome und Safari brauchen das nicht)
    event.dataTransfer.setData('text/plain', '');

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
    const text = isMyTurn() ? 'Du bist am Zug' : `${state.opponentName} ist am Zug`;
    document.getElementById('turnIndicator').textContent = text;
}

/**
 * Schreibt einen Zug in den Spielverlauf und scrollt mit
 */
function addToLog(sRow, sCol, eRow, eCol, isCapture, getsPromoted = false) {
    // Array-Indexe in Schach-Koordinaten umwandeln
    const startStr = toSquareName(sRow, sCol);
    const endStr = toSquareName(eRow, eCol);

    const name = isMyTurn() ? 'Du' : state.opponentName;
    const verb = isCapture ? 'schlägt' : 'zieht';
    const promoText = getsPromoted ? ' und wird zur Dame' : '';

    const li = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = name;
    li.append(strong, ` ${verb} von ${startStr} nach ${endStr}${promoText}`);

    const list = document.getElementById('logList');
    if (list) {
        list.appendChild(li);
        // Liste nach unten scrollen lassen
        list.scrollTop = list.scrollHeight;
    }
}

/**
 * Führt einen zufälligen, gültigen Zug für den Computer aus.
 */
function makeComputerMove() {
    // Nur agieren, wenn der Computer (der Gegner) dran ist
    if (state.gameMode !== 'computer' || isMyTurn()) return;

    // 1. Alle erlaubten Züge holen (Schlagzwang und Mehrfachsprung regelt rules.js)
    const moves = getCurrentLegalMoves();
    if (moves.length === 0) return;

    // 2. Zufälligen Zug auswählen
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    const pieceElement = getCell(randomMove.fromRow, randomMove.fromCol).children[0];
    const targetCell = getCell(randomMove.toRow, randomMove.toCol);

    // 3. Zug mit leichter Verzögerung ausführen, Timeout merken, damit er unterbrochen werden kann
    computerMoveTimeout = setTimeout(() => {
        pieceElement.click(); // Stein auswählen
        computerMoveTimeout = setTimeout(() => {
            targetCell.click(); // Ziel auswählen
        }, 300);
    }, 800);
}

/**
 * Setzt den Mauszeiger für gesperrte Steine auf "Verbot" und deaktiviert Drag & Drop
 */
function updatePieceCursors() {
    const allPieces = document.getElementById('board').querySelectorAll('.piece');

    allPieces.forEach((p) => {
        let isLocked = false;

        // Option A: Stein gehört nicht dem Spieler am Zug
        const { row, col } = getPosition(p);
        if (board[row][col]?.color !== currentTurn) isLocked = true;

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
    updateCellLabels();
}

/**
 * Tastatursteuerung des Bretts: Pfeiltasten bewegen den Fokus, Escape hebt die Auswahl auf
 * (Enter und Leertaste lösen bei Buttons automatisch einen Klick aus)
 */
function handleBoardKeydown(event) {
    const cell = event.target.closest('.cell');
    if (!cell) return;

    if (event.key === 'Escape') {
        // Wie ein Klick ins Leere: Auswahl aufheben, außer der Gegner ist dran oder ein Mehrfachsprung läuft
        if (!isMyTurn() || isMultiJumping) return;
        clearSelection();
        autoHighlightCaptures();
        return;
    }

    const directions = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault(); // Sonst scrollt Seite mit

    // Ist das Brett für Schwarz gedreht, zeigen die Pfeile auf dem Bildschirm in die Gegenrichtung
    const flip = state.playerGetsWhite ? 1 : -1;
    const { row, col } = getPosition(cell);
    const nextCell = getCell(row + direction[0] * flip, col + direction[1] * flip);
    nextCell?.focus(); // Am Brettrand gibt es kein nächstes Feld
}

/**
 * Merkt sich das zuletzt fokussierte Feld: Nur dieses ist per Tab erreichbar (Roving Tabindex)
 */
function handleBoardFocus(event) {
    const cell = event.target.closest('.cell');
    if (!cell) return;
    document.getElementById('board').querySelector('.cell[tabindex="0"]').tabIndex = -1;
    cell.tabIndex = 0;
}

// Listener sollen nur einmalig registriert werden (nicht bei jedem Spielstart)
document.getElementById('board').addEventListener('click', handleBoardClick);
document.getElementById('board').addEventListener('dragover', handleDragOver);
document.getElementById('board').addEventListener('drop', handleDrop);
document.getElementById('board').addEventListener('keydown', handleBoardKeydown);
document.getElementById('board').addEventListener('focusin', handleBoardFocus);

/**
 * TODOs (sortiert nach Bewertungskriterien, Abgabe 27.10. 8:00 Uhr):
 *
 * A) Pflicht-Anforderungen
 * Firefox + Safari von Hand testen
 *
 * B) Werkzeuge
 *
 * C) Umbau der Struktur
 *
 * D) Robustheit & Qualität
 *
 * E) Oberfläche
 * Kontrast für Schlagen ist nun schlechter geworden (BUG)
 * Boardbeschriftung auf allen Seiten (Richtig herum soll es immer links und unten stehen)
 * Andere Farbschemata für Brett und Steine einbauen (Kontrast beachten!)
 * Top-Bar überarbeiten (Überschrift in die Mitte - vllt. was anderes als nur "DAME", Logo nach links außen)
 *
 * F) Abschluss
 * UI abschließend kontrollieren
 * Code-Kommentare verbessern
 * Github-Repo aufräumen (README, Lizenz), Präsentation vorbereiten
 * Auto-Klick bei Schlägen (also nicht erst Klick auf Stein sondern direkt auf Feld)
 *
 * G) Optional, nur wenn Zeit bleibt
 * Github CI, Dark-Mode, Tutorial, Performance
 * Variante "International" (#18), Private Räume
 * Durchklickbares Game-Replay (Zug für Zug)
 */
