// Farben für Brett und Steine: Vorlagen, Kontrastberechnung nach WCAG und Warnungen bei schlechten Kombinationen
// Reine Logik ohne HTML, damit sie mit node:test getestet werden kann

/**
 * Vorlagen fürs Brett, helle Felder, dunkle Felder und Rahmen
 * (die Beschriftung im Rahmen benutzt die Farbe der hellen Felder).
 * Die Namen der Vorlagen stehen in translations.js (presetBoard.holz usw.)
 */
export const BOARD_PRESETS = {
    holz: { light: '#deb887', dark: '#8b4513', frame: '#5c2e0e' },
    gruen: { light: '#eeeed2', dark: '#4e7837', frame: '#2f4a21' },
    blau: { light: '#dee3e6', dark: '#4b6a7d', frame: '#2c3e4a' },
    marmor: { light: '#e6e6e6', dark: '#6e6e6e', frame: '#3a3a3a' },
    sand: { light: '#f2e3c6', dark: '#8f6232', frame: '#5e3b1c' },
    lavendel: { light: '#ece4f5', dark: '#6a4c93', frame: '#3e2a5c' },
    dhbw: { light: '#f6dcdc', dark: '#8e1b23', frame: '#4f0c12' },
    kirsche: { light: '#f5e1d2', dark: '#a0412d', frame: '#5a1f14' },
    mint: { light: '#e6f4ea', dark: '#2f7259', frame: '#173d2f' },
    ozean: { light: '#d8eef3', dark: '#1f6f8b', frame: '#0d3a4a' },
    koralle: { light: '#fde4d8', dark: '#b4472f', frame: '#5e2214' },
    nacht: { light: '#c9d1dc', dark: '#3b4a5e', frame: '#1b2330' },
    kontrast: { light: '#ffffff', dark: '#3a3a3a', frame: '#000000' },
};

/**
 * Vorlagen für die Steine: Grundfarbe der hellen (Weiß) und der dunklen Steine (Schwarz).
 * Verlauf und Glanz berechnet das CSS aus der Grundfarbe. Die Namen stehen in translations.js (presetPieces.gold usw.)
 */
export const PIECE_PRESETS = {
    klassisch: { pieceLight: '#e0e0e0', pieceDark: '#222222' },
    elfenbein: { pieceLight: '#f2e8d0', pieceDark: '#4a2c12' },
    marine: { pieceLight: '#fbf3df', pieceDark: '#1f3a68' },
    gold: { pieceLight: '#e8c547', pieceDark: '#1a1a1a' },
    rot: { pieceLight: '#f4ead5', pieceDark: '#9b1c1c' },
    silber: { pieceLight: '#c9ced3', pieceDark: '#2b2f33' },
    ahorn: { pieceLight: '#ecd5ad', pieceDark: '#3b2414' },
    gruen: { pieceLight: '#f0f0f0', pieceDark: '#1e4d2b' },
};

/**
 * Standard: Holzbrett mit klassischen Steinen
 */
export const DEFAULT_THEME = { board: 'holz', pieces: 'klassisch', colors: makeColors('holz', 'klassisch') };

// Mindestkontraste nach WCAG 2.1: Grafiken (1.4.11) und normaler Text (1.4.3)
const MIN_GRAPHIC_CONTRAST = 3;
const MIN_TEXT_CONTRAST = 4.5;

// Helle und dunkle Felder müssen sich nicht nach WCAG unterscheiden, sollten aber erkennbar verschieden sein
const MIN_FIELD_CONTRAST = 1.5;

const COLOR_KEYS = ['light', 'dark', 'frame', 'pieceLight', 'pieceDark'];
/**
 * Setzt die fünf Farben aus einer Brett- und einer Steinvorlage zusammen
 * @param {string} boardId - Schlüssel aus BOARD_PRESETS
 * @param {string} piecesId - Schlüssel aus PIECE_PRESETS
 * @returns {{ light: string, dark: string, frame: string, pieceLight: string, pieceDark: string }}
 */
export function makeColors(boardId, piecesId) {
    const { light, dark, frame } = BOARD_PRESETS[boardId];
    const { pieceLight, pieceDark } = PIECE_PRESETS[piecesId];
    return { light, dark, frame, pieceLight, pieceDark };
}

/**
 * Ist der Wert eine Farbe im Format "#rrggbb" (so liefert sie auch <input type="color">)?
 * @param {unknown} value
 * @returns {boolean}
 */
export function isHexColor(value) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

/**
 * Relative Helligkeit einer Farbe nach WCAG (0 = schwarz, 1 = weiß)
 * @param {string} hex - Farbe als "#rrggbb"
 * @returns {number}
 */
