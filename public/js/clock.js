// Bedenkzeit im Browser: zählt die Restzeit beider Spieler herunter und zeigt sie an (Digitaluhr und Zeitbalken).
// Online entscheidet der Server (Cheating-Schutz [8]): Er schickt nach jedem Zug seinen Stand und meldet das Ende
import { state } from './state.js';
import { socket } from './socket.js';
import { endGame } from './game.js';

let startTime = 300; // Bedenkzeit pro Spieler in Sekunden (wird bei Spielstart aus der Einstellung gesetzt)
let whiteTime = startTime; // Restzeit Weiß in Sekunden
let blackTime = startTime; // Restzeit Schwarz in Sekunden
let timerInterval = null;
let activeColor = 'white'; // Wessen Uhr gerade läuft

/**
 * Neue Partie: beide Uhren auf die Bedenkzeit stellen, die Uhr von Weiß läuft (Weiß beginnt)
 */
export function startClock() {
    startTime = state.timeMinutes * 60;
    whiteTime = startTime;
    blackTime = startTime;
    activeColor = 'white';
    updateTimerDisplays();
    startTurnTimer();
}

/**
 * Spielerwechsel: Ab jetzt läuft die Uhr dieser Farbe, sie wird hervorgehoben
 * @param {'white' | 'black'} color - Farbe am Zug
 */
export function switchClock(color) {
    activeColor = color;
    updateActiveTimerStyle();
}

/**
 * Hält die Uhr an (Spielende, Aufgeben, Verbindungsabbruch)
 */
export function stopClock() {
    clearInterval(timerInterval);
}

/**
 * Startet das Sekundenticken der Uhr
 */
function startTurnTimer() {
    clearInterval(timerInterval);
    updateActiveTimerStyle();

    timerInterval = setInterval(() => {
        if (activeColor === 'white') {
            whiteTime--;
            if (whiteTime <= 0) {
                whiteTime = 0;
                timeExpired('black');
                return;
            }
        } else {
            blackTime--;
            if (blackTime <= 0) {
                blackTime = 0;
                timeExpired('white');
                return;
            }
        }
        updateTimerDisplays();
    }, 1000);
}

/**
 * Die Anzeige steht bei 0:00. Gegen den Computer ist das Spiel damit vorbei.
 * Online entscheidet der Server (Cheating-Schutz [8]): Die Anzeige wartet bei 0:00 auf seine Meldung "timeUp"
 * @param {'white' | 'black'} winner - Gewinner, falls das Spiel hier endet
 */
function timeExpired(winner) {
    updateTimerDisplays();
    if (state.gameMode === 'online') {
        clearInterval(timerInterval);
        return;
    }
    endGame(winner, 'timeout');
}

/**
 * Zeigt die Restzeiten an: Digitaluhr (MM:SS), Zeitbalken und Warnung ab 30 Sekunden
 */
function updateTimerDisplays() {
    const format = (sec) => {
        const m = Math.floor(sec / 60)
            .toString()
            .padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const p1El = document.getElementById('p1Timer');
    const compEl = document.getElementById('compTimer');
    const p1Bar = document.getElementById('p1TimerBar');
    const compBar = document.getElementById('compTimerBar');

    const p1Time = state.playerGetsWhite ? whiteTime : blackTime;
    const compTime = state.playerGetsWhite ? blackTime : whiteTime;

    // a) Digitaluhren aktualisieren
    p1El.textContent = format(p1Time);
    compEl.textContent = format(compTime);

    // b) Füllstand der Zeitbalken als Anteil von 0 bis 1 (Basis: Startzeit), die Richtung regelt das CSS
    p1Bar.style.setProperty('--time-left', p1Time / startTime);
    compBar.style.setProperty('--time-left', compTime / startTime);

    // Warn-Blinken ab 30s aktivieren und für neues Spiel wieder entfernen
    if (p1Time <= 30) {
        p1El.classList.add('low-time');
        p1Bar.classList.add('low-time');
    } else {
        p1El.classList.remove('low-time');
        p1Bar.classList.remove('low-time');
    }
    if (compTime <= 30) {
        compEl.classList.add('low-time');
        compBar.classList.add('low-time');
    } else {
        compEl.classList.remove('low-time');
        compBar.classList.remove('low-time');
    }
}

/**
 * Hebt die Uhr des Spielers hervor, der am Zug ist
 */
function updateActiveTimerStyle() {
    const p1El = document.getElementById('p1Timer');
    const compEl = document.getElementById('compTimer');

    const isP1Turn = (activeColor === 'white') === state.playerGetsWhite;

    if (isP1Turn) {
        p1El.classList.add('active-timer');
        compEl.classList.remove('active-timer');
    } else {
        compEl.classList.add('active-timer');
        p1El.classList.remove('active-timer');
    }
}

/**
 * Läuft gerade eine Partie? (Nachrichten des Servers zur Uhr können auch nach dem Spielende noch ankommen)
 */
const isPlaying = () => document.getElementById('gameScreen').classList.contains('active');

// Cheating-Schutz [8]: Nach jedem Zug schickt der Server den Stand seiner Uhr (in ms), die Anzeige
// übernimmt ihn. Die Uhr läuft danach weiter, auch wenn sie vorher bei 0:00 gewartet hat
socket.on('clockSync', (clock) => {
    if (!isPlaying() || !Number.isFinite(clock?.white) || !Number.isFinite(clock?.black)) return;
    whiteTime = Math.max(Math.ceil(clock.white / 1000), 0);
    blackTime = Math.max(Math.ceil(clock.black / 1000), 0);
    updateTimerDisplays();
    startTurnTimer();
});

// Cheating-Schutz [8]: Der Server meldet, dass die Zeit abgelaufen ist, und wer gewonnen hat
socket.on('timeUp', ({ winner }) => {
    if (!isPlaying()) return;
    endGame(winner === 'white' ? 'white' : 'black', 'timeout');
});
