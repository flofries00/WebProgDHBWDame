// Private Räume: Raum erstellen lassen, Code oder Link teilen, Vorschau vor dem Beitreten (Server: createRoom, checkRoom, joinRoom)
import { state } from './state.js';
import { socket } from './socket.js';
import { t, setText } from './i18n.js';
import { VARIANTS } from './rules.js';
import { renderBoardPicture, createTimeIcon } from './pictures.js';
import { selectMode, showConfirm } from './ui.js';

let pendingRoomCode = null; // Raumcode aus einem geteilten Link (?raum=K7QXM), wird nach der Namenseingabe eingetragen

/**
 * Beim Wechsel zu "Spiel einrichten": Private Räume gibt es nur online. Kam man über einen Link, ist der Code schon
 * eingetragen
 */
export function prepareRoomSection() {
    const privateRoom = document.getElementById('privateRoom');
    privateRoom.hidden = state.gameMode !== 'online';
    setText(document.getElementById('roomError'));
    if (pendingRoomCode && state.gameMode === 'online') {
        document.getElementById('roomCodeInput').value = pendingRoomCode;
        privateRoom.open = true;
        pendingRoomCode = null;
    }
}

/**
 * Privates Spiel: einem Raum mit dem eingegebenen Code beitreten. Variante und Bedenkzeit kommen vom Ersteller
 */
export function joinRoom() {
    const code = document.getElementById('roomCodeInput').value.trim();
    const error = document.getElementById('roomError');
    if (code.length !== 5) {
        setText(error, 'room.error.empty');
        return;
    }
    if (!socket.connected) {
        showConfirm(t('error.noConnectionTitle'), t('error.noConnectionText'), t('common.ok'));
        return;
    }
    setText(error);
    socket.emit('checkRoom', code); // Erst nachsehen, wessen Raum es ist. Antwort: roomPreview oder roomError
}

// Vorschau des Raums: Wer hat ihn erstellt, was wird gespielt? Erst nach "Raum beitreten" geht es los
socket.on('roomPreview', (preview) => {
    if (!document.getElementById('setupScreen').classList.contains('active')) return;
    if (!Object.hasOwn(VARIANTS, preview.variant) || typeof preview.hostName !== 'string') return;
    if (!['1', '3', '5', '10', 'party'].includes(preview.timeSetting)) return;

    // Titel "Raum von [Hostname]" mit fettem Namen. Die Wörter um {name} kommen aus der Übersetzung
    // so stimmt die Wortstellung in jeder Sprache. Der Name bleibt reiner Text
    const name = document.createElement('strong');
    name.textContent = preview.hostName;
    const [before, after] = t('room.previewTitle').split('{name}');
    document.getElementById('roomPreviewTitle').replaceChildren(before, name, after);

    // Variante als kleines Brett, Bedenkzeit als Uhr bzw. Partyhut (pictures.js)
    renderBoardPicture(document.getElementById('roomPreviewBoard'), preview.variant);
    setText(
        document.getElementById('roomPreviewVariant'),
        preview.variant === 'klassisch' ? 'setup.classic' : 'setup.international'
    );

    document.getElementById('roomPreviewTimeIcon').replaceChildren(createTimeIcon(preview.timeSetting));
    const party = preview.timeSetting === 'party';
    setText(document.getElementById('roomPreviewTime'), party ? 'setup.party' : `setup.minutes${preview.timeSetting}`);

    // Fenster öffnen, erst bei "Raum beitreten" geht es los
    const dialog = document.getElementById('roomPreviewDialog');
    dialog.returnValue = '';
    dialog.showModal();
    dialog.addEventListener(
        'close',
        () => {
            if (dialog.returnValue !== 'join') return;
            document.getElementById('p1Name').textContent = state.currentPlayerName;
            socket.emit('joinRoom', state.currentPlayerName, preview.code); // Antwort: matchFound oder roomError
        },
        { once: true }
    );
});

/**
 * Kopiert den Link zum eigenen Raum. Ohne Zugriff auf die Zwischenablage (z.B. ohne HTTPS) steht der Link da
 */
export async function copyRoomLink() {
    const code = document.getElementById('roomCode').textContent;
    const url = `${location.origin}${location.pathname}?raum=${code}`;
    const status = document.getElementById('copyStatus');
    try {
        await navigator.clipboard.writeText(url);
        setText(status, 'room.copied');
    } catch {
        setText(status, 'room.copyFailed', { url });
    }
}

/**
 * Beim Start: Wurde die Seite über einen geteilten Link geöffnet (?raum=K7QXM), geht es direkt zu "Gegen Mensch".
 * Der Code wird nach der Namenseingabe eingetragen
 */
export function openRoomLink() {
    const code = new URLSearchParams(location.search).get('raum');
    if (!code || !/^[A-Za-z0-9]{5}$/.test(code)) return;
    pendingRoomCode = code.toUpperCase();
    history.replaceState(null, '', location.pathname); // Beim Neuladen nicht erneut beitreten
    selectMode('online');
}

// Der Server hat den privaten Raum erstellt: Code anzeigen
socket.on('roomCreated', ({ code }) => {
    if (!document.getElementById('waitingScreen').classList.contains('active')) return;
    document.getElementById('roomCode').textContent = code;
    setText(document.getElementById('copyStatus'));
    document.getElementById('roomInfo').hidden = false;
});

// Beitreten hat nicht geklappt (Code unbekannt, eigener Raum oder zu viele Versuche)
socket.on('roomError', ({ reason }) => {
    if (!['notFound', 'ownRoom', 'tooFast'].includes(reason)) return;
    setText(document.getElementById('roomError'), `room.error.${reason}`);
});
