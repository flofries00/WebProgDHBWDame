// Einstiegspunkt der Anwendung: verbindet die Bedienelemente im HTML mit den Funktionen der Module
import {
    selectMode,
    showScreen,
    checkInput,
    showSetup,
    startSearch,
    cancelWait,
    requestReplay,
    leaveToLobby,
    handleChatSubmit,
} from './ui.js';
import { abortGame } from './game.js';
import { toggleSound } from './sound.js';
import { loadTheme, openThemeDialog, handleThemeChange, handleThemeDialogClose } from './theme.js';

/**
 * Kurzform: Klick-Handler für das Element mit der angegebenen ID registieren
 */
function onClick(id, handler) {
    document.getElementById(id).addEventListener('click', handler);
}

// Kopfzeile
onClick('soundBtn', toggleSound);
onClick('themeBtn', openThemeDialog);
loadTheme();

// Fenster für die Farben
document.getElementById('themeForm').addEventListener('change', handleThemeChange);
document.getElementById('themeDialog').addEventListener('close', handleThemeDialogClose);

// Modus-Auswahl
onClick('modeComputerBtn', () => selectMode('computer'));
onClick('modeOnlineBtn', () => selectMode('online'));

// Namensbildschirm
document.getElementById('playerName').addEventListener('input', checkInput);
document.getElementById('loginForm').addEventListener('submit', (event) => {
    event.preventDefault();
    showSetup();
});
onClick('loginBackBtn', () => showScreen('modeScreen'));

// Spiel einrichten (Bedenkzeit)
document.getElementById('setupForm').addEventListener('submit', (event) => {
    event.preventDefault();
    startSearch();
});
onClick('setupBackBtn', () => showScreen('loginScreen'));

// Wartebildschirm
onClick('cancelWaitBtn', cancelWait);

// Spielbildschirm
document.getElementById('chatForm').addEventListener('submit', handleChatSubmit);
onClick('abortBtn', abortGame);

// Endbildschirm
onClick('replayBtn', requestReplay);
onClick('lobbyBtn', leaveToLobby);
