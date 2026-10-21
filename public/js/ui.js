import { state } from './state.js';
import { socket } from './socket.js';
import { startGame, endGame, stopGame } from './game.js';
import { playSound } from './sound.js';

// Globale Variablen für den Spielablauf

let searchTimeout; // Timer für Gegnersuche
let coinTossTimeout; // Timer bis zur Landung der Münze
let countdownInterval; // Countdown bis Spielstart
let partyTimeout; // Nächster Schritt der Zeit-Auslosung im Partymodus
let queueStatus = null; // Letzter Stand der Warteschlangen vom Server: { waiting: { '1': 0, ... }, online }

/**
 * Speichert den gewählten Spielmodus und wechselt zur Anmeldung.
 */
export function selectMode(mode) {
    state.gameMode = mode;
    showScreen('loginScreen');
}

/**
 * Versteckt alle Bildschirme und zeigt nur den übergebenen an.
 * @param {string} screenId - ID des Bildschirms (z.B. 'loginScreen')
 */
export function showScreen(screenId) {
    // Sucht alle Elemente mit der Klasse '.screen' und entfernt die Klasse '.active'
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    // Fügt die Klasse '.active' nur dem gewünschten Bildschirm hinzu
    document.getElementById(screenId).classList.add('active');
}

/**
 * Prüft die Eingabe im Namensfeld auf Länge und erlaubte Zeichen.
 * Gibt den Button "Weiter" nur bei gültigem Namen frei und zeigt passende Fehlermeldungen an.
 */
export function checkInput() {
    const inputField = document.getElementById('playerName');
    const nameInput = inputField.value;
    const errorText = document.getElementById('nameError');
    const searchBtn = document.getElementById('searchBtn');

    // Button erst einmal sperren, er wird nur bei gültigem Namen wieder freigegeben
    searchBtn.disabled = true;

    // RegEx (Regulärer Ausdruck): ^ = Start, $ = Ende.
    // [a-zA-Z0-9äöüÄÖÜß] bedeutet: Nur Klein-, Großbuchstaben, Umlaute und Zahlen sind erlaubt.
    // Das + bedeutet: mindestens ein Zeichen muss vorhanden sein
    const isValidChars = /^[a-zA-Z0-9äöüÄÖÜß]+$/.test(nameInput);

    // Die möglichen Fälle nacheinander prüfen:
    // Fall 1: Feld ist komplett leer (oder der Name wurde wieder gelöscht)
    if (nameInput.length === 0) {
        errorText.textContent = ''; // Ohne Eingabe keine Fehlermeldung
        inputField.classList.remove('invalid');
        return; // Button bleibt gesperrt
    }

    // Fall 2: Es wurden verbotene Zeichen eingegeben (Sonderzeichen, Leerzeichen, Emojis usw.)
    if (!isValidChars) {
        errorText.textContent = 'Bitte nur Buchstaben und Zahlen eingeben.';
        inputField.classList.add('invalid');
        return; // Button bleibt gesperrt
    }

    // Fall 3: Der Name ist zu kurz
    else if (nameInput.length < 2) {
        errorText.textContent = 'Der Name muss mindestens zwei Zeichen lang sein';
        inputField.classList.add('invalid');
        return; // Button bleibt gesperrt
    }

    // Fall 4: Der Name ist gültig
    errorText.textContent = ''; // Fehlertext löschen
    inputField.classList.remove('invalid'); // Roten Rahmen entfernen

    // Erst jetzt, wenn kein return ausgelöst wurde, wird der Button aktiviert.
    searchBtn.disabled = false;
}

/**
 * Nach gültigem Namen: Namen merken und zum Bildschirm "Spiel einrichten" wechseln
 */
export function showSetup() {
    // Schutz vor Doppelauslösung
    if (!document.getElementById('loginScreen').classList.contains('active')) return;

    state.currentPlayerName = document.getElementById('playerName').value;
    // Gegen den Computer gibt es nichts zu suchen
    document.getElementById('setupStartBtn').textContent =
        state.gameMode === 'online' ? 'Gegner suchen' : 'Spiel starten';
    renderQueueStatus();
    showScreen('setupScreen');
}

/**
 * Zeigt im Setup-Bildschirm, bei welcher Bedenkzeit schon jemand wartet und wie viele Spieler online sind.
 * Gegen den Computer bleibt alles leer.
 */
