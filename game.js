// Globale Variablen für das Spielfeld
let currentTurn = 'white' // Weiß hat nach den bekannten Dame-Regeln immer den ersten Zug
let selectedPiece = null; // Speichert das HTML-Element des aktuell angeklickten Steins.
let moveCount = 0; // Zählt Züge mit
let whiteTime = 300; // Startzeit Weiß (5min / 300s)
let blackTime = 300; // Startzeit Schwarz (5min / 300s)
let timerInterval = null;

/**
 * Startet das eigentliche Brettspiel.
 */
function startGame() {

    // Spielstatus und Trophäen resetten
    currentTurn = 'white';
    moveCount = 0;
    document.getElementById('p1Captured').innerHTML = '';
    document.getElementById('compCaptured').innerHTML = '';

    // Startzeiten zurücksetzen und Anzeige aktualisieren
    whiteTime = 35;
    blackTime = 300;
    updateTimerDisplays();
    startTurnTimer();

    // Kopfzeile dynamisch anpassen, basierend auf Farbwahl-Zufallsevent
    document.getElementById('p1Color').textContent = playerGetsWhite ? "(Weiß)" : "(Schwarz)";
    document.getElementById('compColor').textContent = playerGetsWhite ? "(Schwarz)" : "(Weiß)";
    document.getElementById('turnIndicator').textContent = "Weiß ist am Zug";

    showScreen('gameScreen');
    generateBoard(); // Baut das HTML für das Spielbrett auf

    // Wir bringen nun dem gesamten Brett bei, auf Klicks auf markierte Felder zu achten
    document.getElementById('board').addEventListener('click', handleBoardClick);

    // Dokument überwachen, um Klicks ins Leere abzufangen
    document.addEventListener('click', handleGlobalClick);

    // Direkt bei Start prüfen, ob Felder hervorgehoben werden müssen
    autoHighlightCaptures();
}

/**
 * Generiert dynamisch das 8x8 Spielbrett und platziert die Steine.
 */
function generateBoard() {
    const boardElement = document.getElementById('board');
    boardElement.innerHTML = ''; // Brett komplett leeren, bevor es neu gebaut wird

    // Zwei ineinandergeschachtelte Schleifen für 8 Zeilen (row) und 8 Spalten (col)
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {

            // Ein neues div für die Kachel (Zelle) erstellen
            const cell = document.createElement('div');

            // Mathematischer Trick zur Schachbrettmuster-Berechnung:
            // Wenn Zeile + Spalte eine ungerade Zahl ergibt, ist das Feld dunkel.
            const isBlackCell = (row + col) % 2 !== 0;

            // Die entsprechenden CSS-Klassen vergeben
            cell.className = 'cell ' + (isBlackCell ? 'black-bg' : 'white-bg');

            // Die Koordinaten (Zeile/Spalte) als Daten-Attribute speichern (wichtig für spätere Spiel-Logik!)
            cell.dataset.row = row;
            cell.dataset.col = col;

            // Spielsteine dürfen nach den Dame-Regeln nur auf dunklen Feldern liegen
            if (isBlackCell) {
                // In den obersten 3 Reihen (Index 0, 1, 2) liegen die Steine des Gegners
                if (row < 3) {
                    const piece = document.createElement('div');
                    piece.className = playerGetsWhite ? 'piece black-piece' : 'piece white-piece';
                    piece.addEventListener('click', selectPiece); // Klick-Event hinzufügen
                    cell.appendChild(piece); // Stein in die Kachel legen
                }
                // In den untersten 3 Reihen (Index 5, 6, 7) liegen die eigenen Steine
                else if (row > 4) {
                    const piece = document.createElement('div');
                    piece.className = playerGetsWhite ? 'piece white-piece' : 'piece black-piece';
                    piece.addEventListener('click', selectPiece); // Klick-Event hinzufügen
                    cell.appendChild(piece); // Stein in die Kachel legen
                }
            }

            // Die fertige Kachel an das Spielbrett im HTML anhängen
            boardElement.appendChild(cell);
        }
    }
}

/**
 * Wird ausgelöst, wenn ein Spieler auf einen Spielstein klickt.
 */
