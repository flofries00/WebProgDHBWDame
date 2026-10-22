// Unit-Tests für die Spielregeln (public/js/rules.js), laufen ohne Browser und ohne Server
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    createInitialBoard,
    getPieceMoves,
    getLegalMoves,
    findMove,
    applyMove,
    getWinner,
    opponentOf,
} from '../public/js/rules.js';

// Hilfsfunktionen, um eigene Stellungen aufzubauen (8x8 für Klassisch, 10x10 für International)
const emptyBoard = (size = 8) => Array.from({ length: size }, () => Array(size).fill(null));
const man = (color) => ({ color, king: false }); // normaler Stein
const king = (color) => ({ color, king: true }); // Dame
const countPieces = (board, color) => board.flat().filter((piece) => piece?.color === color).length;
const targets = (moves) => moves.map((move) => `${move.toRow},${move.toCol}`).sort();

describe('Startaufstellung', () => {
    it('hat je 12 Steine pro Farbe', () => {
        const board = createInitialBoard();
        assert.equal(countPieces(board, 'white'), 12);
        assert.equal(countPieces(board, 'black'), 12);
    });

    it('stellt Steine nur auf dunkle Felder', () => {
        const board = createInitialBoard();
        board.forEach((row, r) =>
            row.forEach((piece, c) => {
                if (piece) assert.equal((r + c) % 2, 1, `Stein auf hellem Feld ${r},${c}`);
            })
        );
    });

    it('erlaubt Weiß zu Beginn genau 7 Züge', () => {
        assert.equal(getLegalMoves(createInitialBoard(), 'white').length, 7);
    });
});

describe('Normale Steine', () => {
    it('ziehen ein Feld diagonal vorwärts (Weiß nach oben)', () => {
        const board = emptyBoard();
        board[5][2] = man('white');
        assert.deepEqual(targets(getPieceMoves(board, 5, 2)), ['4,1', '4,3']);
    });

    it('ziehen ein Feld diagonal vorwärts (Schwarz nach unten)', () => {
        const board = emptyBoard();
        board[2][3] = man('black');
        assert.deepEqual(targets(getPieceMoves(board, 2, 3)), ['3,2', '3,4']);
    });

    it('schlagen einen Gegner und landen direkt dahinter', () => {
        const board = emptyBoard();
        board[5][2] = man('white');
        board[4][3] = man('black');
        const capture = getPieceMoves(board, 5, 2).find((move) => move.captured);
        assert.deepEqual(capture, { fromRow: 5, fromCol: 2, toRow: 3, toCol: 4, captured: { row: 4, col: 3 } });
    });

    it('schlagen nicht rückwärts', () => {
        const board = emptyBoard();
        board[4][3] = man('white');
        board[5][4] = man('black');
        assert.ok(getPieceMoves(board, 4, 3).every((move) => !move.captured));
    });

    it('können nicht schlagen, wenn das Feld dahinter besetzt ist', () => {
        const board = emptyBoard();
        board[5][2] = man('white');
        board[4][3] = man('black');
        board[3][4] = man('black');
        assert.ok(getPieceMoves(board, 5, 2).every((move) => !move.captured));
    });
});

describe('Schlagzwang', () => {
    it('erlaubt nur noch Schläge, wenn ein Schlag möglich ist', () => {
        const board = emptyBoard();
        board[5][2] = man('white');
        board[4][3] = man('black');
        board[5][6] = man('white'); // könnte normal ziehen, darf aber nicht
        const moves = getLegalMoves(board, 'white');
        assert.equal(moves.length, 1);
        assert.ok(moves[0].captured);
    });

    it('erlaubt alle Züge, wenn kein Schlag möglich ist', () => {
        const board = emptyBoard();
        board[5][2] = man('white');
        board[5][6] = man('white');
        assert.equal(getLegalMoves(board, 'white').length, 4);
    });
});

