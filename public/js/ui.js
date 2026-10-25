import { state } from './state.js';
import { socket } from './socket.js';
import { startGame, endGame, stopGame } from './game.js';
import { playSound } from './sound.js';
import { t, setText } from './i18n.js';
import { VARIANTS, introSeconds } from './rules.js';
import { prepareRoomSection } from './rooms.js';

// Globale Variablen für den Spielablauf

let searchTimeout; // Timer für Gegnersuche
let coinTossTimeout; // Timer bis zur Landung der Münze
let countdownTimeout; // Nächster Schritt des Countdowns bis Spielstart
let partyTimeout; // Nächster Schritt der Zeit-Auslosung im Partymodus
let waitInterval; // Sekundentakt der Wartezeit-Anzeige
let queueStatus = null; // Letzter Stand der Warteschlangen vom Server: { waiting: { klassisch: { '1': 0, ...}, ...}, online }

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
    // Die Wartezeit läuft nur, solange der Wartebildschirm zu sehen ist (egal, wie man ihn verlässt)
    if (screenId !== 'waitingScreen') clearInterval(waitInterval);
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
        setText(errorText); // Ohne Eingabe keine Fehlermeldung
        inputField.classList.remove('invalid');
        return; // Button bleibt gesperrt
    }

    // Fall 2: Es wurden verbotene Zeichen eingegeben (Sonderzeichen, Leerzeichen, Emojis usw.)
    if (!isValidChars) {
        setText(errorText, 'login.errorChars');
        inputField.classList.add('invalid');
        return; // Button bleibt gesperrt
    }

    // Fall 3: Der Name ist zu kurz
    else if (nameInput.length < 2) {
        setText(errorText, 'login.errorShort');
        inputField.classList.add('invalid');
        return; // Button bleibt gesperrt
    }

    // Fall 4: Der Name ist gültig
    setText(errorText); // Fehlertext löschen
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
    setText(
        document.getElementById('setupStartBtn'),
        state.gameMode === 'online' ? 'setup.findOpponent' : 'setup.startGame'
    );
    renderQueueStatus();

    prepareRoomSection(); // Bereich für private Räume (rooms.js)
    showScreen('setupScreen');
}

/**
 * Zeigt im Setup-Bildschirm, bei welcher Bedenkzeit (in der gewählten Variante) schon jemand wartet und wie viele Spieler online sind.
 * Gegen den Computer bleibt alles leer.
 */
export function renderQueueStatus() {
    const isOnline = state.gameMode === 'online' && queueStatus;
    const variant = document.querySelector('input[name="variant"]:checked').value;

    document.querySelectorAll('input[name="timeSetting"]').forEach((input) => {
        const badge = input.parentElement.querySelector('.queue-badge');
        setText(badge, isOnline && queueStatus.waiting[variant][input.value] > 0 ? 'setup.waitingBadge' : null);
    });

    const onlineCount = document.getElementById('onlineCount');
    if (isOnline)
        setText(onlineCount, queueStatus.online === 1 ? 'setup.onlineOne' : 'setup.online', {
            count: queueStatus.online,
        });
    else setText(onlineCount);
}

// Der Server meldet jede Änderung an den Warteschlangen, die Anzeige aktualisiert sich sofort
socket.on('queueStatus', (status) => {
    queueStatus = status;
    renderQueueStatus();
});

/**
 * Wird aufgerufen, wenn man auf "Gegner suchen" bzw. "Spiel starten" klickt.
 * Wechselt in den Wartebildschirm. Mit mode 'room' wird statt der Suche ein privater Raum erstellt
 */