function selectPiece(event) {
    const piece = event.target;

    // a) Prüfen: Gehört der Stein dem Spieler, der gerade am Zug ist?
    // Wenn Weiß am Zug ist, darf man keine schwarzen Steine anklicken und umgekehrt
    if (!piece.classList.contains(currentTurn + '-piece')) {
        return; // Funktion abbrechen
    }

    // a2) Schlagzwang prüfen
    // Brett scannen: Muss ein Stein schlagen?
    const allMyPieces = document.querySelectorAll(`.${currentTurn}-piece`);
    let mandatoryCaptureExists = false;
    allMyPieces.forEach(p => {
        if (canCapture(p)) mandatoryCaptureExists = true;
    });

    // Bei Schlagzwang, aber der ausgewählte Stein keinen Gegner schlagen kann
    if (mandatoryCaptureExists && !canCapture(piece)) {
        return;
    }

    // b) Vorherige Auswahl aufheben (falls man doch einen anderen Stein ziehen will)
    clearSelection();

    // c) Neuen Stein als "ausgewählt" markieren
    selectedPiece = piece;
    piece.classList.add('selected');

    // Konsolen-Ausgabe für Entwicklungstest
    const row = piece.parentElement.dataset.row;
    const col = piece.parentElement.dataset.col;
    console.log(`Stein ausgewählt auf Zeile ${row}, Spalte ${col}`);

    // Zeigt alle validen Züge an und teilt Schlagzwang mit
    showValidMoves(piece, mandatoryCaptureExists);


}

/**
 * Entfernt alle Markierungen (ausgewählte Steine und hervorgehobene Felder)
 */
function clearSelection() {
    if (selectedPiece) {
        selectedPiece.classList.remove('selected');
        selectedPiece = null;
    }

    // Entfernt die Hintergrundfarbe von allen eventuell markierten Zielfeldern
    document.querySelectorAll('.cell.highlighted, .cell.highlighted-capture').forEach(cell => {
        cell.classList.remove('highlighted', 'highlighted-capture');
        // Gespeicherte Sprung-Daten vom vorherigen Klick löschen
        delete cell.dataset.jumpR;
        delete cell.dataset.jumpC;
    });
}

/**
 * Berechnet die erlaubten diagonalen Züge für den ausgewählten Stein
 * Unterscheidet dabei zwischen normalen Steinen und Damen
 */
function showValidMoves(piece, mandatoryCaptureExists) {
    const currentCell = piece.parentElement;
    // Die als Text gespeicherten Attribute in echte Zahlen umwandeln:
    const row = parseInt(currentCell.dataset.row);
    const col = parseInt(currentCell.dataset.col);

    const isDame = piece.classList.contains('dame');

    // Check auf Gegner
    const opponentClass = piece.classList.contains('white-piece') ? 'black-piece' : 'white-piece';

    if (isDame) {
        // Damen-Logik: Darf beliebig weit in alle Richtungen ziehen
        const directions = [
            { dr: -1, dc: -1 }, // Oben Links
            { dr: -1, dc: 1 }, // Oben Rechts
            { dr: 1, dc: -1 }, // Unten Links
            { dr: 1, dc: 1 } // Unten Rechts
        ];

        directions.forEach(dir => {
            let r = row + dir.dr;
            let c = col + dir.dc;
            let foundOpponent = false;
            let oppR = -1;
            let oppC = -1;

            // Solange in die aktuelle Richtung schauen, wie wir auf dem Brett sind
            while (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                const targetCell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);

                if (targetCell) {
                    // Ist das Feld leer? Markieren und weitergehen
                    if (targetCell.children.length === 0) {
                        if (foundOpponent) {
                            targetCell.classList.add('highlighted-capture');
                            targetCell.dataset.jumpR = oppR;
                            targetCell.dataset.jumpC = oppC;
                        } else if (!mandatoryCaptureExists) {
                            targetCell.classList.add('highlighted');
                        }
                    } else {
                        if (!foundOpponent && targetCell.children[0].classList.contains(opponentClass)) {
                            foundOpponent = true;
                            oppR = r;
                            oppC = c;
                        } else { break; }
                    }
                }
                r += dir.dr;
                c += dir.dc;
            }
        });
    } else {
        // Logik für normale Steine (nur ein Feld in die eigene Laufrichtung)
        // Richtung beachten: Weiß zieht nach oben (-1), Schwarz zieht nach unten (+1)
        const direction = piece.classList.contains('white-piece') ? -1 : 1;

        // Beide mögliche diagonale Felder vor dem Stein
        const possibleMoves = [
            { r: row + direction, c: col - 1 },
            { r: row + direction, c: col + 1 }
        ];

        possibleMoves.forEach(move => {
            // Zuerst überprüfen, ob das Feld auf dem Brett überhaupt existiert
            if (move.r >= 0 && move.r <= 7 && move.c >= 0 && move.c <= 7) {
                // HTML-Element des Feldes suchen
                const targetCell = document.querySelector(`.cell[data-row="${move.r}"][data-col="${move.c}"]`);

                if (targetCell) {
                    // Fall 1: Feld ist direkt leer => Normaler Zug
                    if (targetCell.children.length === 0 && !mandatoryCaptureExists) {
                        targetCell.classList.add('highlighted'); // Zelle grün färben
                    }
                    // Fall 2: Auf dem Feld steht ein Stein. Prüfe auf Gegnerstein
                    else if (targetCell.children.length > 0 && targetCell.children[0].classList.contains(opponentClass)) {
                        // Schaue auf das Feld direkt hinter dem Gegner
                        const jumpR = move.r + direction;
                        const jumpDirC = move.c - col; // -1 (links) oder +1 (rechts)
                        const jumpC = move.c + jumpDirC;

                        // Ist Feld dahinter noch auf dem Brett?
                        if (jumpR >= 0 && jumpR <= 7 && jumpC >= 0 && jumpC <= 7) {
                            const jumpCell = document.querySelector(`.cell[data-row="${jumpR}"][data-col="${jumpC}"]`);

                            // Ist Feld dahinter leer?
                            if (jumpCell && jumpCell.children.length === 0) {
                                jumpCell.classList.add('highlighted-capture');
                                // Koordinaten speichern
                                jumpCell.dataset.jumpR = move.r;
                                jumpCell.dataset.jumpC = move.c;
                            }
                        }
                    }
                }
            }
        });
    }
}

