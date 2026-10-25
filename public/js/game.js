import { state } from './state.js';
import { socket } from './socket.js';
import { showScreen, leaveToLobby, fireConfetti, fireRain, showConfirm } from './ui.js';
import { playSound } from './sound.js';
import { createInitialBoard, getLegalMoves, findMove, applyMove, getWinner } from './rules.js';
import { t, setText, onLanguageChange } from './i18n.js';

const COLUMN_LETTERS = 'ABCDEFGHIJ'; // Spaltenbuchstaben, reichen bis zum 10x10 Brett

// Globale Variablen für das Spielfeld
let board = []; // Spielbrett als Daten
let currentTurn = 'white'; // Weiß hat nach den bekannten Dame-Regeln immer den ersten Zug
let selectedPiece = null; // HTML-Element des aktuell ausgewählten Steins
let moveCount = 0; // Anzahl der abgeschlossenen Züge (für den Endbildschirm)
let startTime = 300; // Bedenkzeit pro Spieler in Sekunden (wird bei Spielstart aus der Einstellung gesetzt)
let whiteTime = startTime; // Restzeit Weiß in Sekunden
let blackTime = startTime; // Restzeit Schwarz in Sekunden
let timerInterval = null;
let isMultiJumping = false; // Läuft ein Mehrfachsprung? Dann darf nur der springende Stein weiterziehen
let computerMoveTimeout = null; // Ausstehender Computerzug (damit er abgebrochen werden kann)
let drag = null; // Laufendes Ziehen eines Steins: { piece, pointerId, startX, startY, bounds, moved }
let turnHistory = []; // Brett nach jedem vollständigen Zug zum Nachspielen
let turnStart = null; // Startfeld des laufenden Zugs
let turnEnd = null; // Zielfeld des letzten Sprungs im laufenden Zug
let reviewIndex = 0; // Welcher Eintrag aus turnHistory gerade auf dem Endbrett zu sehen ist
let titleBlink = null; // Lässt den Punkt im Tab-Titel blinken, solange man im Hintergrund am Zug ist
let reviewBoard = null; // Brett im Endbildschirm, auf dem nachgespielt wird

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
    return getLegalMoves(board, currentTurn, onlyFrom, state.variant);
}

/**
 * Startet das eigentliche Brettspiel.
 */
export function startGame() {
    // Spielstand und geschlagene Steine (Trophäen) zurücksetzen
    currentTurn = 'white';
    moveCount = 0;
    isMultiJumping = false;
    selectedPiece = null;
    clearTimeout(computerMoveTimeout);

    document.getElementById('p1Captured').innerHTML = '';
    document.getElementById('compCaptured').innerHTML = '';

    // Startzeiten zurücksetzen und Anzeige aktualisieren
    startTime = state.timeMinutes * 60;
    whiteTime = startTime;
    blackTime = startTime;
    updateTimerDisplays();
    startTurnTimer();

    // Farben der Spieler in der Kopfzeile (beim Münzwurf ausgelost)
    setText(document.getElementById('p1Color'), state.playerGetsWhite ? 'game.white' : 'game.black');
    setText(document.getElementById('compColor'), state.playerGetsWhite ? 'game.black' : 'game.white');

    // Anzeigen, wer am Zug ist
    updateTurnIndicator();

    // Spielverlauf für die neue Partie leeren
    const logList = document.getElementById('logList');
    if (logList) logList.innerHTML = '';

    showScreen('gameScreen');
    generateBoard(); // Baut das HTML für das Spielbrett auf

    // Klicks ins Leere abfangen (nur während des Spiels)
    document.addEventListener('click', handleGlobalClick);

    // Direkt bei Start prüfen, ob Felder hervorgehoben werden müssen
    autoHighlightCaptures();

    // Steine sperren, die gerade nicht ziehen dürfen
    updatePieceCursors();

    // Chatbox nur im Multiplayer aktivieren
    const chatInput = document.getElementById('chatInput');
    const chatBox = document.querySelector('.chat-messages');

    if (chatInput && chatBox) {
        const online = state.gameMode === 'online';
        chatInput.disabled = !online;
        // Schlüssel am Attribut merken, damit auch der Platzhalter beim Sprachwechsel übersetzt wird
        const placeholderKey = online ? 'game.chatPlaceholder' : 'game.chatDisabled';
        chatInput.setAttribute('data-i18n-placeholder', placeholderKey);
        chatInput.placeholder = t(placeholderKey);

        const systemMessage = document.createElement('p');
        systemMessage.className = 'sys-msg';
        setText(systemMessage, online ? 'game.chatReady' : 'game.chatOffline');
        chatBox.replaceChildren(systemMessage);
    }

    // Hat der Computer Weiß, beginnt er (makeComputerMove prüft das selbst)
    if (state.gameMode === 'computer') {
        makeComputerMove();
    }
}

