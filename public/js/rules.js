/**
 * Spielregeln der Variante "Klassisch" als reine Logik ohne HTML.
 *
 * Das Brett ist ein 8x8-Array: board[zeile][spalte] ist entweder null (leeres Feld)
 * oder ein Stein { color: 'white' | 'black', king: true | false }.
 * Zeile 0 liegt oben (Schwarz startet dort), Zeile 7 unten (Weiß startet dort).
 *
 * Weil das Modul weder HTML noch Browser-Funktionen nutzt, kann es auch der Server verwenden
 * (Zugprüfung gegen Cheating) und es lässt sich ohne Browser testen.
 */

export const BOARD_SIZE = 8;

// Alle vier Diagonalen
const DIRECTIONS = [
    { dr: -1, dc: -1 }, // Oben links
    { dr: -1, dc: 1 }, // Oben rechts
    { dr: 1, dc: -1 }, // Unten links
    { dr: 1, dc: 1 }, // Unten rechts
];

/**
 * Erstellt das Brett in der Startaufstellung (je 12 Steine auf den dunklen Feldern der ersten drei Reihen)
 */
export function createInitialBoard() {
    const board = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
        board.push([]);
        for (let col = 0; col < BOARD_SIZE; col++) {
            const isDarkCell = (row + col) % 2 !== 0;
            if (isDarkCell && row < 3) {
                board[row].push({ color: 'black', king: false });
            } else if (isDarkCell && row > 4) {
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
 */
export function isOnBoard(row, col) {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

/**
 * Liefert die Farbe des Gegners
 */
export function opponentOf(color) {
    return color === 'white' ? 'black' : 'white';
}

/**
 * Berechnet alle Züge eines einzelnen Steins (ohne Schlagzwang).
 * Rückgabe: Array aus { fromRow, fromCol, toRow, toCol, captured }, captured ist { row, col } oder null
 */
export function getPieceMoves(board, row, col) {
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

            while (isOnBoard(r, c)) {
                const target = board[r][c];
                if (!target) {
                    addMove(r, c, captured);
                } else if (!captured && target.color !== piece.color) {
                    captured = { row: r, col: c }; // Genau ein Gegner darf übersprungen werden
                } else {
                    break; // Eigener Stein oder zweiter Stein in Folge: Weg versperrt
                }
                r += dr;
                c += dc;
            }
        }
    } else {
        // Normaler Stein: ein Feld vorwärts, Weiß nach oben (-1), Schwarz nach unten (+1)
        const dr = piece.color === 'white' ? -1 : 1;

        for (const dc of [-1, 1]) {
            const r = row + dr;
            const c = col + dc;
            if (!isOnBoard(r, c)) continue;

            const target = board[r][c];
            if (!target) {
                addMove(r, c, null);
            } else if (target.color !== piece.color) {
                // Gegner direkt davor: schlagen, wenn das Feld dahinter frei ist
                const jumpRow = r + dr;
                const jumpCol = c + dc;
                if (isOnBoard(jumpRow, jumpCol) && !board[jumpRow][jumpCol]) {
                    addMove(jumpRow, jumpCol, { row: r, col: c });
                }
            }
        }
    }
    return moves;
}

/**
 * Liefert alle erlaubten Züge einer Farbe unter Berücksichtigung des Schlagzwangs.
 * onlyFrom: Während eines Mehrfachsprungs darf nur dieser Stein ({ row, col }) weiterschlagen.
 */
export function getLegalMoves(board, color, onlyFrom = null) {
    const moves = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col]?.color !== color) continue;
            if (onlyFrom && (row !== onlyFrom.row || col !== onlyFrom.col)) continue;
            moves.push(...getPieceMoves(board, row, col));
        }
    }

    // Schlagzwang: Gibt es einen Schlag, sind nur Schläge erlaubt (beim Mehrfachsprung immer nur Schläge)
    const captures = moves.filter((move) => move.captured);
    return captures.length > 0 || onlyFrom ? captures : moves;
}

/**
 * Sucht in einer Liste von Zügen den Zug von (fromRow, fromCol) nach (toRow, toCol).
 * Gibt null zurück, wenn es diesen Zug nicht gibt.
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
 */
export function applyMove(board, move) {
    // Kopie anlegen, damit das alte Brett unverändert bleibt
    const next = board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));

    const piece = next[move.fromRow][move.fromCol];
    next[move.fromRow][move.fromCol] = null;
    next[move.toRow][move.toCol] = piece;
    if (move.captured) next[move.captured.row][move.captured.col] = null;

    // Beförderung: Ein normaler Stein erreicht die gegnerische Grundlinie
    const lastRow = piece.color === 'white' ? 0 : BOARD_SIZE - 1;
    const promoted = !piece.king && move.toRow === lastRow;
    if (promoted) piece.king = true;

    // Mehrfachsprung: Nach einem Schlag muss derselbe Stein weiterschlagen, wenn er kann.
    // Wird er dabei befördert, endet der Zug sofort.
    const mustContinue =
        Boolean(move.captured) && !promoted && getPieceMoves(next, move.toRow, move.toCol).some((m) => m.captured);

    return { board: next, promoted, mustContinue };
}

/**
 * Prüft, ob das Spiel entschieden ist: Hat die Farbe am Zug keinen erlaubten Zug mehr
 * (auch wenn sie keine Steine mehr hat), gewinnt der Gegner. Sonst null.
 */
export function getWinner(board, colorToMove) {
    return getLegalMoves(board, colorToMove).length === 0 ? opponentOf(colorToMove) : null;
}