function renderQueueStatus() {
    const isOnline = state.gameMode === 'online' && queueStatus;

    document.querySelectorAll('input[name="timeSetting"]').forEach((input) => {
        const badge = input.parentElement.querySelector('.queue-badge');
        badge.textContent = isOnline && queueStatus.waiting[input.value] > 0 ? '1 wartet' : '';
    });

    document.getElementById('onlineCount').textContent = isOnline ? `Gerade online: ${queueStatus.online} Spieler` : '';
}

// Der Server meldet jede Änderung an den Warteschlangen, die Anzeige aktualisiert sich sofort
socket.on('queueStatus', (status) => {
    queueStatus = status;
    renderQueueStatus();
});

/**
 * Wird aufgerufen, wenn man auf "Gegner suchen" bzw. "Spiel starten" klickt.
 * Wechselt in den Wartebildschirm.
 */
export function startSearch() {
    // Schutz vor Doppelauslösung: nur suchen, wenn der Setup-Bildschirm wirklich angezeigt wird
    if (!document.getElementById('setupScreen').classList.contains('active')) return;

    // Ohne Serververbindung ist keine Online-Partie möglich
    if (state.gameMode === 'online' && !socket.connected) {
        showConfirm('Keine Verbindung', 'Der Server ist gerade nicht erreichbar.', 'OK');
        return;
    }

    // Gewählte Bedenkzeit merken und im Wartebildschirm anzeigen
    state.timeSetting = document.querySelector('input[name="timeSetting"]:checked').value;
    document.getElementById('waitTimeText').textContent =
        state.timeSetting === 'party' ? 'Partymodus (Zufallszeit)' : `Bedenkzeit: ${state.timeSetting} min`;

    // Namen in die HTML-Platzhalter der anderen Bildschirme eintragen
    document.getElementById('waitName').textContent = state.currentPlayerName;
    document.getElementById('p1Name').textContent = state.currentPlayerName;

    // Wechsel zum Wartebildschirm
    showScreen('waitingScreen');

    if (state.gameMode === 'online') {
        // Echter Multiplayer: Server um Match mit gleicher Bedenkzeit bitten
        socket.emit('findMatch', state.currentPlayerName, state.timeSetting);
    } else {
        // Gegen den Computer: Die Suche wird nur simuliert
        state.opponentName = 'Computer';
        // Gegnernamen in HTML schreiben
        document.getElementById('opponentNameDisplay').textContent = state.opponentName;
        document.getElementById('opponentNameHeader').textContent = state.opponentName;

        // Sicherheitshalber alten Timer stoppen, bevor ein neuer startet
        clearTimeout(searchTimeout);

        // Simuliert eine Netzwerksuche: Nach 2000 Millisekunden (2 Sekunden) geht es weiter
        searchTimeout = setTimeout(startComputerMatch, 2000);
    }
}

/**
 * Bricht die Suche ab und geht zurück zum Setup-Bildschirm
 */
export function cancelWait() {
    // Laufenden Timer abbrechen
    clearTimeout(searchTimeout);

    // Beim Server aus der Warteschlange austragen
    if (state.gameMode === 'online') {
        socket.emit('cancelSearch');
    }

    showScreen('setupScreen'); // Zurück zur Auswahl, Name und Bedenkzeit bleiben erhalten
}

/**
 * Gegen den Computer: Farbe und (im Partymodus) Bedenkzeit selbst auslosen, dann geht es los
 */
function startComputerMatch() {
    state.playerGetsWhite = Math.random() < 0.5;
    state.timeMinutes = state.timeSetting === 'party' ? Math.floor(Math.random() * 10) + 1 : Number(state.timeSetting);
    beginMatchIntro();
}

/**
 * Vor dem Spiel: im Partymodus zuerst die Auslosung der Bedenkzeit, danach immer der Münzwurf
 */
function beginMatchIntro() {
    if (state.timeSetting === 'party') {
        showPartyDraw();
    } else {
        showScreen('coinTossScreen');
        simulateCoinToss();
    }
}

/**
 * Partymodus: Zahlen laufen wie bei einem Glücksrad durch, werden langsamer und bleiben bei der Bedenkzeit stehen
 */
