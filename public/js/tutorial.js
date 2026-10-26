// Interaktives Tutorial: Auf einem kleinen Übungsbrett macht man die wichtigsten Züge selbst.
// Öffnet sich beim ersten Besuch automatisch und lässt sich über die Startseite und das Hilfe-Fenster wieder aufrufen
import { getLegalMoves, getPieceMoves, applyMove } from './rules.js';
import { createPieceElement, toSquareName } from './game.js';
import { playSound } from './sound.js';
import { t } from './i18n.js';

const STORAGE_KEY = 'tutorialSeen';

// Die Lektionen. Das Brett steht als Text da: w/b = weißer/schwarzer Stein, W = weiße Dame, . = leer.
// Die Aufstellungen sind so gewählt, dass jeder erlaubte Zug das Ziel der Lektion erfüllt
// Zuerst die klassischen Lektionen (8x8), danach optional die Lektionen für International (10x10)
// Titel, Aufgabe und Erfolgsmeldung jeder Lektion stehen in translations.js (z.B. tutorial.move.title)
const LESSONS = [
    {
        id: 'move',
        layout: ['........', '........', '........', '........', '........', 'w.w.w.w.', '........', '........'],
    },
    {
        id: 'capture',
        layout: ['........', '........', '........', '........', '...b....', '..w.....', '........', '........'],
    },
    {
        id: 'mustCapture',
        layout: ['........', '........', '........', '........', '...b....', '..w...w.', '........', '........'],
    },
    {
        id: 'multiJump',
        layout: ['........', '........', '........', '....b...', '........', '..b.....', '.w......', '........'],
    },
    {
        id: 'king',
        layout: ['........', '..w.....', '........', '........', '........', '........', '........', '........'],
    },
    {
        id: 'kingCapture',
        layout: ['........', '........', '........', '....b...', '........', '........', '.W......', '........'],
    },
    {
        variant: 'international',
        id: 'backward',
        layout: [
            '..........',
            '..........',
            '..........',
            '..........',
            '..........',
            '....w.....',
            '.....b....',
            '..........',
            '..........',
            '..........',
        ],
    },
    {
        variant: 'international',
        id: 'majority',
        layout: [
            '..........',
            '..........',
            '..........',
            '..........',
            '.....b....',
            '..........',
            '...b......',
            '..w.....b.',
            '.........w',
            '..........',
        ],
    },
    {
        variant: 'international',
        id: 'promotionAtEnd',
        layout: [
            '..........',
            '....b.b...',
            '...w......',
            '..........',
            '..........',
            '..........',
            '..........',
            '..........',
            '..........',
            '..........',
        ],
    },
];

/**
 * Variante einer Lektion (ohne Angabe: klassisch)
 */
const variantOf = (lesson) => lesson.variant ?? 'klassisch';

/**
 * Ist die Lektion die letzte ihrer Variante? Dann endet hier das Tutorial (oder es geht mit International weiter)
 */
const isLastOfVariant = (index) =>
    index === LESSONS.length - 1 || variantOf(LESSONS[index + 1]) !== variantOf(LESSONS[index]);

let lessonIndex = 0;
let board = []; // Übungsbrett im Format von rules.js
let selected = null; // Ausgewählter Stein { row, col }
let jumpingFrom = null; // Während eines Mehrfachsprungs: der springende Stein
let solved = false; // Lektion geschafft, das Brett ist gesperrt

/**
 * Wandelt die Text-Aufstellung einer Lektion in ein Brett für rules.js um
 * @param {string[]} layout - Eine Zeile pro Brettreihe: '.' leer, 'w'/'b' Stein, 'W'/'B' Dame
 * @returns {import('./rules.js').Board}
 */
function parseLayout(layout) {
    return layout.map((rowText) =>
        [...rowText].map((symbol) => {
            if (symbol === '.') return null;
            return { color: symbol.toLowerCase() === 'w' ? 'white' : 'black', king: symbol === symbol.toUpperCase() };
        })
    );
}

/**
 * Erlaubte Züge für Weiß
 */
