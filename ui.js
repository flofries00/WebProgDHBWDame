// Globale Variablen für den Spielablauf
let currentPlayerName = ""; // Merkt sich Spielernamen
let playerGetsWhite = true;
let searchTimeout; // Timer für Gegnersuche
let gameMode = ""; // Merkt sich Spielmodus
let opponentName = "Computer" // Platzhalter für Gegnername
const socket = io(); // Baut Verbindung zum Server auf

/**
 * Speichert den gewählten Spielmodus und wechselt zur Anmeldung.
 */
function selectMode(mode) {
    gameMode = mode;
    showScreen('loginScreen');

    // Später kann hier angepasst werden, was ich auf dem Login-Screen stehen haben will
    // bspw. "Name Spieler 1" vs. "Dein Name"
}

/**
 * Versteckt alle Bildschirme und zeigt nur den übergebenen an.
 * @param {string} screenId - Die ID des divs (z.B. 'loginScreen')
 */
function showScreen(screenId) {
    // Sucht alle Elemente mit der Klasse '.screen' und entfernt die Klasse '.active'
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    // Fügt die Klasse '.active' nur dem gewünschten Bildschirm hinzu
    document.getElementById(screenId).classList.add('active');
}

/**
 * Erlaubt das Starten der Gegnersuche durch Drücken der Enter-Taste im Eingabefeld
 */

function handleEnter(event) {
    // Prüfen, ob die Gedrückte Taste "Enter" ist.
    if (event.key === 'Enter') {
        const btn = document.getElementById('searchBtn');
        // Löst Klick nur aus, wenn Button nicht ausgegraut (disabled) ist.
        if (!btn.disabled) {
            startSearch();
        }
    }
}

/**
 * Prüft die Eingabe im Namensfeld auf Länge und erlaubte Zeichen.
 * Aktiviert/Deaktiviert den "Suchen"-Button entsprechend und zeigt spezifische Fehler an.
 */
function checkInput() {
    const nameInput = document.getElementById('playerName').value;
    const inputField = document.getElementById('playerName');
    const errorText = document.getElementById('nameError');
    const searchBtn = document.getElementById('searchBtn');

    // Fail-Safe Bedingung: Such-Button sofort sperren sobald getippt wird.
    searchBtn.disabled = true;

    // RegEx (Regulärer Ausdruck): ^ = Start, $ = Ende.
    // [a-zA-Z0-9äöüÄÖÜß] bedeutet: Nur Klein-, Großbuchstaben, Umlaute und Zahlen sind erlaubt.
    // Das + bedeutet: mindestens ein Zeichen muss vorhanden sein
    const isValidChars = /^[a-zA-Z0-9äöüÄÖÜß]+$/.test(nameInput);

    // Testen auf Fälle:
    // Fall 1: Feld ist komplett leer (oder User hat Input wieder komplett gelöscht)
    if (nameInput.length === 0) {
        errorText.textContent = ""; // Keinen Fehler anzeigen, wenn noch kein Input getätigt.
        inputField.classList.remove('invalid');
        return; // Funktion hier abbrechen, button bleibt gesperrt
    }

    // Fall 2: Es wurden Verbotene Zeichen (Sonderzeichen, Leerzeichen, Emojism etc.) eingegeben
    if (!isValidChars) {
        errorText.textContent = "Bitte nur Buchstaben und Zahlen eingeben.";
        inputField.classList.add('invalid');
        return; // Funktion hier abbrechen, button bleibt gesperrt
    }

    // Fall 3: Der Name ist zu kurz
    else if (nameInput.length < 2) {
        errorText.textContent = "Der Name muss mindestens zwei Zeichen lang sein";
        inputField.classList.add('invalid');
        return; // Funktion hier abbrechen, button bleibt gesperrt
    }

    // Fall 4: Keine Fehler, alles passt.
    errorText.textContent = ""; // Fehlertext löschen
    inputField.classList.remove('invalid'); // Roten Rahmen entfernen

    // Erst jetzt, wenn kein return ausgelöst wurde, wird der Button aktiviert.
    searchBtn.disabled = false;
}

/**
 * Wird aufgerufen, wenn man auf "Suchen" klickt.
 * Wechselt in den Wartebildschirm.
 */