function showPartyDraw() {
    clearTimeout(partyTimeout);
    showScreen('partyScreen');

    const numberEl = document.getElementById('partyTimeNumber');
    const textEl = document.getElementById('partyTimeText');
    textEl.textContent = '';

    const steps = 15;
    let step = 0;

    const spin = () => {
        if (step < steps) {
            numberEl.textContent = Math.floor(Math.random() * 10) + 1;
            playSound('move');
            step++;
            partyTimeout = setTimeout(spin, 50 + step * step * 1.5); // Jeder Schritt dauert etwas länger
            return;
        }

        // Ergebnis anzeigen (die Zeit steht schon fest: vom Server bzw. in startComputerMatch ausgelost)
        const minutes = state.timeMinutes;
        numberEl.textContent = minutes;
        textEl.textContent = `Ihr habt beide ${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'} Bedenkzeit.`;
        playSound('coinLand');

        partyTimeout = setTimeout(() => {
            showScreen('coinTossScreen');
            simulateCoinToss();
        }, 2000);
    };
    spin();
}

/**
 * Münzwurf: Die Münze zeigt die eigene Farbe, danach läuft der Countdown bis zum Spielstart
 */
export function simulateCoinToss() {
    // Evtl. noch laufende Timer einer vorherigen Auslosung stoppen
    clearTimeout(coinTossTimeout);
    clearInterval(countdownInterval);

    // Text der letzten Runde zurücksetzen
    document.getElementById('startPlayerText').textContent = 'Auslosung läuft...';
    document.getElementById('countdownText').textContent = '';

    const coin = document.getElementById('coinElement');
    const container = document.querySelector('.coin-container'); // Container für den Bounce holen

    coin.style.setProperty('--end-rotation', state.playerGetsWhite ? '1800deg' : '1980deg');

    // Animation neu starten (auch bei einer Revanche): Klasse entfernen, Neuberechnung erzwingen, Klasse wieder setzen
    coin.classList.remove('spin');
    container.classList.remove('bounce');

    void coin.offsetWidth;
    coin.classList.add('spin');
    playSound('coinFlip');

    coinTossTimeout = setTimeout(() => {
        // Münz-Container hüpfen lassen
        container.classList.add('bounce');
        playSound('coinLand');

        // Ergebnis aus Sicht des Spielers
        const baseText = state.playerGetsWhite ? 'Du hast die weißen Steine' : 'Du hast die schwarzen Steine';

        document.getElementById('startPlayerText').textContent = baseText;
        const countdownEl = document.getElementById('countdownText');
        let timeLeft = 5;

        // Kurze Hilfsfunktion, die den Countdown in HTML schreibt
        const updateText = () => {
            const strong = document.createElement('strong');
            strong.textContent = timeLeft;
            countdownEl.replaceChildren('Spiel startet in ', strong, timeLeft === 1 ? ' Sekunde...' : ' Sekunden...');
        };

        updateText(); // Startwert, direkt nach dem Münzaufprall anzeigen.

        // Sekundentakt für Countdown starten
        countdownInterval = setInterval(() => {
            timeLeft--;
            if (timeLeft > 0) {
                updateText();
            } else {
                clearInterval(countdownInterval); // Timer stoppen
                startGame(); // Ins Spiel wechseln
            }
        }, 1000);
    }, 2000);
}

/**
 * Beantragt eine Revanche beim Server
 */
export function requestReplay() {
    if (state.gameMode === 'online') {
        const btn = document.getElementById('replayBtn');
        btn.disabled = true;
        btn.textContent = 'Warte auf Gegner...';
        socket.emit('requestReplay');
    } else {
        // Gegen Computer startet das Spiel sofort wieder, Farbe (und im Partymodus die Zeit) wird neu ausgelost
        startComputerMatch();
    }
}

/**
 * Verlässt die Partie und kehrt zur Modusauswahl zurück
 */
export function leaveToLobby() {
    if (state.gameMode === 'online') {
        socket.emit('leaveMatch');
    }

    // Eingabefeld und Buttons für nächstes Mal zurücksetzen
    document.getElementById('playerName').value = '';
    checkInput();

    const btn = document.getElementById('replayBtn');
    if (btn) {
        btn.disabled = false;
        btn.textContent = 'Nochmal spielen';
    }

    const status = document.getElementById('replayStatus');
    if (status) status.textContent = '';

    showScreen('modeScreen');
}

