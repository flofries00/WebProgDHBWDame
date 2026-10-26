// Nachspielen im Endbildschirm: merkt sich das Brett nach jedem Zug und zeigt die Partie Zug für Zug noch einmal
import { setText } from './i18n.js';
import { createPieceElement } from './game.js';

let turnHistory = []; // Brett nach jedem vollständigen Zug: { board, from, to, logCount, quietKingTurns }
let turnStart = null; // Startfeld des laufenden Zugs
let turnEnd = null; // Zielfeld des letzten Sprungs im laufenden Zug
let reviewIndex = 0; // Welcher Eintrag aus turnHistory gerade auf dem Endbrett zu sehen ist
let reviewBoard = null; // Brett im Endbildschirm, auf dem nachgespielt wird

/**
 * Neue Partie: Das Nachspielen beginnt mit der Startaufstellung
 * @param {import('./rules.js').Board} board - Startaufstellung
 */
export function startHistory(board) {
    turnHistory = [{ board, from: null, to: null, logCount: 0, quietKingTurns: 0 }];
}

/**
 * Merkt sich Start- und Zielfeld eines Zugs. Bei einem Mehrfachsprung bleibt das Startfeld des ersten Sprungs
 * @param {import('./rules.js').Move} move
 * @param {boolean} isMultiJumping - Läuft schon ein Mehrfachsprung?
 */
export function noteMove(move, isMultiJumping) {
    if (!isMultiJumping) turnStart = { row: move.fromRow, col: move.fromCol };
    turnEnd = { row: move.toRow, col: move.toCol };
}

/**
 * Merkt sich das Brett nach einem Zug für das Nachspielen und für "Zug zurück" (nur, wenn sich seit dem letzten
 * Eintrag etwas geändert hat). quietKingTurns ist der Zähler der Remis-Regel nach diesem Zug
 * @param {import('./rules.js').Board} board - Brett nach dem Zug
 * @param {number} quietKingTurns
 */
export function recordTurn(board, quietKingTurns) {
    if (turnHistory.at(-1).board === board) return;
    const logCount = document.getElementById('logList').children.length;
    turnHistory.push({ board, from: turnStart, to: turnEnd, logCount, quietKingTurns });
}

/**
 * Gibt es so viele Züge, die man zurücknehmen kann? (Die Startaufstellung bleibt immer)
 * @param {number} turns
 * @returns {boolean}
 */
export function canTakeBack(turns) {
    return turnHistory.length > turns;
}

/**
 * Nimmt die letzten Züge zurück und liefert den Eintrag, zu dem es zurückgeht
 * @param {number} turns
 * @returns {{ board: import('./rules.js').Board, logCount: number, quietKingTurns: number }} Eintrag aus turnHistory
 */
export function takeBackTurns(turns) {
    turnHistory.splice(-turns, turns);
    return turnHistory.at(-1);
}

/**
 * Am Spielende: Auf diesem Brett (Kopie im Endbildschirm) wird nachgespielt, los geht es beim Endstand
 * @param {HTMLElement} boardElement - Brett in der Kopie im Endbildschirm
 */
export function showReview(boardElement) {
    reviewBoard = boardElement;
    showReviewStep(turnHistory.length - 1);
}

/**
 * Markiert Start- und Zielfeld eines Zugs gelb (from und to sind { row, col } oder null)
 * @param {HTMLElement} boardElement
 * @param {import('./rules.js').Square | null} from
 * @param {import('./rules.js').Square | null} to
 */
function markMove(boardElement, from, to) {
    const isAt = (square, row, col) => square?.row === row && square?.col === col;
    boardElement.querySelectorAll('.cell').forEach((cell) => {
        const row = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);
        cell.classList.toggle('move-from', isAt(from, row, col));
        cell.classList.toggle('move-to', isAt(to, row, col));
    });
}

/**
 * Nach jedem vollständigen Zug: Auf dem Spielbrett Start- und Zielfeld des letzten Zugs markieren
 * (so sieht man sofort, was der Gegner gezogen hat)
 */
export function markLastMove() {
    const { from, to } = turnHistory.at(-1);
    markMove(document.getElementById('board'), from, to);
}

/**
 * Zeigt auf dem Endbrett den Stand nach Zug "index" (0 = Startaufstellung) und markiert den Zug im Spielverlauf
 * @param {number} index
 */
function showReviewStep(index) {
    reviewIndex = index;
    const { board: snapshot, from, to } = turnHistory[index];

    // Steine laut gemerktem Brett setzen, Start- und Zielfeld des Zugs markieren
    reviewBoard.querySelectorAll('.cell').forEach((cell) => {
        const piece = snapshot[Number(cell.dataset.row)][Number(cell.dataset.col)];
        cell.replaceChildren(...(piece ? [createPieceElement(piece)] : []));
    });
    markMove(reviewBoard, from, to);

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
 * @param {'start' | 'prev' | 'next' | 'end'} step
 */
export function moveReview(step) {
    const last = turnHistory.length - 1;
    const targets = { start: 0, prev: reviewIndex - 1, next: reviewIndex + 1, end: last };
    showReviewStep(Math.min(Math.max(targets[step], 0), last));
}