/**
 * Verarbeitet Klicks auf dem Spielbrett und führt Zug aus, wenn ein
 * gültiges Feld angeklickt wurde
 */
function handleBoardClick(event) {
    // Überprüfen, ob Klick auf oder in einer der markierten Zellen landete
    const targetCell = event.target.closest('.cell.highlighted, .cell.highlighted-capture');

    // Abbruchbedingung, wenn keine markierte Zelle oder kein Stein ausgewählt wurde
    if (!targetCell || !selectedPiece) return;

    // Wurde ein Stein geschlagen?
    if (targetCell.dataset.jumpR !== undefined) {
        // "Opfer" suchen
        const victimCell = document.querySelector(`.cell[data-row="${targetCell.dataset.jumpR}"][data-col="${targetCell.dataset.jumpC}"]`);
        if (victimCell) {
            const victimIsWhite = victimCell.children[0].classList.contains('white-piece');
            victimCell.innerHTML = ''; // Gegnerstein löschen

            // Kleine Trophäe erzeugen und in Kopfzeile packen
            const trophy = document.createElement('div');
            trophy.className = 'captured-piece ' + (victimIsWhite ? 'white-piece' : 'black-piece');
            const targetContainer = (currentTurn === 'white' && playerGetsWhite) || (currentTurn === 'black' && !playerGetsWhite) ? 'p1Captured' : 'compCaptured';
            document.getElementById(targetContainer).appendChild(trophy);
        }
    }

    // 'appendChild' verschiebt das HTML-Element automatisch aus der alten Zelle in die neue
    targetCell.appendChild(selectedPiece);

    // Überprüfen ob Stein befördert werden muss:
    // a) Zeile auslesen
    const newRow = parseInt(targetCell.dataset.row);

    // b1) Weiß erreicht oberste Zeile (Index 0)
    if (selectedPiece.classList.contains('white-piece') && newRow === 0) {
        selectedPiece.classList.add('dame');
    }

    // b2) Schwarz erreicht unterste Zeile (Index 7)
    if (selectedPiece.classList.contains('black-piece') && newRow === 7) {
        selectedPiece.classList.add('dame');
    }

    // Markierungen aufheben
    clearSelection();

    // Zugzähler erhöhen
    moveCount++;

    // Spieler wechseln
    currentTurn = currentTurn === 'white' ? 'black' : 'white';

    // Überprüfen, ob Spiel entschieden ist
    if (checkWinCondition()) return;

    // Statusleiste aktualisieren
    const turnText = currentTurn === 'white' ? 'Weiß' : 'Schwarz';
    document.getElementById('turnIndicator').textContent = turnText + ' ist am Zug';

    // Nach dem Spielerwechsel ist zu prüfen, ob der neue Spieler im Schlagzwang ist
    autoHighlightCaptures();

    // Optischen Fokus der Uhr auf den neuen Spieler wechseln
    updateActiveTimerStyle();
}