/**
 * Erstellt das Brett in der Startaufstellung und zeichnet es als HTML.
 */
function generateBoard() {
    board = createInitialBoard(state.variant); // Startaufstellung der gewählten Variante als Daten (rules.js)
    const size = board.length;

    // Nachspielen beginnt mit der Startaufstellung
    turnHistory = [{ board, from: null, to: null, logCount: 0 }];

    const boardElement = document.getElementById('board');
    boardElement.innerHTML = ''; // Brett komplett leeren, bevor es neu gebaut wird

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
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
            if (piece) {
                const pieceElement = createPieceElement(piece);
                pieceElement.addEventListener('pointerdown', handlePointerDown); // Drag & Drop mit Maus, Finger und Stift
                cell.appendChild(pieceElement);
            }

            boardElement.appendChild(cell);
        }
    }

    // Startfeld für die Tastatur: das eigene Eckfeld unten links (aus Sicht des Spielers)
    const startCell = state.playerGetsWhite ? getCell(size - 1, 0) : getCell(0, size - 1);
    startCell.tabIndex = 0;

    // Brettgröße für CSS und Beschriftung im Rahmen passend zur Variante
    const wrapper = document.getElementById('boardWrapper');
    wrapper.style.setProperty('--board-size', size);
    renderCoordinates(wrapper, size);

    // Brett visuell um 180° drehen, wenn man schwarz hat
    if (!state.playerGetsWhite) {
        wrapper.classList.add('flipped');
    } else {
        wrapper.classList.remove('flipped');
    }
}

/**
 * Schreibt die Beschriftung in den Rahmen: Buchstaben oben und unten, Zahlen links und rechts (von oben nach unten)
 */
function renderCoordinates(wrapper, size) {
    const makeLabels = (texts) =>
        texts.map((text) => {
            const span = document.createElement('span');
            span.textContent = text;
            return span;
        });
    const letters = [...COLUMN_LETTERS.slice(0, size)];
    const numbers = Array.from({ length: size }, (_, i) => size - i);

    wrapper.querySelectorAll('.coords-x').forEach((element) => element.replaceChildren(...makeLabels(letters)));
    wrapper.querySelectorAll('.coords-y').forEach((element) => element.replaceChildren(...makeLabels(numbers)));
}

/**
 * Erstellt das HTML-Element für einen Stein aus den Brett-Daten ({ color, king, taken })
 */
