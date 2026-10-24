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

        // Farben-Fenster: Namen der Vorlagen (die Farben stehen in colors.js) und Kontrastprüfung
        'presetBoard.holz': 'Holz',
        'presetBoard.gruen': 'Turnier',
        'presetBoard.blau': 'Eis',
        'presetBoard.marmor': 'Marmor',
        'presetBoard.sand': 'Sand',
        'presetBoard.lavendel': 'Lavendel',
        'presetBoard.dhbw': 'DHBW',
        'presetBoard.kirsche': 'Kirsche',
        'presetBoard.mint': 'Mint',
        'presetBoard.ozean': 'Ozean',
        'presetBoard.koralle': 'Koralle',
        'presetBoard.nacht': 'Nacht',
        'presetBoard.kontrast': 'Hoher Kontrast',
        'presetPieces.klassisch': 'Weiß / Schwarz',
        'presetPieces.elfenbein': 'Elfenbein / Braun',
        'presetPieces.marine': 'Creme / Marineblau',
        'presetPieces.gold': 'Gold / Schwarz',
        'presetPieces.rot': 'Creme / Rot',
        'presetPieces.silber': 'Silber / Anthrazit',
        'presetPieces.ahorn': 'Ahorn / Nussbaum',
        'presetPieces.gruen': 'Weiß / Dunkelgrün',
        'theme.ok': 'Alle Kontraste sind in Ordnung.',
        'theme.warningIntro': 'Hinweis: Diese Farben sind womöglich schwer zu erkennen.',
        'theme.warning.lightPieces':
            'Helle Steine heben sich kaum von den dunklen Feldern ab (Kontrast {ratio}:1, empfohlen {minimum}:1)',
        'theme.warning.darkPieces':
            'Dunkle Steine heben sich kaum von den dunklen Feldern ab (Kontrast {ratio}:1, empfohlen {minimum}:1)',
        'theme.warning.similarPieces':
            'Helle und dunkle Steine sind schwer zu unterscheiden (Kontrast {ratio}:1, empfohlen {minimum}:1)',
        'theme.warning.crownOnLight':
            'Die Krone auf hellen Steinen ist schwer zu erkennen (Kontrast {ratio}:1, empfohlen {minimum}:1)',
        'theme.warning.crownOnDark':
            'Die Krone auf dunklen Steinen ist schwer zu erkennen (Kontrast {ratio}:1, empfohlen {minimum}:1)',
        'theme.warning.frameLabel':
            'Die Beschriftung im Rahmen ist schwer lesbar (Kontrast {ratio}:1, empfohlen {minimum}:1)',
        'theme.warning.similarFields':
            'Helle und dunkle Felder sind schwer zu unterscheiden (Kontrast {ratio}:1, empfohlen {minimum}:1)',

        // Tutorial
        'tutorial.boardLabel': 'Übungsbrett',
        'tutorial.skip': 'Überspringen',
        'tutorial.retry': 'Nochmal',
        'tutorial.international': 'International lernen',

        // Tutorial (Lektionen in tutorial.js, hier ihre Texte)
        'tutorial.heading': '{name} ({number}/{total}): {lesson}',
        'tutorial.name': 'Tutorial',
        'tutorial.nameInternational': 'Tutorial International',
        'tutorial.letsGo': 'Los gehts!',
        'tutorial.continueJump': 'Weiter! Derselbe Stein muss noch einmal schlagen.',
        'tutorial.notThisCapture': 'Dieser Stein darf nicht schlagen: Ein anderer Schlag nimmt mehr Steine.',
        'tutorial.notThisPiece': 'Dieser Stein darf gerade nicht ziehen: Ein anderer Stein kann schlagen.',
        'tutorial.move.title': 'Ziehen',
        'tutorial.move.text':
            'Steine ziehen ein Feld schräg nach vorne. Tippe einen weißen Stein an und dann ein grünes Feld.',
        'tutorial.move.success': 'Richtig! So ziehst du einen Stein.',
        'tutorial.capture.title': 'Schlagen',
        'tutorial.capture.text':
            'Steht ein Gegner schräg vor dir und dahinter ist frei, springst du über ihn. Das rote Feld zeigt den Schlag.',
        'tutorial.capture.success': 'Geschlagen! Der schwarze Stein ist vom Brett.',
        'tutorial.mustCapture.title': 'Schlagzwang',
        'tutorial.mustCapture.text': 'Kannst du schlagen, musst du schlagen. Versuch mal, den rechten Stein zu ziehen.',
        'tutorial.mustCapture.success': 'Genau: Wer schlagen kann, muss schlagen.',
        'tutorial.multiJump.title': 'Mehrfachsprung',
        'tutorial.multiJump.text':
            'Kann derselbe Stein nach einem Schlag noch einmal schlagen, muss er weiterspringen. Schlage beide Steine.',
        'tutorial.multiJump.success': 'Doppelt geschlagen!',
        'tutorial.king.title': 'Dame',
        'tutorial.king.text': 'Erreicht ein Stein die gegnerische Grundlinie, wird er zur Dame und bekommt eine Krone.',
        'tutorial.king.success': 'Dein Stein ist jetzt eine Dame!',
        'tutorial.kingCapture.title': 'Die Dame schlägt',
        'tutorial.kingCapture.text':
            'Die Dame zieht und schlägt beliebig weit in alle Richtungen, auch aus der Ferne. Schlage den Stein.',
        'tutorial.kingCapture.success':
            'Geschafft! Jetzt kennst du alle Regeln der klassischen Variante! Viel Spaß beim Spielen!',
        'tutorial.backward.title': 'Rückwärts schlagen',
        'tutorial.backward.text':
            'International ist das Brett 10×10 groß. Steine ziehen weiter nur nach vorne, dürfen aber auch rückwärts schlagen. Schlage den Stein hinter dir.',
        'tutorial.backward.success': 'Richtig! Schlagen geht in alle vier Richtungen.',
        'tutorial.majority.title': 'Mehrheitsschlag',
        'tutorial.majority.text':
            'Hast du mehrere Schläge zur Wahl, musst du den nehmen, der die meisten Steine schlägt. Geschlagene Steine bleiben bis zum Ende des Zugs liegen.',
        'tutorial.majority.success': 'Genau: Es zählt immer der Schlag mit den meisten Steinen.',
        'tutorial.promotionAtEnd.title': 'Dame erst am Ende',
        'tutorial.promotionAtEnd.text':
            'Ein Stein wird nur zur Dame, wenn sein Zug auf der Grundlinie endet. Kann er dort weiterschlagen, muss er weiter. Schlage beide Steine.',
        'tutorial.promotionAtEnd.success':
            'Geschafft! Keine Dame, weil der Zug nicht auf der Grundlinie endete. Jetzt kennst du auch International!',

        // Hilfe-Fenster (die Texte selbst stehen in index.html)
        'help.startTutorial': 'Tutorial starten',
        'common.close': 'Schließen',

        // Namen der Varianten (z.B. im Wartebildschirm)
        'variant.klassisch': 'Klassisch',
        'variant.international': 'International',

        // Meldungen von ui.js
        'common.ok': 'OK',
        'login.errorChars': 'Bitte nur Buchstaben und Zahlen eingeben.',
        'login.errorShort': 'Der Name muss mindestens zwei Zeichen lang sein',
        'setup.findOpponent': 'Gegner suchen',
        'setup.startGame': 'Spiel starten',
        'setup.waitingBadge': '1 wartet',
        'setup.online': 'Gerade online: {count} Spieler',
        'setup.onlineOne': 'Gerade online: 1 Spieler',
        'wait.settings': '{variant}, Bedenkzeit: {minutes} min',
        'wait.settingsParty': '{variant}, Partymodus (Zufallszeit)',
        'party.result': 'Ihr habt beide {minutes} Minuten Bedenkzeit.',
        'party.resultOne': 'Ihr habt beide 1 Minute Bedenkzeit.',
        'coin.drawing': 'Auslosung läuft...',
        'coin.white': 'Du hast die weißen Steine',
        'coin.black': 'Du hast die schwarzen Steine',
        'coin.countdown': 'Spiel startet in {seconds} Sekunden...',
        'coin.countdownOne': 'Spiel startet in 1 Sekunde...',
        'end.replay': 'Nochmal spielen',
        'end.opponentWantsReplay': '{name} möchte noch eine Runde spielen!',
        'end.opponentLeft': '{name} hat das Spiel verlassen.',
        'end.opponentGone': 'Gegner ist weg.',
        'error.noConnectionTitle': 'Keine Verbindung',
        'error.noConnectionText': 'Der Server ist gerade nicht erreichbar.',
        'error.disconnectedTitle': 'Verbindung verloren',
        'error.disconnectedText': 'Die Verbindung zum Server ist abgebrochen. Die Partie wurde beendet.',

        // Spiel (game.js)
        'game.white': '(Weiß)',
        'game.black': '(Schwarz)',
        'game.yourTurn': 'Du bist am Zug',
        'game.opponentTurn': '{name} ist am Zug',
        'game.chatPlaceholder': 'Nachricht schreiben...',
        'game.chatDisabled': 'Chat im Singleplayer deaktiviert.',
        'game.chatReady': 'Chat bereit. Sag Hallo!',
        'game.chatOffline': 'System offline.',
        'game.resignTitle': 'Spiel wirklich aufgeben?',
        'game.resignOnline': 'Dein Gegner gewinnt dann automatisch.',
        'game.resignComputer': 'Die aktuelle Partie ist damit beendet.',
        'game.resignConfirm': 'Aufgeben',
        'game.resignCancel': 'Weiterspielen',

        // Spielverlauf: "Du" bzw. der Name steht fett davor
        'log.you': 'Du',
        'log.youMove': 'ziehst von {from} nach {to}',
        'log.youCapture': 'schlägst von {from} nach {to}',
        'log.otherMove': 'zieht von {from} nach {to}',
        'log.otherCapture': 'schlägt von {from} nach {to}',
        'log.promoted': ', der Stein wird zur Dame',

        // Beschriftung der Felder für Screenreader (z.B. "C3, weißer Stein, ausgewählt")
        'board.lightSquare': 'helles Feld',
        'board.empty': 'leer',
        'board.whitePiece': 'weißer Stein',
        'board.blackPiece': 'schwarzer Stein',
        'board.whiteKing': 'weiße Dame',
        'board.blackKing': 'schwarze Dame',
        'board.selected': 'ausgewählt',
        'board.moveHere': 'hierhin ziehen',
        'board.captureHere': 'hierhin schlagen',

        // Endbildschirm
        'end.timeout': 'Zeit abgelaufen! {winner} gewinnt!',
        'end.opponentLeftWin': '{name} hat das Spiel verlassen. {winner} gewinnt!',
        'end.won': '{winner} hat in {moves} Zügen gewonnen!',
        'end.wonOne': '{winner} hat in 1 Zug gewonnen!',
        'end.startPosition': 'Startaufstellung',
        'end.afterMove': 'Nach Zug {index} von {last}',
        'end.finalPosition': 'Endstand',
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

        'presetBoard.holz': 'Wood',
        'presetBoard.gruen': 'Tournament',
        'presetBoard.blau': 'Ice',
        'presetBoard.marmor': 'Marble',
        'presetBoard.sand': 'Sand',
        'presetBoard.lavendel': 'Lavender',
        'presetBoard.dhbw': 'DHBW',
        'presetBoard.kirsche': 'Cherry',
        'presetBoard.mint': 'Mint',
        'presetBoard.ozean': 'Ocean',
        'presetBoard.koralle': 'Coral',
        'presetBoard.nacht': 'Night',
        'presetBoard.kontrast': 'High contrast',
        'presetPieces.klassisch': 'White / Black',
        'presetPieces.elfenbein': 'Ivory / Brown',
        'presetPieces.marine': 'Cream / Navy',
        'presetPieces.gold': 'Gold / Black',
        'presetPieces.rot': 'Cream / Red',
        'presetPieces.silber': 'Silver / Anthracite',
        'presetPieces.ahorn': 'Maple / Walnut',
        'presetPieces.gruen': 'White / Dark green',
        'theme.ok': 'All contrasts are fine.',
        'theme.warningIntro': 'Note: These colors may be hard to see.',
        'theme.warning.lightPieces':
            'Light pieces barely stand out from the dark squares (contrast {ratio}:1, recommended {minimum}:1)',
        'theme.warning.darkPieces':
            'Dark pieces barely stand out from the dark squares (contrast {ratio}:1, recommended {minimum}:1)',
        'theme.warning.similarPieces':
            'Light and dark pieces are hard to tell apart (contrast {ratio}:1, recommended {minimum}:1)',
        'theme.warning.crownOnLight':
            'The crown on light pieces is hard to see (contrast {ratio}:1, recommended {minimum}:1)',
        'theme.warning.crownOnDark':
            'The crown on dark pieces is hard to see (contrast {ratio}:1, recommended {minimum}:1)',
        'theme.warning.frameLabel':
            'The labels on the frame are hard to read (contrast {ratio}:1, recommended {minimum}:1)',
        'theme.warning.similarFields':
            'Light and dark squares are hard to tell apart (contrast {ratio}:1, recommended {minimum}:1)',

        'tutorial.boardLabel': 'Practice board',
        'tutorial.skip': 'Skip',
        'tutorial.retry': 'Try again',
        'tutorial.international': 'Learn International',

        'tutorial.heading': '{name} ({number}/{total}): {lesson}',
        'tutorial.name': 'Tutorial',
        'tutorial.nameInternational': 'Tutorial International',
        'tutorial.letsGo': "Let's go!",
        'tutorial.continueJump': 'Keep going! The same piece must capture again.',
        'tutorial.notThisCapture': 'This piece may not capture: Another capture takes more pieces.',
        'tutorial.notThisPiece': 'This piece may not move right now: Another piece can capture.',
        'tutorial.move.title': 'Moving',
        'tutorial.move.text': 'Pieces move one square diagonally forward. Tap a white piece and then a green square.',
        'tutorial.move.success': 'Correct! That is how you move a piece.',
        'tutorial.capture.title': 'Capturing',
        'tutorial.capture.text':
            'If an opponent is diagonally in front of you and the square behind it is free, you jump over it. The red square shows the capture.',
        'tutorial.capture.success': 'Captured! The black piece is off the board.',
        'tutorial.mustCapture.title': 'Mandatory capture',
        'tutorial.mustCapture.text': 'If you can capture, you must capture. Try moving the piece on the right.',
        'tutorial.mustCapture.success': 'Exactly: If you can capture, you must.',
        'tutorial.multiJump.title': 'Multiple jumps',
        'tutorial.multiJump.text':
            'If the same piece can capture again after a capture, it must keep jumping. Capture both pieces.',
        'tutorial.multiJump.success': 'Double capture!',
        'tutorial.king.title': 'King',
        'tutorial.king.text': "A piece that reaches the opponent's back row becomes a king and gets a crown.",
        'tutorial.king.success': 'Your piece is now a king!',
        'tutorial.kingCapture.title': 'The king captures',
        'tutorial.kingCapture.text':
            'The king moves and captures any distance in all directions, even from afar. Capture the piece.',
        'tutorial.kingCapture.success': 'Done! Now you know all the rules of the classic variant! Have fun playing!',
        'tutorial.backward.title': 'Capturing backwards',
        'tutorial.backward.text':
            'In International the board has 10×10 squares. Pieces still only move forward, but may also capture backwards. Capture the piece behind you.',
        'tutorial.backward.success': 'Correct! Capturing works in all four directions.',
        'tutorial.majority.title': 'Majority capture',
        'tutorial.majority.text':
            'If you can choose between several captures, you must take the one that captures the most pieces. Captured pieces stay on the board until the move ends.',
        'tutorial.majority.success': 'Exactly: The capture with the most pieces always counts.',
        'tutorial.promotionAtEnd.title': 'King only at the end',
        'tutorial.promotionAtEnd.text':
            'A piece only becomes a king if its move ends on the back row. If it can capture on from there, it has to. Capture both pieces.',
        'tutorial.promotionAtEnd.success':
            'Done! No king, because the move did not end on the back row. Now you know International as well!',

        'help.startTutorial': 'Start tutorial',
        'common.close': 'Close',

        'variant.klassisch': 'Classic',
        'variant.international': 'International',

        'common.ok': 'OK',
        'login.errorChars': 'Please use only letters and digits.',
        'login.errorShort': 'The name must be at least two characters long',
        'setup.findOpponent': 'Find opponent',
        'setup.startGame': 'Start game',
        'setup.waitingBadge': '1 waiting',
        'setup.online': 'Online now: {count} players',
        'setup.onlineOne': 'Online now: 1 player',
        'wait.settings': '{variant}, time per player: {minutes} min',
        'wait.settingsParty': '{variant}, party mode (random time)',
        'party.result': 'You both have {minutes} minutes.',
        'party.resultOne': 'You both have 1 minute.',
        'coin.drawing': 'Drawing...',
        'coin.white': 'You play the white pieces',
        'coin.black': 'You play the black pieces',
        'coin.countdown': 'The game starts in {seconds} seconds...',
        'coin.countdownOne': 'The game starts in 1 second...',
        'end.replay': 'Play again',
        'end.opponentWantsReplay': '{name} wants to play another round!',
        'end.opponentLeft': '{name} has left the game.',
        'end.opponentGone': 'Your opponent has left.',
        'error.noConnectionTitle': 'No connection',
        'error.noConnectionText': 'The server cannot be reached right now.',
        'error.disconnectedTitle': 'Connection lost',
        'error.disconnectedText': 'The connection to the server was lost. The game has ended.',

        'game.white': '(White)',
        'game.black': '(Black)',
        'game.yourTurn': 'Your turn',
        'game.opponentTurn': "{name}'s turn",
        'game.chatPlaceholder': 'Write a message...',
        'game.chatDisabled': 'Chat is not available against the computer.',
        'game.chatReady': 'Chat ready. Say hello!',
        'game.chatOffline': 'System offline.',
        'game.resignTitle': 'Do you really want to resign?',
        'game.resignOnline': 'Your opponent will win automatically.',
        'game.resignComputer': 'This ends the current game.',
        'game.resignConfirm': 'Resign',
        'game.resignCancel': 'Keep playing',

        'log.you': 'You',
        'log.youMove': 'move from {from} to {to}',
        'log.youCapture': 'capture from {from} to {to}',
        'log.otherMove': 'moves from {from} to {to}',
        'log.otherCapture': 'captures from {from} to {to}',
        'log.promoted': ', the piece becomes a king',

        'board.lightSquare': 'light square',
        'board.empty': 'empty',
        'board.whitePiece': 'white piece',
        'board.blackPiece': 'black piece',
        'board.whiteKing': 'white king',
        'board.blackKing': 'black king',
        'board.selected': 'selected',
        'board.moveHere': 'move here',
        'board.captureHere': 'capture here',

        'end.timeout': 'Time is up! {winner} wins!',
        'end.opponentLeftWin': '{name} has left the game. {winner} wins!',
        'end.won': '{winner} won in {moves} moves!',
        'end.wonOne': '{winner} won in 1 move!',
        'end.startPosition': 'Starting position',
        'end.afterMove': 'After move {index} of {last}',
        'end.finalPosition': 'Final position',
    },
};
