// Helles oder Dunkles Design der Seite (Dark-Mode). Das Brett behält seine Farben
// aus dem Farben-Fenster
// Ohne eigene Wahl gilt die Einstellung des Betriebssystems
import { t, onLanguageChange } from './i18n.js';

const STORAGE_KEY = 'colorMode';
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

/**
 * Ist gerade das Dunkle Design aktiv?
 */
function isDark() {
    const chosen = document.documentElement.dataset.colorMode;
    return chosen ? chosen === 'dark' : systemDark.matches;
}

/**
 * Passt Symbol und Beschriftung des Buttons an: Er zeigt wohin er umschaltet
 */
function updateButton() {
    const button = document.getElementById('colorModeBtn');
    const dark = isDark();
    button.textContent = dark ? '☀️' : '🌙';
    button.title = dark ? t('header.lightMode') : t('header.darkMode');
    button.setAttribute('aria-pressed', String(dark));
}

/**
 * Beim Start: Button beschriften und auf Änderungen der Systemeinstellung reagieren
 * Die gespeicherte Wahl setzt schon das kleine Script im <head> von index.html
 */
export function loadColorMode() {
    updateButton();
    systemDark.addEventListener('change', updateButton);
    onLanguageChange(updateButton);
}

/**
 * Wechselt zwischen hell und dunkel und merkt sich die Wahl im Browser
 */
export function toggleColorMode() {
    const mode = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.colorMode = mode;
    updateButton();

    try {
        localStorage.setItem(STORAGE_KEY, mode);
    } catch {
        // Speichern kann gesperrt sein, dann gilt die Wahl nur bis zum Neuladen
    }
}