export function createPieceElement(piece) {
    const element = document.createElement('span');
    element.className = `piece ${piece.color}-piece` + (piece.king ? ' dame' : '') + (piece.taken ? ' taken' : '');
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

    // Gehört der Stein dem Spieler, der gerade am Zug ist? (laut Brett-Daten)
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

    // Vorherige Auswahl aufheben (falls man doch einen anderen Stein ziehen will)
    clearSelection();

    // Neuen Stein als "ausgewählt" markieren und seine Zielfelder anzeigen
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

    // Markierung von allen Zielfeldern entfernen
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
export function toSquareName(row, col, size) {
    return COLUMN_LETTERS[col] + (size - row);
}

// Beim Sprachwechsel die Felder neu beschriften (die Texte entstehen erst beim Zeichnen, nicht im HTML)
onLanguageChange(() => {
    if (board.length > 0) updateCellLabels();
});

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
            const parts = [toSquareName(row, col, board.length)];

            if (cell.classList.contains('white-bg')) {
                parts.push(t('board.lightSquare'));
            } else if (piece) {
                // Schlüssel z.B. 'board.whiteKing' oder 'board.blackPiece'
                parts.push(t(`board.${piece.color}${piece.king ? 'King' : 'Piece'}`));
            } else {
                parts.push(t('board.empty'));
            }

            if (cell.querySelector('.selected')) parts.push(t('board.selected'));
            if (cell.classList.contains('highlighted')) parts.push(t('board.moveHere'));
            if (cell.classList.contains('highlighted-capture')) parts.push(t('board.captureHere'));

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
    if (!targetCell) return;

    // Echte Klicks kommen nur vom Spieler, der am Zug ist (verhindert Eingriffe in Gegnerzüge)
    if (event.isTrusted && !isMyTurn()) return;

    // Auto-Klick bei Schlagzwang: Direkt auf ein rotes Feld geklickt, ohne vorher einen Stein zu wählen
    // Kann genau ein Stein dorthin schlagen, wird er automatisch ausgewählt
    if (!selectedPiece) {
        const to = getPosition(targetCell);
        const captures = getCurrentLegalMoves().filter(
            (move) => move.captured && move.toRow === to.row && move.toCol === to.col
        );
        if (captures.length !== 1) return; // Mehrere Steine können dorthin schlagen: erst den Stein wählen
        selectPiece(getCell(captures[0].fromRow, captures[0].fromCol).querySelector('.piece'), event.isTrusted);
    }

    // Abbruch, wenn kein Stein ausgewählt ist (z.B. weil die automatische Auswahl nicht erlaubt war)
    if (!selectedPiece) return;

    // Passenden erlaubten Zug suchen. Gibt es ihn laut Regeln nicht, passiert nichts.
    const from = getPosition(selectedPiece);
    const to = getPosition(targetCell);
    const move = findMove(getCurrentLegalMoves(), from.row, from.col, to.row, to.col);
    if (!move) return;

    // Online: Zug an den Server schicken (er prüft ihn und leitet ihn an den Gegner weiter)
    if (state.gameMode === 'online' && event.isTrusted) {
        socket.emit('makeMove', { fromR: move.fromRow, fromC: move.fromCol, toR: move.toRow, toC: move.toCol });
    }

    // 1. Werte VOR dem Zug merken (für Animation und Trophäe)
    const startRect = selectedPiece.getBoundingClientRect();
    const isCapture = move.captured !== null;
    const victimColor = isCapture ? board[move.captured.row][move.captured.col].color : null;

    // Für das Nachspielen: Startfeld des Zug und aktuelles Zielfeld
    if (!isMultiJumping) turnStart = { row: move.fromRow, col: move.fromCol };
    turnEnd = { row: move.toRow, col: move.toCol };

    // 2. Zug in den Brett-Daten ausführen (rules.js liefert auch Beförderung und Mehrfachsprung)
    const result = applyMove(board, move, state.variant);
    board = result.board;
    const getsPromoted = result.promoted;

    // 3. HTML an die neuen Brett-Daten anpassen
    if (isCapture) {
        // Kleine Trophäe erzeugen und in Kopfzeile packen
        const trophy = document.createElement('div');
        trophy.className = `captured-piece ${victimColor}-piece`;
        const tCont = isMyTurn() ? 'p1Captured' : 'compCaptured';
        document.getElementById(tCont).appendChild(trophy);
    }

    // 'appendChild' verschiebt das HTML-Element automatisch in die neue Zelle
    const pieceToAnimate = selectedPiece;
    targetCell.appendChild(pieceToAnimate);

    // Geschlagene Steine an die Brett-Daten anpassen: Klassisch verschwinden sie sofort.
    // International bleiben sie halb durchsichtig liegen, bis der ganze Zug zu Ende ist
    document
        .getElementById('board')
        .querySelectorAll('.piece')
        .forEach((element) => {
            const { row, col } = getPosition(element);
            if (!board[row][col]) element.remove();
            else element.classList.toggle('taken', Boolean(board[row][col].taken));
        });

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

    // 4. Flug-Animation (FLIP: Der Stein steht schon im Zielfeld und fliegt optisch vom Startfeld dorthin).
    //    Beim Drag & Drop entfällt sie, weil der Stein schon dort liegt.
    if (event.type !== 'drop') {
        const endRect = pieceToAnimate.getBoundingClientRect();
        let dx = startRect.left - endRect.left;
        let dy = startRect.top - endRect.top;

        // Auf dem gedrehten Brett (Schwarz) zeigt eine Verschiebung innerhalb des Bretts
        // in die Gegenrichtung des Bildschirms, deshalb wird sie umgekehrt
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

        // Bei einer Beförderung erst den Flug abwarten, dann die Dame drehen
        if (getsPromoted) moveAnim.onfinish = playPromoteAnim;
    } else {
        // Drag & Drop: keine Flug-Animation, bei einer Beförderung trotzdem die Dame drehen
        if (getsPromoted) playPromoteAnim();
    }

    // Zug in den Spielverlauf eintragen
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
        return; // Kein Spielerwechsel, derselbe Stein springt weiter
    }

    // Normales Zugende: Ein Mehrfachsprung ist damit vorbei
    isMultiJumping = false;

    // Markierungen aufheben
    clearSelection();

    // Zugzähler erhöhen
    moveCount++;

    // Brett nach dem vollständigen Zug für das Nachspielen merken
    recordTurn();

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

    // Ohne ausgewählten Stein gibt es nichts aufzuheben
    if (!selectedPiece) return;

    // Geht der Klick auf ein Feld mit eigenem Stein, greift selectPiece()
    if (event.target.closest('.cell')?.querySelector('.' + currentTurn + '-piece')) return;

    // Geht der Klick auf ein gültiges Zielfeld, greift handleBoardClick()
    if (event.target.closest('.cell.highlighted, .cell.highlighted-capture')) return;

    // Mehrfachsprung darf nicht durch Klick ins Leere abgebrochen werden
    if (isMultiJumping) return;

    // Sonst: Auswahl aufheben
    clearSelection();

    // Bei Schlagzwang die roten Felder wieder einblenden
    autoHighlightCaptures();
}