function relativeLuminance(hex) {
    const [r, g, b] = [1, 3, 5].map((start) => {
        const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
        // Bildschirme geben Farben nicht linear wieder, deshalb wird erst "entzerrt"
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b; // Grün wirkt für das Auge am hellsten
}

/**
 * Kontrastverhältnis zweier Farben nach WCAG: 1 (gleich) bis 21 (schwarz auf weiß)
 * @param {string} colorA - "#rrggbb"
 * @param {string} colorB - "#rrggbb"
 * @returns {number}
 */
export function contrastRatio(colorA, colorB) {
    const [lighter, darker] = [relativeLuminance(colorA), relativeLuminance(colorB)].sort((a, b) => b - a);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Wählt aus den Kandidaten die Farbe mit dem höchsten Kontrast zum Hintergrund
 * @param {string} background - "#rrggbb"
 * @param {string[]} candidates - Farben zur Auswahl
 * @returns {string}
 */
export function bestContrast(background, candidates) {
    return candidates.reduce((best, color) =>
        contrastRatio(color, background) > contrastRatio(best, background) ? color : best
    );
}

/**
 * Hilfsfarben, die sich automatisch aus den gewählten Farben ergeben
 * @param {Record<string, string>} colors - Die fünf gewählten Farben
 * @returns {{ darkPieceOutline: string, crownOnLight: string, crownOnDark: string }}
 */
export function deriveColors(colors) {
    return {
        // Rand der dunklen Steine: hell oder dunkel, je nachdem, was sich besser vom dunklen Feld abhebt
        darkPieceOutline: bestContrast(colors.dark, ['#dddddd', '#111111']),
        // Krone der Dame: dunkles oder helles Gold, je nach Steinfarbe
        crownOnLight: bestContrast(colors.pieceLight, ['#7a5c00', '#ffd700']),
        crownOnDark: bestContrast(colors.pieceDark, ['#7a5c00', '#ffd700']),
    };
}

/**
 * Formatiert ein Kontrastverhältnis für die Anzeige, z.B. 2.456 -> "2,5" (Deutsch) bzw. "2.5" (Englisch)
 * @param {number} ratio
 * @param {'de' | 'en'} [language]
 * @returns {string}
 */
export function formatRatio(ratio, language = 'de') {
    const text = ratio.toFixed(1);
    return language === 'de' ? text.replace('.', ',') : text;
}

// Regeln der Kontrastprüfung: [Farbe A, Farbe B, Mindestkontrast, Name der Warnung].
// Die Farben sind Namen aus den fünf Farben bzw. aus deriveColors, die Texte stehen in translations.js (theme.warning.<Name>)
const CONTRAST_RULES = [
    ['pieceLight', 'dark', MIN_GRAPHIC_CONTRAST, 'lightPieces'],
    ['darkPieceOutline', 'dark', MIN_GRAPHIC_CONTRAST, 'darkPieces'],
    ['pieceLight', 'pieceDark', MIN_GRAPHIC_CONTRAST, 'similarPieces'],
    ['crownOnLight', 'pieceLight', MIN_GRAPHIC_CONTRAST, 'crownOnLight'],
    ['crownOnDark', 'pieceDark', MIN_GRAPHIC_CONTRAST, 'crownOnDark'],
    ['light', 'frame', MIN_TEXT_CONTRAST, 'frameLabel'],
    ['light', 'dark', MIN_FIELD_CONTRAST, 'similarFields'],
];

// Namen aller möglichen Warnungen (der Test prüft damit, dass es zu jeder einen Text gibt)
export const WARNING_KEYS = CONTRAST_RULES.map((rule) => rule[3]);

/**
 * Prüft eine Farbkombination (leere Liste = alles in Ordnung). Jede Warnung ist ein Objekt
 * { key, ratio, minimum }, den Text dazu baut theme.js in der gewählten Sprache
 * @param {Record<string, string>} colors - Die fünf gewählten Farben
 * @returns {{ key: string, ratio: number, minimum: number }[]}
 */
export function checkColors(colors) {
    const allColors = { ...colors, ...deriveColors(colors) };
    return CONTRAST_RULES.map(([colorA, colorB, minimum, key]) => ({
        key,
        ratio: contrastRatio(allColors[colorA], allColors[colorB]),
        minimum,
    })).filter(({ ratio, minimum }) => ratio < minimum);
}

/**
 * Liest ein gespeichertes Farbschema (Text aus dem localStorage) und prüft es
 * Liefert null, wenn nichts Brauchbares gespeichert ist (der Speicher lässt sich im Browser beliebig ändern)
 * Ältere Versionen haben nur den Namen der Brettvorlage gespeichert
 * @param {unknown} text - Gespeicherter Text
 * @returns {{ board: string, pieces: string, colors: Record<string, string> } | null}
 */
export function parseStoredTheme(text) {
    if (typeof text !== 'string') return null;
    if (Object.hasOwn(BOARD_PRESETS, text))
        return { board: text, pieces: 'klassisch', colors: makeColors(text, 'klassisch') };

    let theme;
    try {
        theme = JSON.parse(text);
    } catch {
        return null; // Kein gültiges JSON
    }

    // 'custom' = eigene Farben statt einer Vorlage
    const isChoice = (value, presets) =>
        value === 'custom' || (typeof value === 'string' && Object.hasOwn(presets, value));
    const boardValid = isChoice(theme?.board, BOARD_PRESETS);
    const piecesValid = isChoice(theme?.pieces, PIECE_PRESETS);
    const colorsValid = COLOR_KEYS.every((key) => isHexColor(theme?.colors?.[key]));
    if (!boardValid || !piecesValid || !colorsValid) return null;

    // Nur die bekannten Felder übernehmen
    const colors = Object.fromEntries(COLOR_KEYS.map((key) => [key, theme.colors[key]]));
    return { board: theme.board, pieces: theme.pieces, colors };
}
