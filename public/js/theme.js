// Farbschema für Brett und Steine: Fenster mit den Vorlagen, Farben als CSS-Variablen anwenden und im Browser merken.
// Die Vorlagen und die Kontrastprüfung stehen in colors.js
import {
    BOARD_PRESETS,
    PIECE_PRESETS,
    DEFAULT_THEME,
    deriveColors,
    parseStoredTheme,
    checkColors,
    formatRatio,
} from './colors.js';
import { t, getLanguage } from './i18n.js';

const STORAGE_KEY = 'boardTheme';
let currentTheme = DEFAULT_THEME; // Aktuelles Farbschema: { board, pieces, colors }
let draft = null; // Auswahl im geöffneten Fenster, wird erst mit "Übernehmen" zum aktuellen Farbschema

// Welche Farben zum Brett und welche zu den Steinen gehören (für eigene Farben)
const BOARD_COLOR_KEYS = ['light', 'dark', 'frame'];

/**
 * Schreibt die Farben als CSS-Variablen auf ein Element.
 * Auf <html> gelten sie für die ganze Seite, auf einem anderen Element nur darin (z.B. für eine Vorschau).
 * @param {HTMLElement} element
 * @param {Record<string, string>} colors - Die fünf Farben
 */
function applyColors(element, colors) {
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
 * @param {{ board: string, pieces: string, colors: Record<string, string> }} theme
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
 * Baut die Radiobuttons für eine Gruppe von Vorlagen, jeweils mit kleinen Farbfeldern davor.
 * Der Name steht in translations.js, z.B. presetBoard.holz (Bretter und Steine haben eigene Schlüssel,
 * weil es "gruen" bei beiden gibt)
 * @param {string} listId - ID der Liste im Fenster
 * @param {string} groupName - name der Radiobuttons
 * @param {Record<string, Record<string, string>>} presets - Vorlagen aus colors.js
 * @param {string[]} swatchKeys - Farben, die als Felder davor stehen
 * @param {string} keyPrefix - 'presetBoard' oder 'presetPieces'
 */
function renderPresetList(listId, groupName, presets, swatchKeys, keyPrefix) {
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
        label.append(input, swatches, t(`${keyPrefix}.${id}`));
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
 * Baut das Mini-Brett für die Vorschau: Steine beider Farben, je eine Dame, ein Zug- und ein Schlagfeld.
 * Es benutzt dieselben Klassen wie das echte Brett, die Farben kommen von applyColors auf der Vorschau.
 */
function renderPreview() {
    const preview = document.getElementById('themePreview');
    if (preview.childElementCount > 0) return; // Nur beim ersten Öffnen bauen

    // Was auf welchem Feld liegt: b = schwarz, w = weiß, B/W = Dame, m = Zugfeld, c = Schlagfeld
    const layout = ['.b.b.b.b', 'b.b.b.b.', '.......B', '....m...', '...c....', 'W.......', '.w.w.w.w', 'w.w.w.w.'];

    const board = document.createElement('div');
    board.className = 'preview-board';
    layout.forEach((rowText, row) => {
        [...rowText].forEach((symbol, col) => {
            const cell = document.createElement('span');
            cell.className = 'cell ' + ((row + col) % 2 !== 0 ? 'black-bg' : 'white-bg');
            if (symbol === 'm') cell.classList.add('highlighted');
            if (symbol === 'c') cell.classList.add('highlighted-capture');

            if ('bBwW'.includes(symbol)) {
                const piece = document.createElement('span');
                const color = symbol.toLowerCase() === 'w' ? 'white' : 'black';
                piece.className = `piece ${color}-piece` + (symbol === symbol.toUpperCase() ? ' dame' : '');
                cell.append(piece);
            }
            board.append(cell);
        });
    });

    // Beschriftung im Rahmen (ein Buchstabe pro Spalte), damit man deren Lesbarkeit sieht
    const label = document.createElement('div');
    label.className = 'preview-label';
    for (const letter of 'ABCDEFGH') {
        const span = document.createElement('span');
        span.textContent = letter;
        label.append(span);
    }

    preview.append(board, label);
}

/**
 * Zeigt die Kontrastprüfung des Entwurfs an
 */
function renderWarnings() {
    const warnings = checkColors(draft.colors);
    const box = document.getElementById('themeWarnings');

    if (warnings.length === 0) {
        const ok = document.createElement('p');
        ok.className = 'theme-ok';
        ok.textContent = t('theme.ok');
        box.replaceChildren(ok);
        return;
    }

    const intro = document.createElement('p');
    intro.textContent = t('theme.warningIntro');
    const list = document.createElement('ul');
    list.append(
        ...warnings.map(({ key, ratio, minimum }) => {
            const item = document.createElement('li');
            const language = getLanguage();
            item.textContent = t(`theme.warning.${key}`, {
                ratio: formatRatio(ratio, language),
                minimum: formatRatio(minimum, language),
            });
            return item;
        })
    );
    box.replaceChildren(intro, list);
}

/**
 * Bringt das Fenster auf den Stand des Entwurfs: Auswahl, Farbwähler, Vorschau und Kontrastprüfung
 */
function updateDialog() {
    showDraftSelection();

    // Nur ändern, wenn nötig: sonst würde ein gerade offener Farbwähler beim Ziehen gestört
    document.querySelectorAll('#themeForm input[type="color"]').forEach((input) => {
        if (input.value !== draft.colors[input.name]) input.value = draft.colors[input.name];
    });

    applyColors(document.getElementById('themePreview'), draft.colors);
    renderWarnings();
}

/**
 * Öffnet das Fenster mit einer Kopie des aktuellen Farbschemas als Entwurf
 */
export function openThemeDialog() {
    draft = structuredClone(currentTheme);
    renderPresetList('boardPresetList', 'boardPreset', BOARD_PRESETS, ['light', 'dark', 'frame'], 'presetBoard');
    renderPresetList('piecePresetList', 'piecePreset', PIECE_PRESETS, ['pieceLight', 'pieceDark'], 'presetPieces');
    renderPreview();
    updateDialog();

    const dialog = document.getElementById('themeDialog');
    dialog.returnValue = ''; // Ergebnis vom letzten Mal zurücksetzen
    dialog.showModal();
}

/**
 * Änderung im Fenster: Vorlage gewählt (deren Farben übernehmen) oder eigene Farbe eingestellt
 * @param {Event} event
 */
export function handleThemeInput(event) {
    const { name, value } = event.target;

    if (name === 'boardPreset') {
        const { light, dark, frame } = BOARD_PRESETS[value];
        draft.board = value;
        Object.assign(draft.colors, { light, dark, frame });
    } else if (name === 'piecePreset') {
        const { pieceLight, pieceDark } = PIECE_PRESETS[value];
        draft.pieces = value;
        Object.assign(draft.colors, { pieceLight, pieceDark });
    } else if (Object.hasOwn(draft.colors, name)) {
        // Eigene Farbe: Diese Gruppe entspricht keiner Vorlage mehr
        draft.colors[name] = value;
        if (BOARD_COLOR_KEYS.includes(name)) draft.board = 'custom';
        else draft.pieces = 'custom';
    }

    updateDialog();
}

/**
 * Fenster geschlossen: Nur bei "Übernehmen" wird der Entwurf zum neuen Farbschema (Escape oder "Abbrechen" verwerfen ihn)
 * @param {Event} event
 */
export function handleThemeDialogClose(event) {
    if (event.target.returnValue === 'apply' && draft) setTheme(draft);
    draft = null;
}
