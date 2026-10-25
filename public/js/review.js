// Nachspielen im Endbildschirm: merkt sich das Brett nach jedem Zug und zeigt die Partie Zug für Zug noch einmal
import { setText } from './i18n.js';
import { createPieceElement } from './game.js';

let turnHistory = []; // Brett nach jedem vollständigen Zug: { board, from, to, logCount }
let turnStart = null; // Startfeld des laufenden Zugs
let turnEnd = null; // Zielfeld des letzten Sprungs im laufenden Zug
let reviewIndex = 0; // Welcher Eintrag aus turnHistory gerade auf dem Endbrett zu sehen ist
let reviewBoard = null; // Brett im Endbildschirm, auf dem nachgespielt wird

/**
 * Neue Partie: Das Nachspielen beginnt mit der Startaufstellung
 */
export function startHistory(board) {
    turnHistory = [{ board, from: null, to: null, logCount: 0 }];
}

/**
 * Merkt sich Start- und Zielfeld eines Zugs. Bei einem Mehrfachsprung bleibt das Startfeld des ersten Sprungs
 */
export function noteMove(move, isMultiJumping) {
    if (!isMultiJumping) turnStart = { row: move.fromRow, col: move.fromCol };
    turnEnd = { row: move.toRow, col: move.toCol };
}

/**
 * Merkt sich das Brett nach einem Zug für das Nachspielen (nur, wenn sich seit dem letzten Eintrag etwas geändert hat)
 */
export function recordTurn(board) {
    if (turnHistory.at(-1).board === board) return;
    const logCount = document.getElementById('logList').children.length;
    turnHistory.push({ board, from: turnStart, to: turnEnd, logCount });
}

/**
 * Am Spielende: Auf diesem Brett (Kopie im Endbildschirm) wird nachgespielt, los geht es beim Endstand
 */
export function showReview(boardElement) {
    reviewBoard = boardElement;
    showReviewStep(turnHistory.length - 1);
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
        const row = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);
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
