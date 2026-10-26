// Chat einer Online-Partie: Nachrichten schreiben, senden und anzeigen (gegen den Computer ist er gesperrt)
import { state } from './state.js';
import { socket } from './socket.js';
import { t, setText } from './i18n.js';

/**
 * Leert den Chat zu Beginn einer Partie und sperrt ihn gegen den Computer
 */
export function resetChat(online) {
    const chatInput = document.getElementById('chatInput');
    chatInput.disabled = !online;
    // Schlüssel am Attribut merken, damit auch der Platzhalter beim Sprachwechsel übersetzt wird
    const placeholderKey = online ? 'game.chatPlaceholder' : 'game.chatDisabled';
    chatInput.setAttribute('data-i18n-placeholder', placeholderKey);
    chatInput.placeholder = t(placeholderKey);

    const systemMessage = document.createElement('p');
    systemMessage.className = 'sys-msg';
    setText(systemMessage, online ? 'game.chatReady' : 'game.chatOffline');
    document.querySelector('.chat-messages').replaceChildren(systemMessage);
}

/**
 * Hinweis im Chat ohne Absender (kursiv), z.B. "Anna hat das Remis abgelehnt."
 */
export function addSystemMessage(key, params) {
    const container = document.querySelector('.chat-messages');
    const message = document.createElement('p');
    message.className = 'sys-msg';
    setText(message, key, params);
    container.appendChild(message);
    container.scrollTop = container.scrollHeight;
}

/**
 * Verarbeitet Chat-Eingaben
 */
export function handleChatSubmit(event) {
    event.preventDefault(); // Formular nicht wirklich abschicken (sonst lädt die Seite neu)

    const input = document.getElementById('chatInput');
    const msg = input.value.trim();

    if (msg.length > 0) {
        // a) Nachricht lokal anzeigen
        addChatMessage(t('game.chatYou'), msg, true);

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
    // Cheating-Schutz [5]: textContent statt innerHTML, damit Nachrichten kein HTML/JS einschleusen können
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