// Der Server hat einen Gegner gefunden (auch bei einer Revanche)
socket.on('matchFound', (data) => {
    state.opponentName = data.oppName;
    state.playerGetsWhite = data.isWhite;
    state.timeMinutes = data.timeMinutes;

    // Namen in HTML eintragen
    const oppDisp = document.getElementById('opponentNameDisplay');
    const oppHead = document.getElementById('opponentNameHeader');

    oppDisp.textContent = state.opponentName;
    oppHead.textContent = state.opponentName;

    // Revanche-Anzeige für die nächste Runde zurücksetzen
    const replayBtn = document.getElementById('replayBtn');
    const replayStatus = document.getElementById('replayStatus');
    if (replayBtn) {
        replayBtn.disabled = false;
        replayBtn.textContent = 'Nochmal spielen';
    }
    if (replayStatus) replayStatus.textContent = '';

    // Animation starten (im Partymodus zuerst die Auslosung der Zeit)
    beginMatchIntro();
});

/**
 * Aktualisiert die Uhrzeit in der Kopfzeile
 */
function updateRealTimeClock() {
    const clockEl = document.getElementById('realTimeClock');
    if (!clockEl) return;

    const now = new Date();
    // Zeit formatieren zu HH:MM
    const timeString = now.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
    });

    clockEl.textContent = timeString;
}

// Uhrzeit jede Sekunde aktualisieren
setInterval(updateRealTimeClock, 1000);
// Direkt beim Laden der Seite aufrufen
updateRealTimeClock();

/**
 * Verarbeitet Chat-Eingaben
 */
export function handleChatSubmit(event) {
    event.preventDefault(); // Formular nicht wirklich abschicken (sonst lädt die Seite neu)

    const input = document.getElementById('chatInput');
    const msg = input.value.trim();

    if (msg.length > 0) {
        // a) Nachricht lokal anzeigen
        addChatMessage('Du', msg, true);

        // b) Nachricht an Server senden
        if (state.gameMode === 'online') {
            socket.emit('chatMessage', msg);
        }

        // c) Eingabefeld wieder leeren
        input.value = '';
    }
}

/**
 * Fügt eine Nachricht zur Chatbox hinzu
 */
function addChatMessage(sender, msg, isSelf) {
    const container = document.querySelector('.chat-messages');
    const p = document.createElement('p');
    p.className = 'chat-message';

    // Eigene Nachrichten farblich hervorheben (Farben stehen im CSS)
    // textContent statt innerHTML, damit Nachrichten kein HTML/JS einschleusen können
    const strong = document.createElement('strong');
    strong.className = isSelf ? 'chat-sender self' : 'chat-sender';
    strong.textContent = `${sender}:`;
    p.append(strong, ` ${msg}`);

    container.appendChild(p);

    // Automatisch nach unten scrollen
    container.scrollTop = container.scrollHeight;
}

// Lauscht permanent auf eingehende Nachrichten vom Server
socket.on('chatMessage', (msg) => {
    addChatMessage(state.opponentName, msg, false);
});

// Socket-Ereignisse für die Revanche
socket.on('opponentWantsReplay', () => {
    const status = document.getElementById('replayStatus');
    if (status) {
        status.textContent = `${state.opponentName} möchte noch eine Runde spielen!`;
    }
});

socket.on('opponentLeft', () => {
    const status = document.getElementById('replayStatus');
    const btn = document.getElementById('replayBtn');

    // Gegner verlässt während der Auslosung oder des Münzwurfs -> Start abbrechen, zurück zur Lobby
    if (document.getElementById('partyScreen').classList.contains('active')) {
        clearTimeout(partyTimeout);
        document.getElementById('partyTimeText').textContent = `${state.opponentName} hat das Spiel verlassen.`;
        setTimeout(leaveToLobby, 3000);
        return;
    }
    if (document.getElementById('coinTossScreen').classList.contains('active')) {
        clearTimeout(coinTossTimeout);
        clearInterval(countdownInterval);
        document.getElementById('startPlayerText').textContent = `${state.opponentName} hat das Spiel verlassen.`;
        document.getElementById('countdownText').textContent = '';
        setTimeout(leaveToLobby, 3000);
        return;
    }

    // Gegner verlässt laufendes Spiel -> man gewinnt automatisch
    if (document.getElementById('gameScreen').classList.contains('active')) {
        endGame(state.playerGetsWhite ? 'white' : 'black', 'opponentLeft');
    }

    if (status) {
        status.textContent = `${state.opponentName} hat das Spiel verlassen.`;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Gegner ist weg.';
    }
});

