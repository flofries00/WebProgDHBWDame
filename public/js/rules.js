/**
 * Spielregeln der Varianten "Klassisch" und "International" als reine Logik ohne HTML.
 *
 * Das Brett ist ein quadratisches Array: board[zeile][spalte] ist entweder null (leeres Feld)
 * oder ein Stein { color: 'white' | 'black', king: true | false }.
 * Zeile 0 liegt oben (Schwarz startet dort), die letzte Zeile unten (Weiß startet dort).
 * Die Brettgröße ergibt sich aus dem Brett selbst (board.length), die Variante steuert nur die Regeln.
 *
 * Weil das Modul weder HTML noch Browser-Funktionen nutzt, kann es auch der Server verwenden
 * (Zugprüfung gegen Cheating) und es lässt sich ohne Browser testen.
 */

/**
 * @typedef {{ color: 'white' | 'black', king: boolean, taken?: boolean }} Piece Ein Stein (taken: beim Mehrheitsschlag
 * schon geschlagen, liegt aber bis zum Ende des Zugs noch auf dem Brett)
 * @typedef {(Piece | null)[][]} Board Brett: board[zeile][spalte], null = leeres Feld
 * @typedef {{ row: number, col: number }} Square Ein Feld
 * @typedef {{ fromRow: number, fromCol: number, toRow: number, toCol: number, captured: Square | null }} Move
 * Ein Zug (bei einem Schlag steht in captured das Feld des geschlagenen Steins)
 */

/**
 * Die Varianten und worin sie sich unterscheiden:
 * - size: Felder pro Seite, pieceRows: Reihen mit Steinen pro Farbe zu Beginn
 * - menCaptureBackwards: Normale Steine dürfen auch rückwärts schlagen
 * - majorityCapture: Mehrheitsschlag. Es muss der Schlag gewählt werden, mit dem man insgesamt die meisten Steine
 *   schlägt. Geschlagene Steine bleiben dafür bis zum Ende des Zugs liegen (und dürfen nicht zweimal übersprungen
 *   werden), und ein Stein wird nur zur Dame, wenn der ganze Zug auf der Grundlinie endet
 */
export const VARIANTS = {
    klassisch: { size: 8, pieceRows: 3, menCaptureBackwards: false, majorityCapture: false },
    international: { size: 10, pieceRows: 4, menCaptureBackwards: true, majorityCapture: true },
};

/**
 * Dauer des Vorlaufs vor dem ersten Zug in Sekunden: Münzwurf und Countdown, im Partymodus
 * zusätzlich die Auslosung der Bedenkzeit.
 * Browser und Server nutzen denselben Wert, damit beide Uhren gleichzeitig starten
 * @param {string} timeSetting - '1', '3', '5', '10' oder 'party'
 * @returns {number} Sekunden
 */
export function introSeconds(timeSetting) {
    return timeSetting === 'party' ? 11 : 7;
}

// Alle vier Diagonalen
const DIRECTIONS = [
    { dr: -1, dc: -1 }, // Oben links
    { dr: -1, dc: 1 }, // Oben rechts
    { dr: 1, dc: -1 }, // Unten links
    { dr: 1, dc: 1 }, // Unten rechts
];

/**
 * Erstellt das Brett in der Startaufstellung (Steine auf den dunklen Feldern der ersten Reihen jeder Seite)
 * @param {'klassisch' | 'international'} [variant]
 * @returns {Board}
 */
export function createInitialBoard(variant = 'klassisch') {
    const { size, pieceRows } = VARIANTS[variant];
    const board = [];
    for (let row = 0; row < size; row++) {
        board.push([]);
        for (let col = 0; col < size; col++) {
            const isDarkCell = (row + col) % 2 !== 0;
            if (isDarkCell && row < pieceRows) {
                board[row].push({ color: 'black', king: false });
            } else if (isDarkCell && row >= size - pieceRows) {
                board[row].push({ color: 'white', king: false });
            } else {
                board[row].push(null);
            }
        }
    }
    return board;
}

/**
 * Prüft, ob Koordinaten auf dem Brett liegen
 * @param {Board} board
 * @param {number} row
 * @param {number} col
 * @returns {boolean}
 */
function isOnBoard(board, row, col) {
    return row >= 0 && row < board.length && col >= 0 && col < board.length;
}

/**
 * Liefert die Farbe des Gegners
 * @param {'white' | 'black'} color
 * @returns {'white' | 'black'}
 */
export function opponentOf(color) {
    return color === 'white' ? 'black' : 'white';
}

/**
 * Berechnet alle Züge eines einzelnen Steins (ohne Schlagzwang).
 * Rückgabe: Array aus { fromRow, fromCol, toRow, toCol, captured }, captured ist { row, col } oder null
 * Bereits geschlagene Steine (taken, nur beim Mehrheitsschlag) versperren den Weg und dürfen nicht nochmal
 * übersprungen werden
 * @param {Board} board
 * @param {number} row - Zeile des Steins
 * @param {number} col - Spalte des Steins
 * @param {'klassisch' | 'international'} [variant]
 * @returns {Move[]}
 */
