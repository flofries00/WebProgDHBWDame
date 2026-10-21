// Farbschema für Brett und Steine: Fenster mit den Vorlagen, Farben als CSS-Variablen anwenden und im Browser merken.
// Die Vorlagen und die Kontrastprüfung stehen in colors.js
import { BOARD_PRESETS, PIECE_PRESETS, DEFAULT_THEME, deriveColors, parseStoredTheme } from './colors.js';

const STORAGE_KEY = 'boardTheme';
let currentTheme = DEFAULT_THEME; // Aktuelles Farbschema: { board, pieces, colors }
let draft = null; // Auswahl im geöffneten Fenster, wird erst mit "Übernehmen" zum aktuellen Farbschema

/**
 * Schreibt die Farben als CSS-Variablen auf ein Element.
 * Auf <html> gelten sie für die ganze Seite, auf einem anderen Element nur darin (z.B. für eine Vorschau).
 */
export function applyColors(element, colors) {
    const { darkPieceOutline, crownOnLight, crownOnDark } = deriveColors(colors);
    const variables = {
        '--color-board-light': colors.light,
        '--color-board-dark': colors.dark,
        '--color-board-frame': colors.frame,
        '--color-piece-light': colors.pieceLight,
        '--color-piece-dark': colors.pieceDark,
        '--color-piece-black-outline': darkPieceOutline,
        '--color-crown-on-white': crownOnLight,
        '--color-crown-on-black': crownOnDark,
    };
    for (const [name, value] of Object.entries(variables)) {
        element.style.setProperty(name, value);
    }
}

/**
 * Macht ein Farbschema zum aktuellen und merkt es sich im Browser
 */
function setTheme(theme) {
    currentTheme = theme;
    applyColors(document.documentElement, theme.colors);

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
    } catch {
        // Speichern kann gesperrt sein (z.B. privater Modus), dann gilt die Wahl nur bis zum Neuladen
    }
}

/**
 * Lädt beim Start das zuletzt gewählte Farbschema (Standard: Holz mit weißen und schwarzen Steinen)
 */
export function loadTheme() {
    let saved = null;
    try {
        saved = localStorage.getItem(STORAGE_KEY);
    } catch {
        // Kein Zugriff auf den Speicher: Standard verwenden
    }
    setTheme(parseStoredTheme(saved) ?? DEFAULT_THEME);
}

/**
 * Baut die Radiobuttons für eine Gruppe von Vorlagen, jeweils mit kleinen Farbfeldern davor
 */
function renderPresetList(listId, groupName, presets, swatchKeys) {
    const options = Object.entries(presets).map(([id, preset]) => {
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = groupName;
        input.value = id;

        // Farbfelder sind nur Deko, der Name der Vorlage steht daneben
        const swatches = document.createElement('span');
        swatches.className = 'swatches';
        swatches.setAttribute('aria-hidden', 'true');
        for (const key of swatchKeys) {
            const swatch = document.createElement('span');
            swatch.style.backgroundColor = preset[key];
            swatches.append(swatch);
        }

        const label = document.createElement('label');
        label.className = 'preset-option';
        label.append(input, swatches, preset.name);
        return label;
    });
    document.getElementById(listId).replaceChildren(...options);
}

/**
 * Markiert im Fenster die Vorlagen, die im Entwurf ausgewählt sind
 */
function showDraftSelection() {
    for (const [groupName, value] of [
        ['boardPreset', draft.board],
        ['piecePreset', draft.pieces],
    ]) {
        document.querySelectorAll(`input[name="${groupName}"]`).forEach((input) => {
            input.checked = input.value === value;
        });
    }
}

/**
 * Öffnet das Fenster mit einer Kopie des aktuellen Farbschemas als Entwurf
 */
export function openThemeDialog() {
    draft = structuredClone(currentTheme);
    renderPresetList('boardPresetList', 'boardPreset', BOARD_PRESETS, ['light', 'dark', 'frame']);
    renderPresetList('piecePresetList', 'piecePreset', PIECE_PRESETS, ['pieceLight', 'pieceDark']);
    showDraftSelection();

    const dialog = document.getElementById('themeDialog');
    dialog.returnValue = ''; // Ergebnis vom letzten Mal zurücksetzen
    dialog.showModal();
}

/**
 * Andere Vorlage gewählt: deren Farben in den Entwurf übernehmen
 */
export function handleThemeChange(event) {
    const { name, value } = event.target;

    if (name === 'boardPreset') {
        const { light, dark, frame } = BOARD_PRESETS[value];
        draft.board = value;
        Object.assign(draft.colors, { light, dark, frame });
    } else if (name === 'piecePreset') {
        const { pieceLight, pieceDark } = PIECE_PRESETS[value];
        draft.pieces = value;
        Object.assign(draft.colors, { pieceLight, pieceDark });
    }
}

/**
 * Fenster geschlossen: Nur bei "Übernehmen" wird der Entwurf zum neuen Farbschema (Escape oder "Abbrechen" verwerfen ihn)
 */
export function handleThemeDialogClose(event) {
    if (event.target.returnValue === 'apply' && draft) setTheme(draft);
    draft = null;
}