describe('Mehrfachsprung', () => {
    // Weiß schlägt von 6,1 über 5,2 nach 4,3 und kann danach über 3,4 nach 2,5 weiterschlagen
    const setup = () => {
        const board = emptyBoard();
        board[6][1] = man('white');
        board[5][2] = man('black');
        board[3][4] = man('black');
        return board;
    };

    it('meldet, dass derselbe Stein weiterschlagen muss', () => {
        const board = setup();
        const result = applyMove(board, getLegalMoves(board, 'white')[0]);
        assert.equal(result.mustContinue, true);
    });

    it('erlaubt in der Fortsetzung nur Schläge des springenden Steins', () => {
        const board = setup();
        board[6][7] = man('white'); // anderer weißer Stein darf jetzt nicht ziehen
        const first = applyMove(board, findMove(getLegalMoves(board, 'white'), 6, 1, 4, 3));
        const moves = getLegalMoves(first.board, 'white', { row: 4, col: 3 });
        assert.deepEqual(targets(moves), ['2,5']);
    });

    it('endet sofort, wenn der Stein dabei zur Dame wird', () => {
        const board = emptyBoard();
        board[2][1] = man('white');
        board[1][2] = man('black');
        board[1][4] = man('black'); // wäre für eine Dame schlagbar
        const result = applyMove(board, getLegalMoves(board, 'white')[0]);
        assert.equal(result.promoted, true);
        assert.equal(result.mustContinue, false);
    });
});

describe('Dame', () => {
    it('entsteht, wenn ein Stein die gegnerische Grundlinie erreicht', () => {
        const board = emptyBoard();
        board[1][2] = man('white');
        const result = applyMove(board, findMove(getLegalMoves(board, 'white'), 1, 2, 0, 1));
        assert.equal(result.promoted, true);
        assert.equal(result.board[0][1].king, true);
    });

    it('zieht beliebig weit in alle vier Richtungen', () => {
        const board = emptyBoard();
        board[4][3] = king('white');
        // Freie Diagonalen ab 4,3: 4 + 3 + 3 + 3 = 13 Felder
        assert.equal(getPieceMoves(board, 4, 3).length, 13);
    });

    it('schlägt aus der Entfernung und darf hinter dem Gegner auf jedem freien Feld landen', () => {
        const board = emptyBoard();
        board[7][0] = king('white');
        board[3][4] = man('black');
        const captures = getPieceMoves(board, 7, 0).filter((move) => move.captured);
        assert.deepEqual(targets(captures), ['0,7', '1,6', '2,5']);
    });

    it('kann nicht zwei Steine direkt hintereinander überspringen', () => {
        const board = emptyBoard();
        board[7][0] = king('white');
        board[5][2] = man('black');
        board[4][3] = man('black');
        assert.ok(getPieceMoves(board, 7, 0).every((move) => !move.captured));
    });
});

describe('Zug ausführen und suchen', () => {
    it('verändert das übergebene Brett nicht', () => {
        const board = createInitialBoard();
        const before = JSON.stringify(board);
        applyMove(board, getLegalMoves(board, 'white')[0]);
        assert.equal(JSON.stringify(board), before);
    });

    it('entfernt den geschlagenen Stein', () => {
        const board = emptyBoard();
        board[5][2] = man('white');
        board[4][3] = man('black');
        const result = applyMove(board, getLegalMoves(board, 'white')[0]);
        assert.equal(result.board[4][3], null);
        assert.equal(countPieces(result.board, 'black'), 0);
    });

    it('findet keinen Zug, der nicht erlaubt ist', () => {
        assert.equal(findMove(getLegalMoves(createInitialBoard(), 'white'), 5, 0, 3, 0), null);
    });
});

describe('Spielende', () => {
    it('gewinnt, wer dem Gegner alle Steine geschlagen hat', () => {
        const board = emptyBoard();
        board[0][1] = man('white');
        assert.equal(getWinner(board, 'black'), 'white');
    });

    it('gewinnt, wenn der Gegner keinen Zug mehr hat', () => {
        const board = emptyBoard();
        board[7][0] = man('black'); // steht auf der letzten Reihe, kann nicht mehr vorwärts
        board[0][1] = man('white');
        assert.equal(getWinner(board, 'black'), 'white');
    });

    it('meldet keinen Gewinner, solange beide ziehen können', () => {
        assert.equal(getWinner(createInitialBoard(), 'white'), null);
    });

    it('liefert die Farbe des Gegners', () => {
        assert.equal(opponentOf('white'), 'black');
        assert.equal(opponentOf('black'), 'white');
    });
});