export function startSearch(mode = 'search') {
    // Schutz vor Doppelauslösung: nur suchen, wenn der Setup-Bildschirm wirklich angezeigt wird
    if (!document.getElementById('setupScreen').classList.contains('active')) return;

    // Ohne Serververbindung ist keine Online-Partie möglich
    if (state.gameMode === 'online' && !socket.connected) {
        showConfirm(t('error.noConnectionTitle'), t('error.noConnectionText'), t('common.ok'));
        return;
    }

    // Gewählte Variante und Bedenkzeit merken und im Wartebildschirm anzeigen
    state.variant = document.querySelector('input[name="variant"]:checked').value;
    state.timeSetting = document.querySelector('input[name="timeSetting"]:checked').value;
    const variant = { key: `variant.${state.variant}` }; // Name der Variante wird mit übersetzt
    const waitTimeText = document.getElementById('waitTimeText');
    if (state.timeSetting === 'party') setText(waitTimeText, 'wait.settingsParty', { variant });
    else setText(waitTimeText, 'wait.settings', { variant, minutes: state.timeSetting });

    // Namen in die HTML-Platzhalter der anderen Bildschirme eintragen
    document.getElementById('waitName').textContent = state.currentPlayerName;
    document.getElementById('p1Name').textContent = state.currentPlayerName;

    // Wechsel zum Wartebildschirm (Code und Link erscheinen erst, wenn der Server den Raum erstellt hat)
    document.getElementById('roomInfo').hidden = true;
    showScreen('waitingScreen');

    startWaitClock();

    if (state.gameMode === 'online' && mode === 'room') {
        // Privates Spiel: Der Server erstellt einen Raum und schickt den Code (roomCreated)
        socket.emit('createRoom', state.currentPlayerName, state.timeSetting, state.variant);
    } else if (state.gameMode === 'online') {
        // Echter Multiplayer: Server um Match mit gleicher Variante und Bedenkzeit bitten
        socket.emit('findMatch', state.currentPlayerName, state.timeSetting, state.variant);
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
 * Zeigt, wie lange man schon wartet (z.B. "0:42"). Die Zeit wird aus dem Startzeitpunkt berechnet, so stimmt sie auch, wenn der Browser den Takt in einem Hintergrundtab verlangsamt
 */
function startWaitClock() {
    const clock = document.getElementById('waitClock');
    const start = Date.now();
    const update = () => {
        const seconds = Math.floor((Date.now() - start) / 1000);
        clock.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    };
    clearInterval(waitInterval);
    update();
    waitInterval = setInterval(update, 1000);
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
    // Startzeitpunkt fest vorgeben: Der Server startet die Uhr nach derselben Zeit (introSeconds in rules.js)
    state.gameStartsAt = Date.now() + introSeconds(state.timeSetting) * 1000;
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
    setText(textEl);

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
        setText(textEl, minutes === 1 ? 'party.resultOne' : 'party.result', { minutes });
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
function simulateCoinToss() {
    // Evtl. noch laufende Timer einer vorherigen Auslosung stoppen
    clearTimeout(coinTossTimeout);
    clearTimeout(countdownTimeout);

    // Text der letzten Runde zurücksetzen
    setText(document.getElementById('startPlayerText'), 'coin.drawing');
    setText(document.getElementById('countdownText'));

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
        setText(document.getElementById('startPlayerText'), state.playerGetsWhite ? 'coin.white' : 'coin.black');
        const countdownEl = document.getElementById('countdownText');

        // Countdown bis zum festen Startzeitpunkt. Er zählt die restlichen Sekunden und nicht einfach von 5 herunter.
        // So beginnt die Partie genau dann, wenn der Server die Uhr startet
        const tick = () => {
            const msLeft = state.gameStartsAt - Date.now();
            if (msLeft <= 0) {
                startGame(); // Ins Spiel wechseln
                return;
            }
            const seconds = Math.ceil(msLeft / 1000);
            setText(countdownEl, seconds === 1 ? 'coin.countdownOne' : 'coin.countdown', { seconds });
            countdownTimeout = setTimeout(tick, msLeft - (seconds - 1) * 1000); // Bis zur nächsten vollen Sekunde
        };
        tick();
    }, 2000);
}

/**
 * Beantragt eine Revanche beim Server
 */
export function requestReplay() {
    if (state.gameMode === 'online') {
        const btn = document.getElementById('replayBtn');
        btn.disabled = true;
        setText(btn, 'wait.searching');
        socket.emit('requestReplay');
    } else {
        // Gegen Computer startet das Spiel sofort wieder, Farbe (und im Partymodus die Zeit) wird neu ausgelost
        startComputerMatch();
    }
}

/**
 * Setzt Revanche-Button und -Hinweis für die nächste Partie zurück
 */
function resetReplay() {
    const btn = document.getElementById('replayBtn');
    btn.disabled = false;
    setText(btn, 'end.replay');
    setText(document.getElementById('replayStatus'));
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

    resetReplay();
    showScreen('modeScreen');
}

// Der Server hat einen Gegner gefunden (auch bei einer Revanche)
socket.on('matchFound', (data) => {
    state.opponentName = data.oppName;
    state.playerGetsWhite = data.isWhite;
    state.timeMinutes = data.timeMinutes;

    // Variante und Bedenkzeit vom Server übernehmen (im privaten Raum hat sie der Ersteller gewählt)
    if (Object.hasOwn(VARIANTS, data.variant)) state.variant = data.variant;
    if (['1', '3', '5', '10', 'party'].includes(data.timeSetting)) state.timeSetting = data.timeSetting;

    // Namen in HTML eintragen
    const oppDisp = document.getElementById('opponentNameDisplay');
    const oppHead = document.getElementById('opponentNameHeader');

    oppDisp.textContent = state.opponentName;
    oppHead.textContent = state.opponentName;

    // Revanche-Anzeige für die nächste Runde zurücksetzen
    resetReplay();

    // Animation starten (im Partymodus zuerst die Auslosung der Zeit)
    beginMatchIntro();
});

/**
 * Aktualisiert die Uhrzeit in der Kopfzeile
 */
function updateRealTimeClock() {
    const clockEl = document.getElementById('realTimeClock');

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

// Socket-Ereignisse für die Revanche
socket.on('opponentWantsReplay', () => {
    setText(document.getElementById('replayStatus'), 'end.opponentWantsReplay', { name: state.opponentName });
});

socket.on('opponentLeft', () => {
    const status = document.getElementById('replayStatus');
    const btn = document.getElementById('replayBtn');

    // Gegner verlässt während der Auslosung oder des Münzwurfs -> Start abbrechen, zurück zur Lobby
    if (document.getElementById('partyScreen').classList.contains('active')) {
        clearTimeout(partyTimeout);
        setText(document.getElementById('partyTimeText'), 'end.opponentLeft', { name: state.opponentName });
        setTimeout(leaveToLobby, 3000);
        return;
    }
    if (document.getElementById('coinTossScreen').classList.contains('active')) {
        clearTimeout(coinTossTimeout);
        clearTimeout(countdownTimeout);
        setText(document.getElementById('startPlayerText'), 'end.opponentLeft', { name: state.opponentName });
        setText(document.getElementById('countdownText'));
        setTimeout(leaveToLobby, 3000);
        return;
    }

    // Gegner verlässt laufendes Spiel -> man gewinnt automatisch
    if (document.getElementById('gameScreen').classList.contains('active')) {
        endGame(state.playerGetsWhite ? 'white' : 'black', 'opponentLeft');
    }

    setText(status, 'end.opponentLeft', { name: state.opponentName });
    btn.disabled = true;
    setText(btn, 'end.opponentGone');
});

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
    clearTimeout(countdownTimeout);

    leaveToLobby();
    showConfirm(t('error.disconnectedTitle'), t('error.disconnectedText'), t('common.ok'));
});
