// Unit-Tests für den Computergegner (public/js/ai.js), laufen ohne Browser und ohne Server
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getLegalMoves, createInitialBoard } from '../public/js/rules.js';
import { chooseComputerMove } from '../public/js/ai.js';

// Hilfsfunktionen, um eigene Stellungen aufzubauen (wie in rules.test.js)
const emptyBoard = (size = 8) => Array.from({ length: size }, () => Array(size).fill(null));
const man = (color) => ({ color, king: false });
const king = (color) => ({ color, king: true });
const target = (move) => `${move.toRow},${move.toCol}`;

// Feste "Zufallszahlen": So prüfen die Tests alle gleich guten Züge (erster und letzter)
const FIRST = () => 0;
const LAST = () => 0.999;

/**
 * Lässt den Computer (Weiß) mit beiden festen Zufallszahlen wählen und liefert die Zielfelder
 */
function choices(board, difficulty) {
    const moves = getLegalMoves(board, 'white');
    return [FIRST, LAST].map((random) =>
        target(chooseComputerMove(board, 'white', moves, 'klassisch', difficulty, random))
    );
}

describe('Computergegner', () => {
    it('wählt auf Stufe Leicht einen der erlaubten Züge', () => {
        const board = createInitialBoard();
        const moves = getLegalMoves(board, 'white');
        for (let i = 0; i < 20; i++) {
            assert.ok(moves.includes(chooseComputerMove(board, 'white', moves, 'klassisch', 'easy')));
        }
    });

    it('liefert null, wenn es keinen erlaubten Zug gibt', () => {
        assert.equal(chooseComputerMove(emptyBoard(), 'white', [], 'klassisch', 'medium'), null);
    });

    it('wird auf Stufe Mittel zur Dame, wenn es geht', () => {
        const board = emptyBoard();
        board[1][2] = man('white'); // Ein Schritt bis zur Grundlinie
        board[6][5] = man('white'); // Könnte nur nach vorne ziehen
        board[7][0] = man('black');
        for (const choice of choices(board, 'medium')) assert.ok(['0,1', '0,3'].includes(choice), choice);
    });

    it('stellt auf Stufe Mittel keinen Stein ein, den der Gegner sofort schlagen kann', () => {
        const board = emptyBoard();
        board[4][3] = man('white');
        board[2][1] = man('black'); // Schlägt einen Stein auf 3,2 (Sprung nach 4,3)
        assert.deepEqual(choices(board, 'medium'), ['3,4', '3,4']);
    });

    it('schlägt auf Stufe Mittel lieber eine Dame als einen Stein', () => {
        const board = emptyBoard();
        board[5][2] = man('white');
        board[4][1] = man('black'); // Schlag nach 3,0
        board[4][3] = king('black'); // Schlag nach 3,4
        assert.deepEqual(choices(board, 'medium'), ['3,4', '3,4']);
    });
});