/**
 * Prüft nach einem Zug, ob der Spieler am Zug noch ziehen kann. Wenn nicht, endet das Spiel.
 */
function checkWinCondition() {
    // Keine Steine oder kein erlaubter Zug mehr: Der Gegner gewinnt
    const winner = getWinner(board, currentTurn, state.variant);
    if (winner) {
        endGame(winner);
        return true;
    }
    return false;
}

/**
 * Beendet das Spiel und zeigt den Endbildschirm. reason: '' (normales Ende), 'timeout' oder 'opponentLeft'
 */
export function endGame(winnerColor, reason = '') {
    // Endet das Spiel mitten in einem Zug (z.B. Zeit abgelaufen beim Mehrfachsprung), diesen Stand auch merken
    recordTurn();

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
        setText(textEl, 'end.timeout', { winner });
    } else if (reason === 'opponentLeft') {
        setText(textEl, 'end.opponentLeftWin', { name: state.opponentName, winner });
    } else {
        setText(textEl, moveCount === 1 ? 'end.wonOne' : 'end.won', { winner, moves: moveCount });
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
        // Auf dem Brett der Kopie wird die Partie nachgespielt, los gehts beim Endstand
        reviewBoard = clonedBoard.querySelector('.board');
        showReviewStep(turnHistory.length - 1);
    }

    // Zum Endbildschirm wechseln
    showScreen('endScreen');

    // Das Spiel ist vorbei, "Du bist am Zug" gilt nicht mehr
    updateTabTitle();

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
 * Merkt sich das Brett nach einem Zug für das Nachspielen (nur, wenn sich seit dem letzten Eintrag etwas geändert hat)
 */
function recordTurn() {
    if (turnHistory.at(-1).board === board) return;
    const logCount = document.getElementById('logList').children.length;
    turnHistory.push({ board, from: turnStart, to: turnEnd, logCount });
}

/**
 * Zeigt auf dem Endbrett den Stand nach Zug "index" (0 = Startaufstellung) und markiert den Zug im Spielverlauf
 */