function startSearch() {
    // Namen auslesen und speichern
    currentPlayerName = document.getElementById('playerName').value;

    // Namen in die HTML-Platzhalter der anderen Bildschirme eintragen
    document.getElementById('waitName').textContent = currentPlayerName;
    document.getElementById('p1Name').textContent = currentPlayerName;

    // Wechsel zum Wartebildschirm
    showScreen('waitingScreen');

    if (gameMode === 'local') {
        // Echter Multiplayer: Server um Match bitten
        socket.emit('findMatch', currentPlayerName);
    } else {
        // Computer: Wie bisher simuliert
        opponentName = "Computer";
        // Gegnernamen in HTML schreiben
        document.getElementById('opponentNameDisplay').textContent = opponentName;
        document.getElementById('legendOpponent').textContent = opponentName;
        document.getElementById('opponentNameHeader').textContent = opponentName;

        // Simuliert eine Netzwerksuche: Nach 2000 Millisekunden (2 Sekunden) geht es weiter
        searchTimeout = setTimeout(() => {
            playerGetsWhite = Math.random() < 0.5;
            showScreen('coinTossScreen');
            simulateCoinToss();
        }, 2000)
    }
}

/**
 * Bricht die Suche ab und geht zurück zur Anmeldung.
 */
function cancelWait() {
    // Laufenden Timer abbrechen
    clearTimeout(searchTimeout);

    showScreen('loginScreen');
}

/**
 * Simuliert den Münzwurf für den Startspieler.
 */
function simulateCoinToss() {
    // Eingegebenen Spielernamen dynamisch auf Münze anzeigen
    document.getElementById('legendName').textContent = currentPlayerName;

    const coin = document.getElementById('coinElement');
    const container = document.querySelector('.coin-container'); // Container für den Bounce holen

    coin.style.setProperty('--end-rotation', playerGetsWhite ? '1800deg' : '1980deg');

    // Kleiner Trick um Animationen bei einer Revanche auch abspielen zu lassen
    coin.classList.remove('spin');
    container.classList.remove('bounce');

    void coin.offsetWidth;
    coin.classList.add('spin');

    setTimeout(() => {

        // Münz-Container hüpfen lassen
        container.classList.add('bounce');

        const baseText = playerGetsWhite ? `${currentPlayerName} bekommt die weißen Steine.` : `${opponentName} bekommt die weißen Steine. ${currentPlayerName} spielt Schwarz.`
        
        const textEl = document.getElementById('startPlayerText');
        let timeLeft = 5;

        // Kurze Hilfsfunktion, die Text und Countdown in HMTL schreibt
        const updateText = () => {
            textEl.innerHTML = `${baseText}<br><br>Spiel startet in <strong>${timeLeft}</strong> Sekunden...`;
        };

        updateText(); // Startwert, direkt nach dem Münzaufprall anzeigen.

        // Sekundentakt für Countdown starten
        const countdown = setInterval(() => {
            timeLeft--;
            if (timeLeft > 0) {
                updateText();
            } else {
                clearInterval(countdown); // Timer stoppen
                startGame(); // Ins Spiel wechseln
            }
        }, 1000);

    }, 2000);
}

/**
 * Setzt das Spiel zurück und springt zur Anmeldung.
 */
function returnToLobby() {
    document.getElementById('playerName').value = ""; // Eingabefeld leeren
    checkInput(); // Button wieder deaktivieren
    showScreen('modeScreen'); // Zurück zur Anmeldung
}

/**
 * Überspringt die Anmeldung und startet direkt einen neuen Münzwurf.
 */
function restartGame() {
    showScreen('coinTossScreen');
    // UI wieder in den Lade-Zustand versetzen
    document.getElementById('startPlayerText').textContent = "Auslosung läuft...";
    simulateCoinToss();
}

// Antwort von Server empfangen
socket.on('matchFound', (data) => {
    opponentName = data.oppName;
    playerGetsWhite = data.isWhite;

    // Namen in HTML eintragen
    const oppDisp = document.getElementById('opponentNameDisplay');
    const legOpp = document.getElementById('legendOpponent');
    const oppHead = document.getElementById('opponentNameHeader');

    oppDisp.textContent = opponentName;
    legOpp.textContent = opponentName;
    oppHead.textContent = opponentName;

    // Animation starten
    showScreen('coinTossScreen');
    simulateCoinToss();
});

/**
 * Aktualisiert Echtzeit-Uhr in der oberen Navigation
 */
function updateRealTimeClock() {
    const clockEl = document.getElementById('realTimeClock');
    if (!clockEl) return;

    const now = new Date();
    // Zeit formatieren zu HH:MM
    const timeString = now.toLocaleDateString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
    });

    clockEl.textContent = timeString;
}

// Uhrzeitschleife starten (und jede Sekunde updaten)
setInterval(updateRealTimeClock, 1000);
// Direkt beim Laden der Seite aufrufen
updateRealTimeClock();