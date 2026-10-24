// Unit-Tests für die Farblogik (public/js/colors.js): Kontrast nach WCAG und Warnungen
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    BOARD_PRESETS,
    PIECE_PRESETS,
    DEFAULT_THEME,
    makeColors,
    isHexColor,
    contrastRatio,
    bestContrast,
    deriveColors,
    formatRatio,
    checkColors,
    parseStoredTheme,
} from '../public/js/colors.js';

describe('Kontrast nach WCAG', () => {
    it('liefert 21:1 für Schwarz auf Weiß und 1:1 für gleiche Farben', () => {
        assert.equal(contrastRatio('#000000', '#ffffff'), 21);
        assert.equal(contrastRatio('#8b4513', '#8b4513'), 1);
    });

    it('hängt nicht von der Reihenfolge der Farben ab', () => {
        assert.equal(contrastRatio('#deb887', '#5c2e0e'), contrastRatio('#5c2e0e', '#deb887'));
    });

    it('stimmt mit bekannten Werten überein', () => {
        // #767676 auf Weiß ist der bekannte Grenzwert für 4,5:1
        assert.equal(formatRatio(contrastRatio('#767676', '#ffffff')), '4,5');
        assert.equal(formatRatio(contrastRatio('#767676', '#ffffff'), 'en'), '4.5');
    });

    it('wählt aus mehreren Farben die mit dem besten Kontrast', () => {
        assert.equal(bestContrast('#000000', ['#111111', '#dddddd']), '#dddddd');
        assert.equal(bestContrast('#ffffff', ['#111111', '#dddddd']), '#111111');
    });
});

describe('Farbwerte', () => {
    it('erkennt gültige Farben im Format #rrggbb', () => {
        assert.ok(isHexColor('#deb887'));
        assert.ok(isHexColor('#DEB887'));
        assert.ok(!isHexColor('deb887'));
        assert.ok(!isHexColor('#fff'));
        assert.ok(!isHexColor('red'));
        assert.ok(!isHexColor(42));
    });

    it('setzt Brett- und Steinvorlage zu fünf Farben zusammen', () => {
        assert.deepEqual(makeColors('holz', 'klassisch'), {
            light: '#deb887',
            dark: '#8b4513',
            frame: '#5c2e0e',
            pieceLight: '#e0e0e0',
            pieceDark: '#222222',
        });
        assert.deepEqual(DEFAULT_THEME.colors, makeColors('holz', 'klassisch'));
    });

    it('wählt den Rand der dunklen Steine passend zum dunklen Feld', () => {
        assert.equal(deriveColors(makeColors('holz', 'klassisch')).darkPieceOutline, '#dddddd');
        assert.equal(deriveColors({ ...makeColors('holz', 'klassisch'), dark: '#f0f0f0' }).darkPieceOutline, '#111111');
    });
});

describe('Warnungen', () => {
    it('meldet für alle Vorlagen-Kombinationen keine Probleme', () => {
        for (const board of Object.keys(BOARD_PRESETS)) {
            for (const pieces of Object.keys(PIECE_PRESETS)) {
                assert.deepEqual(checkColors(makeColors(board, pieces)), [], `${board} + ${pieces}`);
            }
        }
    });

    it('warnt, wenn helle Steine fast so dunkel sind wie die dunklen Felder', () => {
        const colors = { ...makeColors('holz', 'klassisch'), pieceLight: '#8b4513' };
        assert.ok(checkColors(colors).some((warning) => warning.key === 'lightPieces'));
    });

    it('warnt, wenn beide Steinfarben fast gleich sind', () => {
        const colors = { ...makeColors('holz', 'klassisch'), pieceDark: '#dddddd' };
        assert.ok(checkColors(colors).some((warning) => warning.key === 'similarPieces'));
    });

    it('warnt bei schlecht lesbarer Beschriftung und nennt den Kontrast', () => {
        const colors = { ...makeColors('holz', 'klassisch'), frame: '#c0a070' };
        const warning = checkColors(colors).find(({ key }) => key === 'frameLabel');
        assert.equal(warning.minimum, 4.5);
        assert.ok(warning.ratio < 4.5);
    });

    it('warnt, wenn helle und dunkle Felder kaum zu unterscheiden sind', () => {
        const colors = { ...makeColors('holz', 'klassisch'), light: '#8b4513' };
        assert.ok(checkColors(colors).some((warning) => warning.key === 'similarFields'));
    });
});

describe('Gespeichertes Farbschema', () => {
    it('liest ein gespeichertes Schema wieder ein', () => {
        const theme = { board: 'custom', pieces: 'gold', colors: { ...makeColors('blau', 'gold'), light: '#ffeedd' } };
        assert.deepEqual(parseStoredTheme(JSON.stringify(theme)), theme);
    });

    it('übernimmt den alten Speicherstand (nur der Name der Brettvorlage)', () => {
        assert.deepEqual(parseStoredTheme('gruen'), {
            board: 'gruen',
            pieces: 'klassisch',
            colors: makeColors('gruen', 'klassisch'),
        });
    });

    it('verwirft kaputte oder manipulierte Daten', () => {
        const valid = JSON.parse(JSON.stringify(DEFAULT_THEME));
        for (const text of [
            null,
            '',
            '{',
            'null',
            '42',
            '__proto__',
            '{}',
            JSON.stringify({ ...valid, board: 'gibtsnicht' }),
            JSON.stringify({ ...valid, board: '__proto__' }),
            JSON.stringify({ ...valid, board: ['holz'] }), // Liste statt Text
            JSON.stringify({ ...valid, colors: { ...valid.colors, dark: 'red' } }),
            JSON.stringify({ ...valid, colors: { ...valid.colors, frame: undefined } }),
        ]) {
            assert.equal(parseStoredTheme(text), null, String(text));
        }
    });

    it('übernimmt nur die bekannten Farben', () => {
        const valid = JSON.parse(JSON.stringify(DEFAULT_THEME));
        const theme = parseStoredTheme(JSON.stringify({ ...valid, colors: { ...valid.colors, evil: '#000000' } }));
        assert.deepEqual(Object.keys(theme.colors), ['light', 'dark', 'frame', 'pieceLight', 'pieceDark']);
    });
});
