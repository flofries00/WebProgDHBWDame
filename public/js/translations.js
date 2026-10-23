// Alle Texte der Oberfläche auf Deutsch und Englisch (Internationalisierung).
// Reine Daten ohne HTML: So kann ein Test prüfen, dass beide Sprachen dieselben Schlüssel haben.
// Platzhalter in geschweiften Klammern, z.B. {name}, ersetzt t() in i18n.js durch den echten Wert

export const TRANSLATIONS = {
    de: {
        'page.title': 'Dame Online - Browser Multiplayer',

        // Kopfzeile
        'header.title': 'Dame Online',
        'header.theme': 'Farbauswahl',
        'header.help': 'Hilfe',
        'header.sound': 'Ton an/aus',
        'header.darkMode': 'Dunkles Design',
        'header.lightMode': 'Helles Design',
        'header.languageShort': 'EN', // Der Button zeigt die Sprache, zu der er umschaltet
        'header.language': 'Switch to English',

        // Startseite (die Überschrift steht auch über der Namenseingabe)
        'mode.heading': 'DAME',
        'mode.subtitle': 'Web-Engineering Projekt',
        'mode.choose': 'Wähle deinen Spielmodus:',
        'mode.computer': '🤖 Gegen Computer',
        'mode.online': '👤 Gegen Mensch',
        'mode.tutorial': '📖 Tutorial',
    },
    en: {
        'page.title': 'Checkers Online - Browser Multiplayer',

        'header.title': 'Checkers Online',
        'header.theme': 'Colors',
        'header.help': 'Help',
        'header.sound': 'Sound on/off',
        'header.darkMode': 'Dark theme',
        'header.lightMode': 'Light theme',
        'header.languageShort': 'DE',
        'header.language': 'Auf Deutsch umschalten',

        'mode.heading': 'CHECKERS',
        'mode.subtitle': 'Web Engineering Project',
        'mode.choose': 'Choose your game mode:',
        'mode.computer': '🤖 Against the computer',
        'mode.online': '👤 Against a human',
        'mode.tutorial': '📖 Tutorial',
    },
};
