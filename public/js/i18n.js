// Sprache der Oberfläche (Deutsch oder Englisch): übersetzt das HTML und liefert den anderen Modulen ihre Texte.
// Ohne eigene Wahl gilt die Sprache des Browsers (Deutsch, sonst Englisch)
import { TRANSLATIONS } from './translations.js';

const STORAGE_KEY = 'language';

// Attribute, die im HTML übersetzt werden, z.B. <button data-i18n-title="header.help">
const ATTRIBUTES = ['title', 'aria-label', 'placeholder'];

let language = 'de';
const listeners = []; // Funktionen der anderen Module, die beim Sprachwechsel ihre Texte neu setzen

/**
 * Text zum Schlüssel in der aktuellen Sprache. Platzhalter wie {name} werden durch params.name ersetzt.
 * Ein Platzhalter kann selbst übersetzt werden: { variant: { key: 'variant.klassisch' } }.
 * Fehlt ein Text, steht der Schlüssel selbst da (so fällt eine fehlende Übersetzung sofort auf)
 */
export function t(key, params = {}) {
    const text = TRANSLATIONS[language][key] ?? key;
    return text.replace(/\{(\w+)\}/g, (placeholder, name) => {
        if (!Object.hasOwn(params, name)) return placeholder;
        const value = params[name];
        return typeof value === 'object' && value !== null ? t(value.key) : value;
    });
}

/**
 * Setzt einen Text, den JavaScript während des Spiels ändert (z.B. "Max möchte noch eine Runde spielen!").
 * Schlüssel und Platzhalter werden am Element gemerkt, so wird der Text beim Sprachwechsel mit übersetzt.
 * Ohne Schlüssel wird das Element geleert
 */
export function setText(element, key = null, params = {}) {
    if (!key) {
        delete element.dataset.i18n;
        delete element.dataset.i18nParams;
        element.textContent = '';
        return;
    }
    element.dataset.i18n = key;
    element.dataset.i18nParams = JSON.stringify(params);
    element.textContent = t(key, params);
}

/**
 * Aktuelle Sprache: 'de' oder 'en'
 */
export function getLanguage() {
    return language;
}

/**
 * Meldet eine Funktion an, die bei jedem Sprachwechsel aufgerufen wird (z.B. um eine Anzeige neu zu beschriften)
 */
export function onLanguageChange(listener) {
    listeners.push(listener);
}

/**
 * Setzt alle Texte im HTML neu: Elemente mit data-i18n bekommen ihren Text, data-i18n-title usw. ihr Attribut
 */
function applyLanguage() {
    document.documentElement.lang = language; // Damit Screenreader die richtige Aussprache wählen
    document.title = t('page.title');

    for (const element of document.querySelectorAll('[data-i18n]')) {
        // Platzhalter, die setText gemerkt hat (feste Texte im HTML haben keine)
        const params = element.dataset.i18nParams ? JSON.parse(element.dataset.i18nParams) : {};
        element.textContent = t(element.dataset.i18n, params);
    }
    for (const attribute of ATTRIBUTES) {
        for (const element of document.querySelectorAll(`[data-i18n-${attribute}]`)) {
            element.setAttribute(attribute, t(element.getAttribute(`data-i18n-${attribute}`)));
        }
    }

    // Längere Texte (Hilfe) stehen in beiden Sprachen im HTML: nur die passende Fassung zeigen
    for (const element of document.querySelectorAll('[data-lang]')) {
        element.hidden = element.dataset.lang !== language;
    }

    // Der Button ist in der Sprache beschriftet, zu der er umschaltet
    document.getElementById('languageBtn').lang = language === 'de' ? 'en' : 'de';

    listeners.forEach((listener) => listener());
}

/**
 * Beim Start: gespeicherte Sprache, sonst die des Browsers
 */
export function loadLanguage() {
    let saved = null;
    try {
        saved = localStorage.getItem(STORAGE_KEY);
    } catch {
        // Kein Zugriff auf den Speicher: Sprache des Browsers gilt
    }
    const browserLanguage = navigator.language?.startsWith('de') ? 'de' : 'en';
    language = typeof saved === 'string' && Object.hasOwn(TRANSLATIONS, saved) ? saved : browserLanguage;
    applyLanguage();
}

/**
 * Wechselt zwischen Deutsch und Englisch und merkt sich die Wahl im Browser
 */
export function toggleLanguage() {
    language = language === 'de' ? 'en' : 'de';
    applyLanguage();

    try {
        localStorage.setItem(STORAGE_KEY, language);
    } catch {
        // Speichern kann gesperrt sein, dann gilt die Wahl nur bis zum Neuladen
    }
}
