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
        // Gemeinsame Buttons
        'common.back': '← Zurück',
        'common.next': 'Weiter',
        'common.cancel': 'Abbrechen',

        // Namenseingabe
        'login.nameLabel': 'Wie lautet dein Spielername?',
        'login.nameHint': 'Erlaubt: 2 bis 16 Zeichen',
        'login.namePlaceholder': 'z.B. Max...',

        // Spiel einrichten
        'setup.heading': 'Spiel einrichten',
        'setup.variant': 'Variante',
        'setup.classic': 'Klassisch (8×8)',
        'setup.international': 'International (10×10)',
        'setup.time': 'Bedenkzeit pro Spieler',
        'setup.minutes1': '1 Minute',
        'setup.minutes3': '3 Minuten',
        'setup.minutes5': '5 Minuten',
        'setup.minutes10': '10 Minuten',
        'setup.party': 'Partymodus',
        'setup.partyHint': '1 bis 10 Minuten per Zufall, für beide gleich',

        // Warten, Partymodus und Münzwurf
        'wait.hello': 'Hallo,',
        'wait.searching': 'Warte auf Gegner...',
        'wait.time': 'Wartezeit:',
        'wait.cancel': 'Warten abbrechen',
        'party.drawing': 'Die Bedenkzeit wird ausgelost:',
        'coin.heading': 'Gegner gefunden.',
        'coin.opponent': 'Dein Gegner ist',
        'coin.intro': 'Die Münze lost deine Farbe aus:',

        // Spiel
        'game.heading': 'Spielfeld',
        'game.boardHelp':
            'Mit den Pfeiltasten über das Brett bewegen, mit Enter oder Leertaste einen Stein auswählen und auf ein Zielfeld ziehen, mit Escape die Auswahl aufheben.',
        'game.boardLabel': 'Spielbrett',
        'game.log': 'Spielverlauf',
        'game.chatLabel': 'Chat-Nachricht',
        'game.resign': 'Spiel aufgeben',

        // Spielende und Nachspielen
        'end.toStart': 'Zum Anfang',
        'end.previous': 'Zug zurück',
        'end.next': 'Zug vor',
        'end.toEnd': 'Zum Endstand',
        'end.lobby': 'Zurück zur Lobby',

        // Farben-Fenster
        'theme.heading': 'Farben',
        'theme.board': 'Brett',
        'theme.pieces': 'Steine',
        'theme.custom': 'Eigene Farben',
        'theme.light': 'Helle Felder',
        'theme.dark': 'Dunkle Felder',
        'theme.frame': 'Rahmen',
        'theme.pieceLight': 'Helle Steine',
        'theme.pieceDark': 'Dunkle Steine',
        'theme.apply': 'Übernehmen',

        // Tutorial
        'tutorial.boardLabel': 'Übungsbrett',
        'tutorial.skip': 'Überspringen',
        'tutorial.retry': 'Nochmal',
        'tutorial.international': 'International lernen',
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
        'common.back': '← Back',
        'common.next': 'Next',
        'common.cancel': 'Cancel',

        'login.nameLabel': "What's your player name?",
        'login.nameHint': 'Allowed: 2 to 16 characters',
        'login.namePlaceholder': 'e.g. Max...',

        'setup.heading': 'Game setup',
        'setup.variant': 'Variant',
        'setup.classic': 'Classic (8×8)',
        'setup.international': 'International (10×10)',
        'setup.time': 'Time per player',
        'setup.minutes1': '1 minute',
        'setup.minutes3': '3 minutes',
        'setup.minutes5': '5 minutes',
        'setup.minutes10': '10 minutes',
        'setup.party': 'Party mode',
        'setup.partyHint': '1 to 10 minutes at random, the same for both',

        'wait.hello': 'Hello,',
        'wait.searching': 'Waiting for an opponent...',
        'wait.time': 'Waiting time:',
        'wait.cancel': 'Stop waiting',
        'party.drawing': 'Drawing the time per player:',
        'coin.heading': 'Opponent found.',
        'coin.opponent': 'Your opponent is',
        'coin.intro': 'The coin decides your color:',

        'game.heading': 'Game board',
        'game.boardHelp':
            'Move across the board with the arrow keys, select a piece with Enter or Space and move it to a target square, cancel the selection with Escape.',
        'game.boardLabel': 'Board',
        'game.log': 'Move history',
        'game.chatLabel': 'Chat message',
        'game.resign': 'Resign',

        'end.toStart': 'To the start',
        'end.previous': 'Previous move',
        'end.next': 'Next move',
        'end.toEnd': 'To the final position',
        'end.lobby': 'Back to the lobby',

        'theme.heading': 'Colors',
        'theme.board': 'Board',
        'theme.pieces': 'Pieces',
        'theme.custom': 'Custom colors',
        'theme.light': 'Light squares',
        'theme.dark': 'Dark squares',
        'theme.frame': 'Frame',
        'theme.pieceLight': 'Light pieces',
        'theme.pieceDark': 'Dark pieces',
        'theme.apply': 'Apply',

        'tutorial.boardLabel': 'Practice board',
        'tutorial.skip': 'Skip',
        'tutorial.retry': 'Try again',
        'tutorial.international': 'Learn International',
    },
};
