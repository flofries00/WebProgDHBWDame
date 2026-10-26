// Remis anbieten (nur online): Angebot an den Gegner schicken und auf ein Angebot antworten.
// Ob ein Remis zählt, entscheidet der Server (Cheating-Schutz [10]), der Browser zeigt nur an
import { state } from './state.js';
import { socket } from './socket.js';
import { t, setText } from './i18n.js';
import { showConfirm } from './ui.js';
import { endGame } from './game.js';
import { addSystemMessage } from './chat.js';

const MAX_DRAW_OFFERS = 3; // Wie auf dem Server: so oft darf man pro Partie Remis anbieten
let offersLeft = MAX_DRAW_OFFERS;

/**
 * Läuft gerade eine Partie? (Antworten des Servers können auch nach dem Spielende noch ankommen)
 */
const isPlaying = () => document.getElementById('gameScreen').classList.contains('active');

/**
 * Setzt den Button "Remis anbieten" zurück (nach einer Ablehnung oder bei einer neuen Partie)
 */
function updateDrawButton() {
    const btn = document.getElementById('drawBtn');
    btn.disabled = offersLeft === 0;
    setText(btn, offersLeft === 0 ? 'game.noDrawOffers' : 'game.offerDraw');
}

/**
 * Neue Partie: Button nur online zeigen, wieder alle Angebote frei
 */
export function resetDrawOffer() {
    offersLeft = MAX_DRAW_OFFERS;
    document.getElementById('drawBtn').hidden = state.gameMode !== 'online';
    updateDrawButton();
}

/**
 * Button "Remis anbieten": Angebot an den Server, bis zur Antwort ist der Button gesperrt
 */
export function offerDraw() {
    if (offersLeft === 0) return;
    offersLeft--;
    const btn = document.getElementById('drawBtn');
    btn.disabled = true;
    setText(btn, 'game.drawOffered');
    socket.emit('offerDraw');
}

// Der Gegner bietet Remis an: annehmen oder ablehnen (die Partie läuft solange weiter)
socket.on('drawOffered', async () => {
    if (!isPlaying()) return;
    const accept = await showConfirm(
        t('draw.title'),
        t('draw.text', { name: state.opponentName }),
        t('draw.accept'),
        t('draw.decline')
    );
    if (isPlaying()) socket.emit('answerDraw', accept);
});

// Beide sind einverstanden: Die Partie endet unentschieden
socket.on('drawAgreed', () => {
    if (isPlaying()) endGame(null, 'drawAgreed');
});

// Der Gegner hat abgelehnt: Hinweis im Chat, der Button ist wieder frei (solange Angebote übrig sind)
socket.on('drawDeclined', () => {
    if (!isPlaying()) return;
    updateDrawButton();
    addSystemMessage('draw.declined', { name: state.opponentName });
});