/**
 * Lässt beim Gewinner Konfetti regnen (Animation per CSS)
 */
export function fireConfetti() {
    if (prefersReducedMotion()) return;

    // Farben der Schnipsel
    const colors = ['#e2001a', '#28a745', '#007bff', '#ffc107', '#ffd700'];

    // 150 Schnipsel erzeugen
    for (let i = 0; i < 150; i++) {
        const conf = document.createElement('div');
        conf.className = 'confetti-piece';

        // Zufällige Position auf der x-Achse
        conf.style.left = Math.random() * 100 + 'vw';
        // Zufällige Farbe
        const randColor = colors[Math.floor(Math.random() * colors.length)];
        conf.style.backgroundColor = randColor;

        // Zufällige Fallgeschwindigkeit und Verzögerung
        conf.style.animationDuration = Math.random() * 3 + 2 + 's';
        conf.style.animationDelay = Math.random() * 1 + 's';

        document.body.appendChild(conf);

        // Nach Ablauf der Animation das Element aus dem HTML löschen
        conf.addEventListener('animationend', () => conf.remove());
    }
}

/**
 * Hat der Nutzer im Betriebssystem "Bewegung reduzieren" eingestellt? Dann gibt es weder Konfetti noch Regen
 */
function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Lässt es beim Verlierer regnen
 */
export function fireRain() {
    if (prefersReducedMotion()) return;

    // 120 Tropfen, die in den ersten 2,5 Sekunden nach und nach starten
    for (let i = 0; i < 120; i++) {
        const drop = document.createElement('div');
        drop.className = 'rain-drop';

        // Zufällige Position, Fallgeschwindigkeit und Verzögerung (Regen fällt schneller als Konfetti)
        drop.style.left = Math.random() * 100 + 'vw';
        drop.style.animationDuration = Math.random() * 0.5 + 0.7 + 's';
        drop.style.animationDelay = Math.random() * 2.5 + 's';

        document.body.appendChild(drop);

        // Nach Ablauf der Animation das Element aus dem HTML löschen
        drop.addEventListener('animationend', () => drop.remove());
    }
}

/**
 * Zeigt eine Bestätigungs-Box im Spielfenster (statt des Browser-Popups confirm())
 * Liefert ein Promise: true = bestätigt, false = abgelehnt
 */
export function showConfirm(title, text, confirmLabel, cancelLabel) {
    const dialog = document.getElementById('confirmDialog');

    // Inhalte der Box setzen
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmText').textContent = text;
    document.getElementById('confirmYes').textContent = confirmLabel;
    // Ohne cancelLabel wird nur ein Button angezeigt (reine Hinweisbox)
    const noBtn = document.getElementById('confirmNo');
    noBtn.textContent = cancelLabel || '';
    noBtn.hidden = !cancelLabel;

    dialog.returnValue = ''; // Ergebnis vom letzten Mal zurücksetzen
    dialog.showModal(); // Öffnet die Box, der Rest der Seite ist solange gesperrt

    // Warten, bis die Box geschlossen wird
    return new Promise((resolve) => {
        dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
    });
}

/**
 * Eigene Verbindung zum Server ist abgebrochen (z.B. WLAN weg oder Server beendet).
 * Eine Online-Partie lässt sich danach nicht fortsetzen: Spiel beenden und zurück zur Lobby
 */
socket.on('disconnect', () => {
    if (state.gameMode !== 'online') return; // Partien gegen den Computer brauchen keinen Server

    // Auf Modus-, Namens- und Setup-Bildschirm läuft nichts, was beendet werden müsste
    const activeScreen = document.querySelector('.screen.active').id;
    if (['modeScreen', 'loginScreen', 'setupScreen'].includes(activeScreen)) return;

    // Alles stoppen, was im Hintergrund weiterläuft
    stopGame();
    clearTimeout(partyTimeout);
    clearTimeout(coinTossTimeout);
    clearInterval(countdownInterval);

    leaveToLobby();
    showConfirm('Verbindung verloren', 'Die Verbindung zum Server ist abgebrochen. Die Partie wurde beendet.', 'OK');
});
