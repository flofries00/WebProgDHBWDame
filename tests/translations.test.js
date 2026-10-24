// Unit-Tests für die Übersetzungen (public/js/translations.js): Fehlt in einer Sprache ein Text?
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TRANSLATIONS } from '../public/js/translations.js';
import { BOARD_PRESETS, PIECE_PRESETS, WARNING_KEYS } from '../public/js/colors.js';

/**
 * Platzhalter eines Textes, z.B. "Hallo {name}!" -> ['name']
 */
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe('Übersetzungen', () => {
    it('gibt es auf Deutsch und Englisch', () => {
        assert.deepEqual(Object.keys(TRANSLATIONS).sort(), ['de', 'en']);
    });

    it('haben in beiden Sprachen genau dieselben Schlüssel', () => {
        const german = Object.keys(TRANSLATIONS.de);
        const english = Object.keys(TRANSLATIONS.en);
        assert.deepEqual(
            german.filter((key) => !english.includes(key)),
            [],
            'Fehlt auf Englisch'
        );
        assert.deepEqual(
            english.filter((key) => !german.includes(key)),
            [],
            'Fehlt auf Deutsch'
        );
    });

    it('enthalten keine leeren Texte', () => {
        for (const [language, texts] of Object.entries(TRANSLATIONS)) {
            for (const [key, text] of Object.entries(texts)) {
                assert.ok(typeof text === 'string' && text.trim() !== '', `${language}: ${key} ist leer`);
            }
        }
    });

    it('haben einen Namen für jede Farbvorlage und einen Text für jede Kontrastwarnung', () => {
        const keys = [
            ...Object.keys(BOARD_PRESETS).map((id) => `presetBoard.${id}`),
            ...Object.keys(PIECE_PRESETS).map((id) => `presetPieces.${id}`),
            ...WARNING_KEYS.map((key) => `theme.warning.${key}`),
        ];
        for (const key of keys) assert.ok(Object.hasOwn(TRANSLATIONS.de, key), `Fehlt: ${key}`);
    });

    it('benutzen in beiden Sprachen dieselben Platzhalter', () => {
        for (const [key, text] of Object.entries(TRANSLATIONS.de)) {
            assert.deepEqual(placeholders(TRANSLATIONS.en[key]), placeholders(text), key);
        }
    });
});
