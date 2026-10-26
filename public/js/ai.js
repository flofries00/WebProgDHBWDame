/**
 * Computergegner als reine Logik ohne HTML (testbar wie rules.js).
 *
 * Stärken:
 * - 'easy': zieht zufällig (aus den erlaubten Zügen, Schlagzwang gilt trotzdem)
 * - 'medium': bewertet jeden erlaubten Zug und denkt einen Zug des Gegners voraus.
 *   Er schlägt gern (besonders Damen), wird gern zur Dame, springt weiter, wenn es geht,
 *   und vermeidet Züge, nach denen der Gegner sofort schlagen kann
 */
import { applyMove, getLegalMoves, opponentOf } from './rules.js';

export const DIFFICULTIES = ['easy', 'medium'];

/**
 * Punkte für einen Zug aus Sicht des ziehenden Spielers (höher = besser)
 */
export function scoreMove(board, move, color, variant = 'klassisch') {
    const { board: next, promoted, mustContinue } = applyMove(board, move, variant);
    let score = 0;

    if (move.captured) {
        score += board[move.captured.row][move.captured.col].king ? 5 : 3; // Eine Dame zu schlagen ist mehr wert
    }
    if (mustContinue) score += 2; // Es folgen weitere Schläge mit demselben Stein
    if (promoted) score += 3;

    // Ist der Zug zu Ende, darf der Gegner antworten: Kann er sofort schlagen, ist der Zug schlecht
    if (!mustContinue) {
        const replies = getLegalMoves(next, opponentOf(color), null, variant);
        if (replies.some((reply) => reply.captured)) score -= 4;
    }

    // Ein kleiner Bonus für Steine, die nach vorne ziehen (Richtung Dame)
    if (!board[move.fromRow][move.fromCol].king) {
        const forward = color === 'white' ? move.fromRow - move.toRow : move.toRow - move.fromRow;
        score += forward * 0.1;
    }
    return score;
}

/**
 * Wählt den Zug des Computers aus den erlaubten Zügen. Bei gleich guten Zügen entscheidet der Zufall,
 * damit sich keine Partie wiederholt. random ist austauschbar, damit die Tests feste Ergebnisse bekommen
 */
export function chooseComputerMove(
    board,
    color,
    legalMoves,
    variant = 'klassisch',
    difficulty = 'easy',
    random = Math.random
) {
    if (legalMoves.length === 0) return null;
    if (difficulty !== 'medium') return legalMoves[Math.floor(random() * legalMoves.length)];

    const scored = legalMoves.map((move) => ({ move, score: scoreMove(board, move, color, variant) }));
    const best = Math.max(...scored.map((entry) => entry.score));
    const bestMoves = scored.filter((entry) => entry.score === best).map((entry) => entry.move);
    return bestMoves[Math.floor(random() * bestMoves.length)];
}
