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
    renderQueueStatus,
} from './ui.js';
import { abortGame, moveReview } from './game.js';
import { toggleSound } from './sound.js';
import { loadTheme, openThemeDialog, handleThemeInput, handleThemeDialogClose } from './theme.js';
import { loadColorMode, toggleColorMode } from './colorMode.js';
import {
    openTutorial,
    openTutorialOnFirstVisit,
    startInternationalLessons,
    handleTutorialClick,
    handleTutorialClose,
    nextLesson,
    restartLesson,
} from './tutorial.js';

/**
 * Kurzform: Klick-Handler für das Element mit der angegebenen ID registieren
 */
function onClick(id, handler) {
    document.getElementById(id).addEventListener('click', handler);
}

// Kopfzeile
onClick('helpBtn', () => document.getElementById('helpDialog').showModal());
onClick('soundBtn', toggleSound);
onClick('themeBtn', openThemeDialog);
onClick('colorModeBtn', toggleColorMode);
loadTheme();
loadColorMode();

// Fenster für die Farben
document.getElementById('themeForm').addEventListener('input', handleThemeInput);
document.getElementById('themeDialog').addEventListener('close', handleThemeDialogClose);

// Tutorial: beim ersten Besuch automatisch, sonst über die Startseite oder das Hilfe-Fenster
document.getElementById('tutorialBoard').addEventListener('click', handleTutorialClick);
document.getElementById('tutorialDialog').addEventListener('close', handleTutorialClose);
onClick('tutorialNextBtn', nextLesson);
onClick('tutorialRetryBtn', restartLesson);
onClick('tutorialInternationalBtn', startInternationalLessons);
onClick('tutorialBtn', openTutorial);
onClick('helpTutorialBtn', () => {
    document.getElementById('helpDialog').close();
    openTutorial();
});
openTutorialOnFirstVisit();

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

// Spiel einrichten (Variante und Bedenkzeit)
document.getElementById('setupForm').addEventListener('submit', (event) => {
    event.preventDefault();
    startSearch();
});
document.getElementById('setupForm').addEventListener('change', renderQueueStatus); // Andere Variante gewählt
onClick('setupBackBtn', () => showScreen('loginScreen'));

// Wartebildschirm
onClick('cancelWaitBtn', cancelWait);

// Spielbildschirm
document.getElementById('chatForm').addEventListener('submit', handleChatSubmit);
onClick('abortBtn', abortGame);

// Endbildschirm
onClick('replayBtn', requestReplay);
onClick('lobbyBtn', leaveToLobby);
onClick('reviewStartBtn', () => moveReview('start'));
onClick('reviewPrevBtn', () => moveReview('prev'));
onClick('reviewNextBtn', () => moveReview('next'));
onClick('reviewEndBtn', () => moveReview('end'));