/**
 * HILFSFUNKTION: Prüft heimlich (ohne Markierungen), ob ein Stein einen Gegner schlagen kann.
 * Wird für die Schlagzwang-Prüfung genutzt.
 */
function canCapture(piece) {
    const row = parseInt(piece.parentElement.dataset.row);
    const col = parseInt(piece.parentElement.dataset.col);
    const opponentClass = piece.classList.contains('white-piece') ? 'black-piece' : 'white-piece';
    const isDame = piece.classList.contains('dame');

    if (isDame) {
        const directions = [{ dr: -1, dc: -1 }, { dr: -1, dc: 1 }, { dr: 1, dc: -1 }, { dr: 1, dc: 1 }];
        for (let dir of directions) {
            let r = row + dir.dr; let c = col + dir.dc; let foundOpponent = false;
            while (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                const targetCell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
                if (targetCell) {
                    if (targetCell.children.length === 0) {
                        if (foundOpponent) return true; // Treffer!
                    } else {
                        if (!foundOpponent && targetCell.children[0].classList.contains(opponentClass)) foundOpponent = true;
                        else break;
                    }
                }
                r += dir.dr; c += dir.dc;
            }
        }
    } else {
        const direction = piece.classList.contains('white-piece') ? -1 : 1;
        const possibleMoves = [{ r: row + direction, c: col - 1 }, { r: row + direction, c: col + 1 }];
        for (let move of possibleMoves) {
            if (move.r >= 0 && move.r <= 7 && move.c >= 0 && move.c <= 7) {
                const targetCell = document.querySelector(`.cell[data-row="${move.r}"][data-col="${move.c}"]`);
                if (targetCell && targetCell.children.length > 0 && targetCell.children[0].classList.contains(opponentClass)) {
                    const jumpR = move.r + direction; const jumpC = move.c + (move.c - col);
                    if (jumpR >= 0 && jumpR <= 7 && jumpC >= 0 && jumpC <= 7) {
                        const jumpCell = document.querySelector(`.cell[data-row="${jumpR}"][data-col="${jumpC}"]`);
                        if (jumpCell && jumpCell.children.length === 0) return true; // Treffer!
                    }
                }
            }
        }
    }
    return false;
}

/**
 * Prüft das gesamte Brett und blendet rote Schlagfelder automatisch ein.
 */
function autoHighlightCaptures() {
    const allMyPieces = document.querySelectorAll(`.${currentTurn}-piece`);

    allMyPieces.forEach(piece => {
        if (canCapture(piece)) {
            // Zeichnet rote Felder sofort ein
            showValidMoves(piece, true);
        }
    });
}

/**
 * Hebt Auswahl auf, wenn Spieler irgendwo anders auf die Seite klickt.
 */
function handleGlobalClick(event) {
    // Wenn kein Stein ausgewählt ist, passiert nix
    if (!selectedPiece) return;

    // Geht Klick auf eigenen Stein, greift selectPiece()
    if (event.target.classList.contains(currentTurn + '-piece')) return;

    // Geht Klick auf ein gültiges Zielfeld greift handleBoardClick()
    if (event.target.closest('.cell.highlighted, .cell.highlighted-capture')) return;

    // In allen anderen Fällen
    clearSelection();

    // Falls Schlagzwang herrscht müssen alle roten Felder wieder auftauchen
    autoHighlightCaptures();
}

/**
 * Hilfsfunktion: Prüft ob sich überhaupt ein Stein bewegen kann (ohne Schlagen)
 */
function canMove(piece) {
    const row = parseInt(piece.parentElement.dataset.row);
    const col = parseInt(piece.parentElement.dataset.col);
    const isDame = piece.classList.contains('dame');

    if (isDame) {
        const directions = [
            { dr: -1, dc: -1 }, { dr: -1, dc: 1 },
            { dr: 1, dc: -1 }, { dr: 1, dc: 1 }
        ];
        for (let dir of directions) {
            let r = row + dir.dr;
            let c = col + dir.dc;
            if (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                const sel = `.cell[data-row="${r}"][data-col="${c}"]`;
                const cell = document.querySelector(sel);
                if (cell && cell.children.length === 0) return true;
            }
        }
    } else {
        const dir = piece.classList.contains('white-piece') ? -1 : 1;
        const moves = [
            { r: row + dir, c: col - 1 },
            { r: row + dir, c: col + 1 }
        ];
        for (let m of moves) {
            if (m.r >= 0 && m.r <= 7 && m.c >= 0 && m.c <= 7) {
                const sel = `.cell[data-row="${m.r}"][data-col="${m.c}"]`;
                const cell = document.querySelector(sel);
                if (cell && cell.children.length === 0) return true;
            }
        }
    }
    return false;
}