function legalMoves() {
    return getLegalMoves(board, 'white', jumpingFrom, variantOf(LESSONS[lessonIndex]));
}

/**
 * Züge, deren Zielfelder gerade markiert sind: die des ausgewählten Steins, sonst bei Schlagzwang alle Schläge
 */
function visibleMoves() {
    if (solved) return [];
    const moves = legalMoves();
    if (selected) return moves.filter((move) => move.fromRow === selected.row && move.fromCol === selected.col);
    return moves.filter((move) => move.captured);
}

/**
 * Zeichnet das Übungsbrett neu. Anklickbar sind nur eigene Steine und markierte Zielfelder
 */
function renderBoard() {
    const targets = visibleMoves();
    const cells = [];

    board.forEach((rowPieces, row) => {
        rowPieces.forEach((piece, col) => {
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'cell ' + ((row + col) % 2 !== 0 ? 'black-bg' : 'white-bg');
            cell.dataset.row = row;
            cell.dataset.col = col;

            const target = targets.find((move) => move.toRow === row && move.toCol === col);
            if (target) cell.classList.add(target.captured ? 'highlighted-capture' : 'highlighted');

            const label = [toSquareName(row, col, board.length)];
            if (piece) {
                const element = createPieceElement(piece);
                const isSelected = selected?.row === row && selected?.col === col;
                element.classList.toggle('selected', isSelected);
                element.classList.toggle('locked', piece.color !== 'white' || solved);
                cell.append(element);
                // Dieselben Texte wie auf dem echten Brett (game.js), z.B. 'board.whitePiece'
                label.push(t(`board.${piece.color}${piece.king ? 'King' : 'Piece'}`));
                if (isSelected) label.push(t('board.selected'));
            }
            if (target) label.push(t(target.captured ? 'board.captureHere' : 'board.moveHere'));
            cell.setAttribute('aria-label', label.join(', '));

            cell.disabled = solved || !(target || piece?.color === 'white');
            cells.push(cell);
        });
    });

    const boardElement = document.getElementById('tutorialBoard');
    boardElement.style.setProperty('--tutorial-size', board.length); // 8 oder 10 Felder pro Reihe
    boardElement.replaceChildren(...cells);
}

/**
 * Zeigt den Hinweis unter dem Brett (wird vorgelesen). Ohne Schlüssel wird er geleert
 * @param {string | null} [key] - Schlüssel aus translations.js
 * @param {boolean} [isSuccess]
 */
function setFeedback(key = null, isSuccess = false) {
    const feedback = document.getElementById('tutorialFeedback');
    feedback.textContent = key ? (isSuccess ? '✓ ' : '') + t(key) : '';
    feedback.classList.toggle('success', isSuccess);
}

/**
 * Startet eine Lektion (auch für "Nochmal")
 * @param {number} index - Nummer der Lektion
 */
function startLesson(index) {
    lessonIndex = index;
    const lesson = LESSONS[index];
    board = parseLayout(lesson.layout);
    selected = null;
    jumpingFrom = null;
    solved = false;

    // Nummer innerhalb der Variante, z.B. "Tutorial (2/6)" oder "Tutorial International (1/3)"
    const sameVariant = LESSONS.filter((other) => variantOf(other) === variantOf(lesson));
    const name = variantOf(lesson) === 'klassisch' ? 'tutorial.name' : 'tutorial.nameInternational';
    document.getElementById('tutorialTitle').textContent = t('tutorial.heading', {
        name: { key: name },
        number: sameVariant.indexOf(lesson) + 1,
        total: sameVariant.length,
        lesson: { key: `tutorial.${lesson.id}.title` },
    });
    document.getElementById('tutorialText').textContent = t(`tutorial.${lesson.id}.text`);
    setFeedback();

    const nextBtn = document.getElementById('tutorialNextBtn');
    nextBtn.disabled = true;
    nextBtn.textContent = isLastOfVariant(index) ? t('tutorial.letsGo') : t('common.next');
    document.getElementById('tutorialInternationalBtn').hidden = true;
    renderBoard();
}

