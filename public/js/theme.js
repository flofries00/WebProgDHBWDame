// Farbschemata für Brett und Steine: setzt data-board-theme auf <html>, die Farben selbst stehen in base.css
const STORAGE_KEY = 'boardTheme';
const THEMES = ['holz', 'gruen', 'blau', 'kontrast'];

/**
 * Wendet ein Farbschema an und merkt es sich im Browser
 */
export function setBoardTheme(name) {
    if (!THEMES.includes(name)) name = 'holz'; // Unbekannte Werte (z.B. alter Speicherstand) ignorieren

    document.documentElement.dataset.boardTheme = name;
    document.getElementById('themeSelect').value = name;

    try {
        localStorage.setItem(STORAGE_KEY, name);
    } catch {
        // Speichern kann gesperrt sein (z.B. privater Modus), dann gilt die Wahl nur bis zum Neuladen
    }
}

/**
 * Lädt beim Start das zuletzt gewählte Farbschema (Standard: Holz)
 */
export function loadBoardTheme() {
    let saved = null;
    try {
        saved = localStorage.getItem(STORAGE_KEY);
    } catch {
        // Kein Zugriff auf den Speicher: Standard verwenden
    }
    setBoardTheme(saved ?? 'holz');
}