function showReviewStep(index) {
    reviewIndex = index;
    const { board: snapshot, from, to } = turnHistory[index];
    const isAt = (square, row, col) => square?.row === row && square?.col === col;

    // Steine laut gemerktem Brett setzen, Start- und Zielfeld des Zugs markieren
    reviewBoard.querySelectorAll('.cell').forEach((cell) => {
        const { row, col } = getPosition(cell);
        const piece = snapshot[row][col];
        cell.replaceChildren(...(piece ? [createPieceElement(piece)] : []));
        cell.classList.toggle('review-from', isAt(from, row, col));
        cell.classList.toggle('review-to', isAt(to, row, col));
    });

    // Überschrift: Startaufstellung, Zwischenstand oder Endstand
    const last = turnHistory.length - 1;
    const title = document.getElementById('reviewTitle');
    if (index === last) setText(title, 'end.finalPosition');
    else if (index === 0) setText(title, 'end.startPosition');
    else setText(title, 'end.afterMove', { index, last });

    // Einträge dieses Zugs im Spielverlauf hervorheben (ein Mehrfachsprung hat mehrere Einträge)
    const firstEntry = index > 0 ? turnHistory[index - 1].logCount : 0;
    const lastEntry = turnHistory[index].logCount;
    [...document.getElementById('endLogList').children].forEach((li, i) => {
        li.classList.toggle('review-current', i >= firstEntry && i < lastEntry);
    });
    // Nur die Liste scrollen: scrollIntoView würde auf schmalen Bildschirmen die ganze Seite mitscrollen
    // und die Buttons unter dem Finger wegschieben. Der aktuelle Zug landet in der Mitte der Liste
    const list = document.getElementById('endLogList');
    const current = list.querySelector('.review-current');
    if (current) {
        const offset = current.getBoundingClientRect().top - list.getBoundingClientRect().top;
        list.scrollTop += offset - list.clientHeight / 2 + current.offsetHeight / 2;
    }
}

/**
 * Buttons unter dem Endbrett: 'start', 'prev', 'next' oder 'end'
 */
export function moveReview(step) {
    const last = turnHistory.length - 1;
    const targets = { start: 0, prev: reviewIndex - 1, next: reviewIndex + 1, end: last };
    showReviewStep(Math.min(Math.max(targets[step], 0), last));
}

/**
 * Bricht das laufende Spiel nach Rückfrage ab und kehrt zur Lobby zurück
 * Online gewinnt dadurch automatisch der Gegner
 */
export async function abortGame() {
    const text = state.gameMode === 'online' ? t('game.resignOnline') : t('game.resignComputer');

    // Auf die Antwort in der Bestätigungs-Box warten
    const confirmed = await showConfirm(t('game.resignTitle'), text, t('game.resignConfirm'), t('game.resignCancel'));
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
                timeExpired('black');
                return;
            }
        } else {
            blackTime--;
            if (blackTime <= 0) {
                blackTime = 0;
                timeExpired('white');
                return;
            }
        }
        updateTimerDisplays();
    }, 1000);
}

/**
 * Die Anzeige steht bei 0:00. Gegen den Computer ist das Spiel damit vorbei.
 * Online entscheidet der Server (Cheating-Schutz [8]): Die Anzeige wartet bei 0:00 auf seine Meldung "timeUp"
 */
function timeExpired(winner) {
    updateTimerDisplays();
    if (state.gameMode === 'online') {
        clearInterval(timerInterval);
        return;
    }
    endGame(winner, 'timeout');
}

/**
 * Zeigt die Restzeiten an: Digitaluhr (MM:SS), Zeitbalken und Warnung ab 30 Sekunden
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

    // b) Füllstand der Zeitbalken als Anteil von 0 bis 1 (Basis: Startzeit), die Richtung regelt das CSS
    p1Bar.style.setProperty('--time-left', p1Time / startTime);
    compBar.style.setProperty('--time-left', compTime / startTime);

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
 * Läuft gerade eine Partie? (Nachrichten des Servers zur Uhr können auch nach dem Spielende noch ankommen)
 */
const isPlaying = () => document.getElementById('gameScreen').classList.contains('active');

// Cheating-Schutz [8]: Nach jedem Zug schickt der Server den Stand seiner Uhr (in ms), die Anzeige
// übernimmt ihn. Die Uhr läuft danach weiter, auch wenn sie vorher bei 0:00 gewartet hat
socket.on('clockSync', (clock) => {
    if (!isPlaying() || !Number.isFinite(clock?.white) || !Number.isFinite(clock?.black)) return;
    whiteTime = Math.max(Math.ceil(clock.white / 1000), 0);
    blackTime = Math.max(Math.ceil(clock.black / 1000), 0);
    updateTimerDisplays();
    startTurnTimer();
});