/**
 * Funktion, die am Zuganfang prüft, ob der aktuelle Spieler noch ziehen kann.
 */
function checkWinCondition() {
    const myPieces = document.querySelectorAll(`.${currentTurn}-piece`);

    // Siegbedingung 1: Keine Steine mehr übrig
    if (myPieces.length === 0) {
        endGame(currentTurn === 'white' ? 'black' : 'white');
        return true;
    }

    // Siegbedingung 2: Kein Zug mehr möglich
    let hasMove = false;
    myPieces.forEach(p => {
        if (canCapture(p) || canMove(p)) hasMove = true;
    });

    if (!hasMove) {
        endGame(currentTurn === 'white' ? 'black' : 'white');
        return true;
    }

    return false;
}

/**
 * Funktion, die das Spiel beendet und den Gewinner anzeigt.
 */
function endGame(winnerColor, reason = "") {
    // Uhr anhalten
    clearInterval(timerInterval);

    let winner = "";
    if (winnerColor === 'white') {
        winner = playerGetsWhite ? currentPlayerName : "Computer";
    } else {
        winner = playerGetsWhite ? "Computer" : currentPlayerName;
    }

    const textEl = document.getElementById('winnerText');
    if (reason === "timeout") {
        textEl.textContent = `Zeit abgelaufen! ${winner} gewinnt!`;
    } else {
        textEl.textContent = `${winner} hat gewonnen in ${moveCount} Zügen!`;
    }
    showScreen('endScreen');
}

/**
 * Startet das Sekundenticken der Uhr
 */
function startTurnTimer() {
    clearInterval(timerInterval);
    updateActiveTimerStyle();

    timerInterval = setInterval(() => {
        if (currentTurn === 'white') {
            whiteTime--;
            if (whiteTime <= 0) {
                whiteTime = 0;
                updateTimerDisplays();
                endGame('black', 'timeout');
                return;
            }
        } else {
            blackTime--;
            if (blackTime <= 0) {
                blackTime = 0;
                updateTimerDisplays;
                endGame('white', 'timeout');
                return;
            }
        }
        updateTimerDisplays();
    }, 1000);
}

/**
 * Formatiert Sekunden in MM:SS und schreibt sie ins HTML und prüft auf <= 30s
 */
function updateTimerDisplays() {
    const format = (sec) => {
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const p1El = document.getElementById('p1Timer');
    const compEl = document.getElementById('compTimer');
    const p1Bar = document.getElementById('p1TimerBar');
    const compBar = document.getElementById('compTimerBar');

    const p1Time = playerGetsWhite ? whiteTime : blackTime;
    const compTime = playerGetsWhite ? blackTime : whiteTime;

    // a) Digitaluhren aktualisieren
    p1El.textContent = format(p1Time);
    compEl.textContent = format(compTime);

    // b) Balkenbreite in Prozent berechnen (Basis: 300s)
    p1Bar.style.width = `${(p1Time / 300) * 100}%`;
    compBar.style.width = `${(compTime / 300) * 100}%`;

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

    const isP1Turn = (currentTurn === 'white' && playerGetsWhite || currentTurn === 'black' && !playerGetsWhite);

    if (isP1Turn) {
        p1El.classList.add('active-timer');
        compEl.classList.remove('active-timer');
    } else {
        compEl.classList.add('active-timer');
        p1El.classList.remove('active-timer');
    }
}


/**
 * Zwischenstand:
 * TODOs:
 * Timer einbauen
 * Endscreen
 * UI Cleanup
 * Backend
 * Drag & Drop Option
 * Eigener Spieler soll immer unten sein unabhängig von der Farbe
 * Computerlogik (Zufallszüge)
 * Ziehanimation?
 * Dameanimation?
 * Gameboard wesentlich größer. Evtl ganzer Bildschirm. Dann auch responsive für Handy.
 * Build-Process: Lässt sich Projekt nach Checkout bauen? (Build-Datei
 * Git Extra Branch?
 * Code-Review Sven
 */