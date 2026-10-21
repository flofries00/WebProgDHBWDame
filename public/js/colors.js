// Farben für Brett und Steine: Vorlagen, Kontrastberechnung nach WCAG und Warnungen bei schlechten Kombinationen
// Reine Logik ohne HTML, damit sie mit node:test getestet werden kann

/**
 * Vorlagen fürs Brett, helle Felder, dunkle Felder und Rahmen
 * (die Beschriftung im Rahmen benutzt die Farbe der hellen Felder)
 */
export const BOARD_PRESETS = {
    holz: { name: 'Holz', light: '#deb887', dark: '#8b4513', frame: '#5c2e0e' },
    gruen: { name: 'Turnier', light: '#eeeed2', dark: '#4e7837', frame: '#2f4a21' },
    blau: { name: 'Eis', light: '#dee3e6', dark: '#4b6a7d', frame: '#2c3e4a' },
    marmor: { name: 'Marmor', light: '#e6e6e6', dark: '#6e6e6e', frame: '#3a3a3a' },
    sand: { name: 'Sand', light: '#f2e3c6', dark: '#8f6232', frame: '#5e3b1c' },
    lavendel: { name: 'Lavendel', light: '#ece4f5', dark: '#6a4c93', frame: '#3e2a5c' },
    dhbw: { name: 'DHBW', light: '#f6dcdc', dark: '#8e1b23', frame: '#4f0c12' },
    kontrast: { name: 'Hoher Kontrast', light: '#ffffff', dark: '#3a3a3a', frame: '#000000' },
};

/**
 * Vorlagen für die Steine: Grundfarbe der hellen (Weiß) und der dunklen Steine (Schwarz).
 * Verlauf und Glanz berechnet das CSS aus der Grundfarbe
 */
export const PIECE_PRESETS = {
    klassisch: { name: 'Weiß / Schwarz', pieceLight: '#e0e0e0', pieceDark: '#222222' },
    elfenbein: { name: 'Elfenbein / Braun', pieceLight: '#f2e8d0', pieceDark: '#4a2c12' },
    marine: { name: 'Creme / Marineblau', pieceLight: '#fbf3df', pieceDark: '#1f3a68' },
    gold: { name: 'Gold / Schwarz', pieceLight: '#e8c547', pieceDark: '#1a1a1a' },
};

/**
 * Standard: Holzbrett mit klassischen Steinen
 */
export const DEFAULT_THEME = { board: 'holz', pieces: 'klassisch', colors: makeColors('holz', 'klassisch') };

// Mindestkontraste nach WCAG 2.1: Grafiken (1.4.11) und normaler Text (1.4.3)
export const MIN_GRAPHIC_CONTRAST = 3;
export const MIN_TEXT_CONTRAST = 4.5;

// Helle und dunkle Felder müssen sich nicht nach WCAG unterscheiden, sollten aber erkennbar verschieden sein
const MIN_FIELD_CONTRAST = 1.5;

const COLOR_KEYS = ['light', 'dark', 'frame', 'pieceLight', 'pieceDark'];
/**
 * Setzt die fünf Farben aus einer Brett- und einer Steinvorlage zusammen
 */
export function makeColors(boardId, piecesId) {
    const { light, dark, frame } = BOARD_PRESETS[boardId];
    const { pieceLight, pieceDark } = PIECE_PRESETS[piecesId];
    return { light, dark, frame, pieceLight, pieceDark };
}

/**
 * Ist der Wert eine Farbe im Format "#rrggbb" (so liefert sie auch <input type="color">)?
 */
export function isHexColor(value) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

/**
 * Relative Helligkeit einer Farbe nach WCAG (0 = schwarz, 1 = weiß)
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
 */
export function contrastRatio(colorA, colorB) {
    const [lighter, darker] = [relativeLuminance(colorA), relativeLuminance(colorB)].sort((a, b) => b - a);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Wählt aus den Kandidaten die Farbe mit dem höchsten Kontrast zum Hintergrund
 */
export function bestContrast(background, candidates) {
    return candidates.reduce((best, color) =>
        contrastRatio(color, background) > contrastRatio(best, background) ? color : best
    );
}

/**
 * Hilfsfarben, die sich automatisch aus den gewählten Farben ergeben
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
 * Formatiert ein Kontrastverhältnis für die Anzeige, z.B. 2.456 -> "2,5"
 */
export function formatRatio(ratio) {
    return ratio.toFixed(1).replace('.', ',');
}

/**
 * Prüft eine Farbkombination und liefert verständliche Warnungen (leere Liste = alles in Ordnung)
 */
export function checkColors(colors) {
    const { light, dark, frame, pieceLight, pieceDark } = colors;
    const { darkPieceOutline, crownOnLight, crownOnDark } = deriveColors(colors);
    const GRAPHIC = MIN_GRAPHIC_CONTRAST;

    // Regeln: [Farbe A, Farbe B, Mindestkontrast, Warnung]
    const rules = [
        [pieceLight, dark, GRAPHIC, 'Helle Steine heben sich kaum von den dunklen Feldern ab'],
        [darkPieceOutline, dark, GRAPHIC, 'Dunkle Steine heben sich kaum von den dunklen Feldern ab'],
        [pieceLight, pieceDark, GRAPHIC, 'Helle und dunkle Steine sind schwer zu unterscheiden'],
        [crownOnLight, pieceLight, GRAPHIC, 'Die Krone auf hellen Steinen ist schwer zu erkennen'],
        [crownOnDark, pieceDark, GRAPHIC, 'Die Krone auf dunklen Steinen ist schwer zu erkennen'],
        [light, frame, MIN_TEXT_CONTRAST, 'Die Beschriftung im Rahmen ist schwer lesbar'],
        [light, dark, MIN_FIELD_CONTRAST, 'Helle und dunkle Felder sind schwer zu unterscheiden'],
    ];

    return rules
        .map(([colorA, colorB, minimum, text]) => ({ ratio: contrastRatio(colorA, colorB), minimum, text }))
        .filter(({ ratio, minimum }) => ratio < minimum)
        .map(
            ({ ratio, minimum, text }) =>
                `${text} (Kontrast ${formatRatio(ratio)}:1, empfohlen ${formatRatio(minimum)}:1)`
        );
}

/**
 * Liest ein gespeichertes Farbschema (Text aus dem localStorage) und prüft es
 * Liefert null, wenn nichts Brauchbares gespeichert ist (der Speicher lässt sich im Browser beliebig ändern)
 * Ältere Versionen haben nur den Namen der Brettvorlage gespeichert
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