export function getPieceMoves(board, row, col, variant = 'klassisch') {
    const piece = board[row][col];
    if (!piece) return [];

    const moves = [];
    const addMove = (toRow, toCol, captured) => moves.push({ fromRow: row, fromCol: col, toRow, toCol, captured });

    if (piece.king) {
        // Dame: zieht beliebig weit. Vor einem Gegner normale Züge, dahinter Schlagzüge
        for (const { dr, dc } of DIRECTIONS) {
            let r = row + dr;
            let c = col + dc;
            let captured = null;

            while (isOnBoard(board, r, c)) {
                const target = board[r][c];
                if (!target) {
                    addMove(r, c, captured);
                } else if (!captured && !target.taken && target.color !== piece.color) {
                    captured = { row: r, col: c }; // Genau ein Gegner darf übersprungen werden
                } else {
                    break; // Eigener, schon geschlagener oder zweiter Stein in Folge: Weg versperrt
                }
                r += dr;
                c += dc;
            }
        }
        return moves;
    }

    // Normaler Stein: zieht ein Feld vorwärts, Weiß nach oben (-1), Schwarz nach unten (+1)
    const forward = piece.color === 'white' ? -1 : 1;
    const captureRows = VARIANTS[variant].menCaptureBackwards ? [forward, -forward] : [forward];

    for (const dc of [-1, 1]) {
        const r = row + forward;
        const c = col + dc;
        if (isOnBoard(board, r, c) && !board[r][c]) addMove(r, c, null);
    }

    // Schlagen: Gegner direkt daneben, das Feld dahinter ist frei
    for (const dr of captureRows) {
        for (const dc of [-1, 1]) {
            const r = row + dr;
            const c = col + dc;
            const jumpRow = r + dr;
            const jumpCol = c + dc;
            if (!isOnBoard(board, jumpRow, jumpCol) || board[jumpRow][jumpCol]) continue;

            const target = board[r][c];
            if (target && !target.taken && target.color !== piece.color) addMove(jumpRow, jumpCol, { row: r, col: c });
        }
    }
    return moves;
}

/**
 * Führt einen einzelnen Sprung aus, ohne den Zug abzuschließen: Der geschlagene Stein bleibt als "taken" liegen.
 * Wird für die Suche nach dem längsten Schlag gebraucht
 * @param {Board} board
 * @param {Move} move - Ein Schlag
 * @returns {Board} Neues Brett
 */
function jump(board, move) {
    const next = board.map((row) => [...row]);
    next[move.toRow][move.toCol] = next[move.fromRow][move.fromCol];
    next[move.fromRow][move.fromCol] = null;
    next[move.captured.row][move.captured.col] = { ...next[move.captured.row][move.captured.col], taken: true };
    return next;
}

/**
 * Wie viele Steine kann der Stein auf (row, col) von hier aus noch schlagen? (0 = keinen)
 * Probiert alle Schlagfolgen durch und liefert die längste
 * @param {Board} board
 * @param {number} row
 * @param {number} col
 * @param {'klassisch' | 'international'} variant
 * @returns {number} Anzahl geschlagener Steine
 */
function longestCapture(board, row, col, variant) {
    let longest = 0;
    for (const move of getPieceMoves(board, row, col, variant)) {
        if (!move.captured) continue;
        longest = Math.max(longest, 1 + longestCapture(jump(board, move), move.toRow, move.toCol, variant));
    }
    return longest;
}

/**
 * Liefert alle erlaubten Züge einer Farbe unter Berücksichtigung des Schlagzwangs.
 * onlyFrom: Während eines Mehrfachsprungs darf nur dieser Stein ({ row, col }) weiterschlagen.
 * Beim Mehrheitsschlag bleiben nur die Schläge übrig, mit denen man insgesamt die meisten Steine schlägt
 * @param {Board} board
 * @param {'white' | 'black'} color - Farbe am Zug
 * @param {Square | null} [onlyFrom] - Springender Stein während eines Mehrfachsprungs
 * @param {'klassisch' | 'international'} [variant]
 * @returns {Move[]}
 */
export function getLegalMoves(board, color, onlyFrom = null, variant = 'klassisch') {
    const moves = [];
    for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board.length; col++) {
            if (board[row][col]?.color !== color || board[row][col].taken) continue;
            if (onlyFrom && (row !== onlyFrom.row || col !== onlyFrom.col)) continue;
            moves.push(...getPieceMoves(board, row, col, variant));
        }
    }

    // Schlagzwang: Gibt es einen Schlag, sind nur Schläge erlaubt (beim Mehrfachsprung immer nur Schläge)
    const captures = moves.filter((move) => move.captured);
    if (captures.length === 0) return onlyFrom ? [] : moves;
    if (!VARIANTS[variant].majorityCapture) return captures;

    // Mehrheitsschlag: Für jeden Schlag zählen, wie viele Steine damit insgesamt fallen, nur die besten bleiben
    const counts = captures.map((move) => 1 + longestCapture(jump(board, move), move.toRow, move.toCol, variant));
    const most = Math.max(...counts);
    return captures.filter((move, i) => counts[i] === most);
}