describe('Variante International', () => {
    const INT = 'international';

    it('hat ein 10x10-Brett mit je 20 Steinen', () => {
        const board = createInitialBoard(INT);
        assert.equal(board.length, 10);
        assert.equal(countPieces(board, 'white'), 20);
        assert.equal(countPieces(board, 'black'), 20);
    });

    it('erlaubt Weiß zu Beginn genau 9 Züge', () => {
        assert.equal(getLegalMoves(createInitialBoard(INT), 'white', null, INT).length, 9);
    });

    it('lässt normale Steine auch rückwärts schlagen', () => {
        const board = emptyBoard(10);
        board[4][3] = man('white');
        board[5][4] = man('black');
        const captures = getPieceMoves(board, 4, 3, INT).filter((move) => move.captured);
        assert.deepEqual(targets(captures), ['6,5']);
    });

    it('lässt normale Steine aber nur vorwärts ziehen', () => {
        const board = emptyBoard(10);
        board[4][3] = man('white');
        assert.deepEqual(targets(getPieceMoves(board, 4, 3, INT)), ['3,2', '3,4']);
    });

    // Stein A (8,1) kann einen Stein schlagen, Stein B (8,7) nacheinander zwei
    const majoritySetup = () => {
        const board = emptyBoard(10);
        board[8][1] = man('white');
        board[7][2] = man('black');
        board[8][7] = man('white');
        board[7][6] = man('black');
        board[5][6] = man('black');
        return board;
    };

    it('verlangt den Schlag, mit dem man die meisten Steine schlägt (Mehrheitsschlag)', () => {
        const moves = getLegalMoves(majoritySetup(), 'white', null, INT);
        assert.equal(moves.length, 1);
        assert.deepEqual([moves[0].fromRow, moves[0].fromCol, moves[0].toRow, moves[0].toCol], [8, 7, 6, 5]);
    });

    it('lässt geschlagene Steine bis zum Ende des Zugs liegen', () => {
        const first = applyMove(
            majoritySetup(),
            findMove(getLegalMoves(majoritySetup(), 'white', null, INT), 8, 7, 6, 5),
            INT
        );
        assert.equal(first.mustContinue, true);
        assert.equal(first.board[7][6].taken, true);

        const second = applyMove(
            first.board,
            findMove(getLegalMoves(first.board, 'white', { row: 6, col: 5 }, INT), 6, 5, 4, 7),
            INT
        );
        assert.equal(second.mustContinue, false);
        assert.equal(second.board[7][6], null);
        assert.equal(second.board[5][6], null);
    });

    it('erlaubt nicht, einen geschlagenen Stein ein zweites Mal zu überspringen', () => {
        const board = emptyBoard(10);
        board[5][4] = man('white');
        board[4][3] = { ...man('black'), taken: true };
        assert.ok(getPieceMoves(board, 5, 4, INT).every((move) => !move.captured));
    });

    it('macht keine Dame, wenn der Stein über die Grundlinie hinweg weiterschlagen muss', () => {
        const board = emptyBoard(10);
        board[2][1] = man('white');
        board[1][2] = man('black');
        board[1][4] = man('black'); // nach der Landung auf 0,3 rückwärts schlagbar
        const first = applyMove(board, findMove(getLegalMoves(board, 'white', null, INT), 2, 1, 0, 3), INT);
        assert.equal(first.mustContinue, true);
        assert.equal(first.promoted, false);

        const second = applyMove(first.board, getLegalMoves(first.board, 'white', { row: 0, col: 3 }, INT)[0], INT);
        assert.equal(second.promoted, false);
        assert.equal(second.board[2][5].king, false);
    });

    it('macht eine Dame, wenn der Zug auf der Grundlinie endet', () => {
        const board = emptyBoard(10);
        board[2][1] = man('white');
        board[1][2] = man('black');
        const result = applyMove(board, getLegalMoves(board, 'white', null, INT)[0], INT);
        assert.equal(result.promoted, true);
        assert.equal(result.board[0][3].king, true);
    });
});