// Cheating-Schutz [8]: Der Server meldet, dass die Zeit abgelaufen ist, und wer gewonnen hat
socket.on('timeUp', ({ winner }) => {
    if (!isPlaying()) return;
    endGame(winner === 'white' ? 'white' : 'black', 'timeout');
});

/**
 * Zug des Online-Gegners (vom Server geprüft) mit simulierten Klicks auf dem Brett nachspielen
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
 * Drag & Drop mit Pointer Events (funktioniert gleich für Maus, Finger und Stift):
 * Stein drücken, ziehen und auf einem Zielfeld loslassen
 */
function handlePointerDown(event) {
    if (event.button !== 0) return; // Nur linke Maustaste bzw. Finger
    const piece = event.currentTarget;

    // Stein auswählen, um die Zielfelder zu färben. Klappt das nicht (z.B. Schlagzwang), wird nicht gezogen
    selectPiece(piece, event.isTrusted);
    if (selectedPiece !== piece) return;

    drag = {
        piece,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        bounds: document.getElementById('board').getBoundingClientRect(),
        moved: false,
    };
    piece.setPointerCapture(event.pointerId); // Bewegungen kommen beim Stein an, auch wenn der Finger das Brett verlässt
    piece.addEventListener('pointermove', handlePointerMove);
    piece.addEventListener('pointerup', handlePointerUp);
    piece.addEventListener('pointercancel', handlePointerUp);
}

/**
 * Lässt den Stein dem Mauszeiger bzw. Finger folgen
 */
function handlePointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;

    // Zeigerposition auf die Fläche des Bretts begrenzen, damit der Stein nicht aus dem Bild gezogen werden kann
    const { bounds } = drag;
    const x = Math.min(Math.max(event.clientX, bounds.left), bounds.right);
    const y = Math.min(Math.max(event.clientY, bounds.top), bounds.bottom);

    let dx = x - drag.startX;
    let dy = y - drag.startY;

    // Erst ab 5 Pixeln gilt es als Ziehen, kleine Wackler bleiben ein normaler Klick
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    drag.piece.classList.add('dragging');

    // Auf dem gedrehten Brett (Schwarz) läuft die Bewegung umgekehrt und der Stein ist selbst um 180° gedreht
    const isFlipped = document.getElementById('boardWrapper').classList.contains('flipped');
    if (isFlipped) {
        dx = -dx;
        dy = -dy;
    }
    drag.piece.style.transform = `translate(${dx}px, ${dy}px) rotate(${isFlipped ? 180 : 0}deg) scale(1.15)`;
}

/**
 * Loslassen: Liegt darunter ein Zielfeld, wird gezogen, sonst springt der Stein zurück
 */
function handlePointerUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { piece, moved } = drag;
    drag = null;

    piece.removeEventListener('pointermove', handlePointerMove);
    piece.removeEventListener('pointerup', handlePointerUp);
    piece.removeEventListener('pointercancel', handlePointerUp);
    piece.classList.remove('dragging');
    piece.style.transform = ''; // Zurück an die eigene Position (oder gleich ins Zielfeld verschoben)

    if (!moved || event.type === 'pointercancel') return; // Nur geklickt oder abgebrochen: Auswahl bleibt bestehen

    // Unter dem Finger liegen der Stein selbst und darunter das Feld: das erste gültige Zielfeld suchen
    const targetCell = document
        .elementsFromPoint(event.clientX, event.clientY)
        .find((element) => element.matches('#board .cell.highlighted, #board .cell.highlighted-capture'));

    // Zug wie bei einem Klick ausführen, 'drop' verhindert die Flug-Animation (der Stein ist ja schon dort)
    if (targetCell) handleBoardClick({ type: 'drop', target: targetCell, isTrusted: event.isTrusted });
}

/**
 * Zeigt in der Kopfzeile, wer am Zug ist
 */
function updateTurnIndicator() {
    const indicator = document.getElementById('turnIndicator');
    if (isMyTurn()) setText(indicator, 'game.yourTurn');
    else setText(indicator, 'game.opponentTurn', { name: state.opponentName });
    updateTabTitle();
}