/**
 * Führt einen Zug auf dem Übungsbrett aus
 * @param {import('./rules.js').Move} move
 */
function makeMove(move) {
    const result = applyMove(board, move, variantOf(LESSONS[lessonIndex]));
    board = result.board;
    playSound(move.captured ? 'capture' : 'move');
    if (result.promoted) playSound('promote');

    if (result.mustContinue) {
        // Derselbe Stein muss weiterschlagen
        jumpingFrom = { row: move.toRow, col: move.toCol };
        selected = jumpingFrom;
        setFeedback('tutorial.continueJump');
        renderBoard();
        return;
    }

    selected = null;
    jumpingFrom = null;
    solved = true;
    setFeedback(`tutorial.${LESSONS[lessonIndex].id}.success`, true);
    renderBoard();

    const nextBtn = document.getElementById('tutorialNextBtn');
    nextBtn.disabled = false;
    nextBtn.focus();

    // Nach der letzten klassischen Lektion: Angebot, International zu lernen
    document.getElementById('tutorialInternationalBtn').hidden = !(
        isLastOfVariant(lessonIndex) && lessonIndex < LESSONS.length - 1
    );
}

/**
 * Klick auf das Übungsbrett: Zielfeld anklicken führt den Zug aus, eigenen Stein anklicken wählt ihn aus
 * @param {MouseEvent} event
 */
export function handleTutorialClick(event) {
    const cell = event.target.closest('.cell');
    if (!cell || solved) return;
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);

    // Zielfeld: Ziehen, wenn eindeutig ist, welcher Stein dorthin will
    const moves = visibleMoves().filter((move) => move.toRow === row && move.toCol === col);
    if (moves.length === 1) {
        makeMove(moves[0]);
    } else if (board[row][col]?.color === 'white' && !jumpingFrom) {
        // Eigener Stein: auswählen, wenn er ziehen darf, sonst erklären warum nicht
        const canMove = legalMoves().some((move) => move.fromRow === row && move.fromCol === col);
        const canCapture = getPieceMoves(board, row, col, variantOf(LESSONS[lessonIndex])).some(
            (move) => move.captured
        );
        selected = canMove ? { row, col } : null;
        if (canMove) setFeedback();
        else if (canCapture) setFeedback('tutorial.notThisCapture');
        else setFeedback('tutorial.notThisPiece');
        renderBoard();
    }

    // Das Brett wurde neu gezeichnet: Fokus für die Tastatur auf dasselbe Feld zurücksetzen
    if (!solved) {
        document.querySelector(`#tutorialBoard .cell[data-row="${row}"][data-col="${col}"]:not(:disabled)`)?.focus();
    }
}

/**
 * "Weiter": nächste Lektion, nach der letzten einer Variante schließt sich das Fenster
 */
export function nextLesson() {
    if (isLastOfVariant(lessonIndex)) {
        document.getElementById('tutorialDialog').close();
    } else {
        startLesson(lessonIndex + 1);
    }
}

/**
 * "International lernen": nach den klassischen Lektionen mit der ersten Lektion für International weitermachen
 */
export function startInternationalLessons() {
    startLesson(LESSONS.findIndex((lesson) => variantOf(lesson) === 'international'));
}

/**
 * "Nochmal": aktuelle Lektion zurücksetzen
 */
export function restartLesson() {
    startLesson(lessonIndex);
}

/**
 * Öffnet das Tutorial bei der ersten Lektion
 */
export function openTutorial() {
    startLesson(0);
    document.getElementById('tutorialDialog').showModal();
}

/**
 * Beim ersten Besuch das Tutorial automatisch öffnen. Nach dem Schließen (auch Überspringen) kommt es nicht wieder
 */
export function openTutorialOnFirstVisit() {
    try {
        if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
        return; // Kein Speicher: lieber nicht bei jedem Neuladen öffnen
    }
    openTutorial();
}

/**
 * Fenster geschlossen: merken, dass das Tutorial gesehen wurde
 */
export function handleTutorialClose() {
    try {
        localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
        // Speichern gesperrt: Das Tutorial erscheint beim nächsten Besuch erneut
    }
}