/**
 * Sucht in einer Liste von Zügen den Zug von (fromRow, fromCol) nach (toRow, toCol).
 * Gibt null zurück, wenn es diesen Zug nicht gibt.
 * @param {Move[]} moves - Erlaubte Züge
 * @param {number} fromRow
 * @param {number} fromCol
 * @param {number} toRow
 * @param {number} toCol
 * @returns {Move | null}
 */
export function findMove(moves, fromRow, fromCol, toRow, toCol) {
    return (
        moves.find(
            (move) =>
                move.fromRow === fromRow && move.fromCol === fromCol && move.toRow === toRow && move.toCol === toCol
        ) || null
    );
}

/**
 * Führt einen Zug aus und liefert ein neues Brett (das übergebene Brett bleibt unverändert).
 * Rückgabe: { board, promoted, mustContinue }
 * - promoted: Der Stein wurde zur Dame befördert
 * - mustContinue: Derselbe Stein muss weiterschlagen (Mehrfachsprung)
 * @param {Board} board
 * @param {Move} move - Ein erlaubter Zug
 * @param {'klassisch' | 'international'} [variant]
 * @returns {{ board: Board, promoted: boolean, mustContinue: boolean }}
 */
export function applyMove(board, move, variant = 'klassisch') {
    const { majorityCapture } = VARIANTS[variant];

    // Kopie anlegen, damit das alte Brett unverändert bleibt
    let next = board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));

    const piece = next[move.fromRow][move.fromCol];
    next[move.fromRow][move.fromCol] = null;
    next[move.toRow][move.toCol] = piece;
    if (move.captured) {
        // Beim Mehrheitsschlag bleibt der geschlagene Stein bis zum Ende des Zugs liegen, sonst verschwindet er sofort
        const { row, col } = move.captured;
        next[row][col] = majorityCapture ? { ...next[row][col], taken: true } : null;
    }

    // Kann derselbe Stein noch einmal schlagen?
    const lastRow = piece.color === 'white' ? 0 : next.length - 1;
    const reachesLastRow = !piece.king && move.toRow === lastRow;
    const canCaptureAgain =
        Boolean(move.captured) && getPieceMoves(next, move.toRow, move.toCol, variant).some((m) => m.captured);

    // Klassisch endet der Zug sofort, wenn der Stein die Grundlinie erreicht.
    // International springt er weiter und wird nur zur Dame, wenn der Zug dort endet
    const mustContinue = canCaptureAgain && (majorityCapture || !reachesLastRow);
    const promoted = reachesLastRow && !mustContinue;
    if (promoted) piece.king = true;

    // Zug beendet: Jetzt erst die geschlagenen Steine vom Brett nehmen
    if (!mustContinue) next = next.map((row) => row.map((p) => (p?.taken ? null : p)));

    return { board: next, promoted, mustContinue };
}

// Remis: Ziehen beide Seiten 25 Züge hintereinander nur mit Damen, ohne dass geschlagen wird, endet die Partie
// unentschieden (Regel des Weltverbands FMJD, hier für beide Varianten). 25 Züge je Seite = 50 Züge insgesamt
export const DRAW_AFTER_TURNS = 50;

/**
 * Zählt die Züge für die Remis-Regel weiter. turnByKing: Der Zug begann mit einer Dame,
 * turnCaptured: Im Zug wurde geschlagen. Ein Damenzug ohne Schlag erhöht den Zähler, sonst beginnt er bei 0
 * @param {number} count - Bisheriger Zähler
 * @param {boolean} turnByKing
 * @param {boolean} turnCaptured
 * @returns {number} Neuer Zähler
 */
export function countQuietKingTurns(count, turnByKing, turnCaptured) {
    return turnByKing && !turnCaptured ? count + 1 : 0;
}

/**
 * Ist die Partie nach der Remis-Regel unentschieden?
 * @param {number} quietKingTurns - Damenzüge ohne Schlag hintereinander (beide Seiten)
 * @returns {boolean}
 */
export function isDraw(quietKingTurns) {
    return quietKingTurns >= DRAW_AFTER_TURNS;
}

/**
 * Prüft, ob das Spiel entschieden ist: Hat die Farbe am Zug keinen erlaubten Zug mehr
 * (auch wenn sie keine Steine mehr hat), gewinnt der Gegner. Sonst null.
 * @param {Board} board
 * @param {'white' | 'black'} colorToMove - Farbe am Zug
 * @param {'klassisch' | 'international'} [variant]
 * @returns {'white' | 'black' | null} Gewinnerfarbe oder null
 */
export function getWinner(board, colorToMove, variant = 'klassisch') {
    return getLegalMoves(board, colorToMove, null, variant).length === 0 ? opponentOf(colorToMove) : null;
}