/**
 * Ist der Tab im Hintergrund und man ist am Zug, steht das im Titel des Tabs "● Du bist am Zug".
 * Der Punkt blinkt (● und ○ im Sekundentakt), der Text bleibt stehen.
 * Browser bremsen Timer in Hintergrund-Tabs teils auf einmal pro Minute, so ist der Hinweis trotzdem immer zu sehen
 */
function updateTabTitle() {
    clearInterval(titleBlink);
    const playing = document.getElementById('gameScreen').classList.contains('active');
    if (!(playing && document.hidden && isMyTurn())) {
        document.title = t('page.title');
        return;
    }

    let filled = true;
    const blink = () => {
        document.title = (filled ? '● ' : '○ ') + t('game.tabYourTurn');
        filled = !filled;
    };
    blink();
    titleBlink = setInterval(blink, 1000);
}

// Zurück im Tab: wieder der normale Titel. Beim Sprachwechsel neu setzen
document.addEventListener('visibilitychange', updateTabTitle);
onLanguageChange(updateTabTitle);

/**
 * Schreibt einen Zug in den Spielverlauf und scrollt mit
 */
function addToLog(sRow, sCol, eRow, eCol, isCapture, getsPromoted = false) {
    // Zeile und Spalte in die Brettschreibweise umwandeln (z.B. A1)
    const startStr = toSquareName(sRow, sCol, board.length);
    const endStr = toSquareName(eRow, eCol, board.length);

    // "Du ziehst" bzw. "Computer zieht": Das Verb richtet sich nach der Person, deshalb eigene Texte für beide
    const strong = document.createElement('strong');
    if (isMyTurn()) setText(strong, 'log.you');
    else strong.textContent = state.opponentName; // Namen werden nicht übersetzt

    const person = isMyTurn() ? 'you' : 'other';
    const action = isCapture ? 'Capture' : 'Move';
    const text = document.createElement('span');
    setText(text, `log.${person}${action}`, { from: startStr, to: endStr }); // z.B. 'log.youCapture'

    const li = document.createElement('li');
    li.append(strong, ' ', text);
    if (getsPromoted) {
        const promotion = document.createElement('span');
        setText(promotion, 'log.promoted');
        li.append(promotion);
    }

    const list = document.getElementById('logList');
    if (list) {
        list.appendChild(li);
        // Zum neuesten Zug scrollen
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
 * Setzt den Mauszeiger für gesperrte Steine auf "Verbot"
 */
function updatePieceCursors() {
    const allPieces = document.getElementById('board').querySelectorAll('.piece');

    allPieces.forEach((p) => {
        let isLocked = false;

        // Gesperrt, wenn der Stein nicht dem Spieler am Zug gehört, ...
        const { row, col } = getPosition(p);
        if (board[row][col]?.color !== currentTurn) isLocked = true;

        // ... wenn der Gegner am Zug ist ...
        if (!isMyTurn()) isLocked = true;

        // ... oder wenn gerade ein anderer Stein einen Mehrfachsprung macht
        if (isMultiJumping && p !== selectedPiece) isLocked = true;

        p.classList.toggle('locked', isLocked);
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
    event.preventDefault(); // Sonst scrollt die Seite mit

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
document.getElementById('board').addEventListener('keydown', handleBoardKeydown);
document.getElementById('board').addEventListener('focusin', handleBoardFocus);

/**
 * TODOs (sortiert nach Bewertungskriterien, Abgabe 27.10. 8:00 Uhr):
 *
 * A) Pflicht-Anforderungen
 *
 * B) Werkzeuge
 *
 * C) Umbau der Struktur
 *
 * D) Robustheit & Qualität
 *
 * E) Oberfläche
 *
 * F) Abschluss
 * UI abschließend kontrollieren
 * Github-Repo aufräumen (README, Lizenz), Präsentation vorbereiten
 * Server vor der Spielzeit am 29.10. einschalten (git pull, sudo systemctl enable --now dame)
 *
 * G) Optional, nur wenn Zeit bleibt
 * Bedenkzeit auf dem Server mitzählen (Cheating-Schutz [7])
 * Remis-Regel (z.B. 25 Züge nur mit Damen ohne Schlag)
 * Private Räume
 * Zug rückgängig machen Option in vs. Computer
 */
