// Einstiegspunkt der Anwendung: verbindet die Bedienelemente im HTML mit den Funktionen der Module
import {
  selectMode,
  showScreen,
  checkInput,
  handleEnter,
  startSearch,
  cancelWait,
  requestReplay,
  leaveToLobby,
  handleChatEnter,
} from './ui.js';
import { abortGame } from './game.js';
import { toggleSound } from './sound.js';

/**
 * Kurzform: Klick-Handler für das Element mit der angegebenen ID registieren
 */
function onClick(id, handler) {
  document.getElementById(id).addEventListener('click', handler);
}

// Kopfzeile
onClick('soundBtn', toggleSound);

// Modus-Auswahl
onClick('modeComputerBtn', () => selectMode('computer'));
onClick('modeOnlineBtn', () => selectMode('online'));

// Namensbildschirm
const nameInput = document.getElementById('playerName');
nameInput.addEventListener('input', checkInput);
nameInput.addEventListener('keydown', handleEnter);
onClick('loginBackBtn', () => showScreen('modeScreen'));
onClick('searchBtn', startSearch);

// Wartebildschirm
onClick('cancelWaitBtn', cancelWait);

// Spielbildschirm
document.getElementById('chatInput').addEventListener('keydown', handleChatEnter);
onClick('abortBtn', abortGame);

// Endbildschirm
onClick('replayBtn', requestReplay);
onClick('lobbyBtn', leaveToLobby);
