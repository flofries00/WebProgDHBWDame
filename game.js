// Globale Variablen für das Spielfeld
let currentTurn = 'white' // Weiß hat nach den bekannten Dame-Regeln immer den ersten Zug
let selectedPiece = null; // Speichert das HTML-Element des aktuell angeklickten Steins.
let moveCount = 0; // Zählt Züge mit
let whiteTime = 300; // Startzeit Weiß (5min / 300s)
let blackTime = 300; // Startzeit Schwarz (5min / 300s)
let timerInterval = null;
let isMultiJumping = false; // Sperrt andere Steine während eines Multisprungs

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
    whiteTime = 300;
    blackTime = 300;
    updateTimerDisplays();
    startTurnTimer();

    // Kopfzeile dynamisch anpassen, basierend auf Farbwahl-Zufallsevent
    document.getElementById('p1Color').textContent = playerGetsWhite ? "(Weiß)" : "(Schwarz)";
    document.getElementById('compColor').textContent = playerGetsWhite ? "(Schwarz)" : "(Weiß)";

    // Dynamische Textanzeige
    updateTurnIndicator();

    // Zug-Log für neues Spiel leeren
    const logList = document.getElementById('logList');
    if (logList) logList.innerHTML = '';

    showScreen('gameScreen');
    generateBoard(); // Baut das HTML für das Spielbrett auf

    // Wir bringen nun dem gesamten Brett bei, auf Klicks auf markierte Felder zu achten
    const boardEl = document.getElementById('board');
    boardEl.addEventListener('click', handleBoardClick);

    // Listener für Drag and Drop auf dem Spielbrett
    boardEl.addEventListener('dragover', handleDragOver);
    boardEl.addEventListener('drop', handleDrop);

    // Dokument überwachen, um Klicks ins Leere abzufangen
    document.addEventListener('click', handleGlobalClick);

    // Direkt bei Start prüfen, ob Felder hervorgehoben werden müssen
    autoHighlightCaptures();

    // Initiales Sperren der Gegnerischen Steine
    updatePieceCursors();

    // Wenn Computer weiß ist, fängt er an
    if (gameMode === 'computer') {
        makeComputerMove();
    }
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
                if (row < 3) {
                    const piece = document.createElement('div');
                    piece.className = 'piece black-piece'; // Oben immer Schwarz
                    piece.draggable = true; // Draggable machen
                    piece.addEventListener('click', selectPiece); // Klick-Event hinzufügen
                    piece.addEventListener('dragstart', handleDragStart); // DragDrop
                    piece.addEventListener('dragend', handleDragEnd);
                    cell.appendChild(piece); // Stein in die Kachel legen
                }
                else if (row > 4) {
                    const piece = document.createElement('div');
                    piece.className = 'piece white-piece'; // Unten immer Weiß
                    piece.draggable = true;
                    piece.addEventListener('click', selectPiece); // Klick-Event hinzufügen
                    piece.addEventListener('dragstart', handleDragStart); // DragDrop
                    piece.addEventListener('dragend', handleDragEnd);
                    cell.appendChild(piece); // Stein in die Kachel legen
                }
            }

            // Die fertige Kachel an das Spielbrett im HTML anhängen
            boardElement.appendChild(cell);
        }
    }

    // Brett visuell um 180° drehen, wenn man Schwarz hat
    const wrapper = document.getElementById('boardWrapper');
    if (!playerGetsWhite) {
        wrapper.classList.add('flipped');
    } else {
        wrapper.classList.remove('flipped');
    }
}

/**
 * Wird ausgelöst, wenn ein Spieler auf einen Spielstein klickt.
 */
function selectPiece(event) {
    const piece = event.target;

    // Multischlag-Sperre einbauen, kein Stein anklickbar
    if (isMultiJumping && piece !== selectedPiece) {
        return;
    }

    // a) Prüfen: Gehört der Stein dem Spieler, der gerade am Zug ist?
    // Wenn Weiß am Zug ist, darf man keine schwarzen Steine anklicken und umgekehrt
    if (!piece.classList.contains(currentTurn + '-piece')) {
        return; // Funktion abbrechen
    }

    // Multiplayer-Check: Darf ich Stein wirklich anklicken?
    const isMyTurn = (currentTurn === 'white' && playerGetsWhite) ||
        (currentTurn === 'black' && !playerGetsWhite);

    //event.isTrusted ist 'true' bei echten Mausklicks, 'false' bei simulierten
    if (gameMode === 'local' && !isMyTurn && event.isTrusted) {
        return; // Blockiert echten Mausklick auf fremde Steine
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

    // Sende Zug an Gegner
    if (gameMode === 'local' && event.isTrusted) {
        socket.emit('makeMove', {
            fromR: selectedPiece.parentElement.dataset.row,
            fromC: selectedPiece.parentElement.dataset.col,
            toR: targetCell.dataset.row,
            toC: targetCell.dataset.col
        });
    }

    // 1. Koordinaten VOR dem Wechsel speichern (für die Animation & Board-Log)
    const startRect = selectedPiece.getBoundingClientRect();
    const isCapture = targetCell.dataset.jumpR !== undefined;
    const startRow = parseInt(selectedPiece.parentElement.dataset.row);
    const startCol = parseInt(selectedPiece.parentElement.dataset.col);
    const endRow = parseInt(targetCell.dataset.row);
    const endCol = parseInt(targetCell.dataset.col);

    // Wurde ein Stein geschlagen?
    if (isCapture) {
        // "Opfer" suchen
        const victimCell = document.querySelector(`.cell[data-row="${targetCell.dataset.jumpR}"][data-col="${targetCell.dataset.jumpC}"]`);
        if (victimCell) {
            const victimIsWhite = victimCell.children[0].classList.contains('white-piece');
            victimCell.innerHTML = ''; // Gegnerstein löschen

            // Kleine Trophäe erzeugen und in Kopfzeile packen
            const trophy = document.createElement('div');
            trophy.className = 'captured-piece ' + (victimIsWhite ? 'white-piece' : 'black-piece');
            const tCont = (currentTurn === 'white' && playerGetsWhite) ||
                (currentTurn === 'black' && !playerGetsWhite) ? 'p1Captured' : 'compCaptured';
            document.getElementById(tCont).appendChild(trophy);
        }
    }

    // 'appendChild' verschiebt das HTML-Element automatisch in die neue Zelle
    const pieceToAnimate = selectedPiece;
    targetCell.appendChild(pieceToAnimate);
    pieceToAnimate.style.opacity = '1'; // Bugfix: Verhindert unsichtbare Steine bei Drag&Drop

    // 2. Dame-Beförderung vorbereiten
    const newRow = parseInt(targetCell.dataset.row);
    let getsPromoted = false;

    if (pieceToAnimate.classList.contains('white-piece') && newRow === 0 && !pieceToAnimate.classList.contains('dame')) getsPromoted = true;
    if (pieceToAnimate.classList.contains('black-piece') && newRow === 7 && !pieceToAnimate.classList.contains('dame')) getsPromoted = true;

    // Hilfsfunktion: Dreht die Dame um 180 Grad und blendet die Krone ein
    const playPromoteAnim = () => {
        pieceToAnimate.classList.add('hide-crown', 'dame');
        const wrapper = document.getElementById('boardWrapper');
        const baseRot = wrapper.classList.contains('flipped') ? 180 : 0;
        const spinAnim = pieceToAnimate.animate([
            { transform: `rotate(${baseRot}deg) rotateY(0deg)` },
            { transform: `rotate(${baseRot}deg) rotateY(180deg)` }
        ], { duration: 400, easing: 'ease-in-out' });

        spinAnim.onfinish = () => pieceToAnimate.classList.remove('hide-crown');
    };

    // 3. FLIP-Animation: NUR ausführen, wenn es kein Drag & Drop ('drop') war!
    if (event.type !== 'drop') {
        const endRect = pieceToAnimate.getBoundingClientRect();
        let dx = startRect.left - endRect.left;
        let dy = startRect.top - endRect.top;

        // DER NEUE TRICK: Wenn das Brett um 180 Grad gedreht ist, fliegen die Steine
        // lokal in die falsche Richtung. Wir drehen die Richtung mathematisch einfach um!
        const wrapper = document.getElementById('boardWrapper');
        if (wrapper.classList.contains('flipped')) {
            dx = -dx;
            dy = -dy;
        }

        const moveKeyframes = isCapture
            ? [ // Sprung über gegnerischen Stein
                { transform: `translate(${dx}px, ${dy}px) scale(1)`, zIndex: 10 },
                { transform: `translate(${dx / 2}px, ${dy / 2}px) scale(1.3)`, zIndex: 10 },
                { transform: `translate(0px, 0px) scale(1)`, zIndex: 10 }
            ]
            : [ // Normales, flaches Schweben
                { transform: `translate(${dx}px, ${dy}px)`, zIndex: 10 },
                { transform: `translate(0px, 0px)`, zIndex: 10 }
            ];

        const moveAnim = pieceToAnimate.animate(moveKeyframes, { duration: 350, easing: 'ease-in-out' });

        // Wenn er befördert wird, warten wir den Flug ab und drehen ihn dann
        if (getsPromoted) moveAnim.onfinish = playPromoteAnim;

    } else {
        // Beim Drag & Drop: Keine Flug-Animation, aber falls er befördert wird, Drehung abspielen!
        if (getsPromoted) playPromoteAnim();
    }

    // Zug in Log eintragen (übergibt nun auch getsPromoted)
    addToLog(startRow, startCol, endRow, endCol, isCapture, getsPromoted);

    // Multischlag prüfen
    let canMultiJump = false;
    // Wenn geschlagen hat UND nicht zur Dame befördert wurde
    if (isCapture && !getsPromoted) {
        if (canCapture(pieceToAnimate)) {
            canMultiJump = true;
        }
    }

    if (canMultiJump) {
        isMultiJumping = true; // Brett für andere Steine sperren
        clearSelection();
        selectedPiece = pieceToAnimate;
        selectedPiece.classList.add('selected');
        showValidMoves(selectedPiece, true); // Zeigt zwangsweise nur die nächsten Schläge an

        updatePieceCursors(); // Andere Steine sperren

        // Falls Computer am Zug ist, darf auch er direkt nochmal springen
        const compIsWhite = !playerGetsWhite;
        if (gameMode === 'computer' && ((currentTurn === 'white' && compIsWhite) || (currentTurn === 'black' && !compIsWhite))) {
            if (typeof makeComputerMove === 'function') makeComputerMove();
        }
        return; // Funktion hier beenden - Kein Spielerwechsel
    }

    // Normales Zug-Ende - Multijump zurücksetzen
    isMultiJumping = false;

    // Markierungen aufheben
    clearSelection();

    // Zugzähler erhöhen
    moveCount++;

    // Spieler wechseln
    currentTurn = currentTurn === 'white' ? 'black' : 'white';

    // Überprüfen, ob Spiel entschieden ist
    if (checkWinCondition()) return;

    // Statusleiste aktualisieren
    updateTurnIndicator();

    // Nach dem Spielerwechsel prüfen, ob der neue Spieler im Schlagzwang ist
    autoHighlightCaptures();

    // Optischen Fokus der Uhr auf den neuen Spieler wechseln
    updateActiveTimerStyle();

    // Mauszeiger für neuen Spieler aktualisieren
    updatePieceCursors();

    // Falls Computer dran ist, nächsten regulären Zug auslösen
    const compIsWhite = !playerGetsWhite;
    if (gameMode === 'computer' && ((currentTurn === 'white' && compIsWhite) || (currentTurn === 'black' && !compIsWhite))) {
        if (typeof makeComputerMove === 'function') makeComputerMove();
    }
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

    // Mehrfachsprung darf nicht durch Klick ins Leere abgebrochen werden
    if (isMultiJumping) return;

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
        winner = playerGetsWhite ? currentPlayerName : opponentName;
    } else {
        winner = playerGetsWhite ? opponentName : currentPlayerName;
    }

    const textEl = document.getElementById('winnerText');
    if (reason === "timeout") {
        textEl.textContent = `Zeit abgelaufen! ${winner} gewinnt!`;
    } else {
        textEl.textContent = `${winner} hat gewonnen in ${moveCount} Zügen!`;
    }

    // Spielverlauf in Endbildschirm kopieren
    const logList = document.getElementById('logList');
    const endLogList = document.getElementById('endLogList');
    if (logList && endLogList) {
        endLogList.innerHTML = logList.innerHTML;
    }

    // Bildschrim wechseln
    showScreen('endScreen');

    // Erst nach dem Einblenden nach unten scrollen, sonst berechnet der Browser die Höhe falsch
    if (endLogList) {
        const endLogBox = endLogList.parentElement;
        endLogBox.scrollTop = endLogBox.scrollHeight;
    }
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
                updateTimerDisplays();
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
 * Züge von Server empfangen und auf dem Brett simulieren
 */
socket.on('recieveMove', (m) => {
    const fromSel = `.cell[data-row="${m.fromR}"][data-col="${m.fromC}"]`;
    const toSel = `.cell[data-row="${m.toR}"][data-col="${m.toC}"]`;

    const fCell = document.querySelector(fromSel);
    const tCell = document.querySelector(toSel);

    if (fCell && tCell && fCell.children[0]) {
        // 1. Stein auswählen
        fCell.children[0].click();

        // 2. Zielfeld anklicken
        tCell.click();
    }
});

/**
 * Startet Ziehen eines Steins
 */
function handleDragStart(event) {
    // Klick simulieren, um Felder zu färben
    selectPiece(event);

    // Stein halbtransparent machen, während er am Mauszeiger hängt
    setTimeout(() => {
        if (selectedPiece === event.target) event.target.style.opacity = '0.3';
    }, 0);
}

/**
 * Setzt Optik des Steins nach Loslassen wieder zurück
 */
function handleDragEnd(event) {
    event.target.style.opacity = '1';
}

/**
 * Erlaubt Fallenlassen NUR auf gültigen Zielfeldern
 */
function handleDragOver(event) {
    const validCell = event.target.closest('.cell.highlighted, .cell.highlighted-capture');
    if (validCell) {
        event.preventDefault(); // Notwendig um Bereich als Drop-Zone freizugeben
    }
}

/**
 * Führt Zug bei Loslassen auf dem Ziel aus
 */
function handleDrop(event) {
    event.preventDefault();
    // Loslassen an bestehende Klick-Funktion übergeben
    handleBoardClick(event);
}


/**
 * Aktualisiert Kopfzeile
 */
function updateTurnIndicator() {
    const isMyTurn = (currentTurn === 'white' && playerGetsWhite) || (currentTurn === 'black' && !playerGetsWhite);

    const text = isMyTurn ? "Du bist am Zug" : `${opponentName} ist am Zug`;
    document.getElementById('turnIndicator').textContent = text;
}

/**
 * Schreibt einen Zug in den Spielverlauf und scrollt mit
 */
function addToLog(sRow, sCol, eRow, eCol, isCapture, getsPromoted = false) {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    // Array-Indexe in Schach-Koordinaten umwandeln
    const startStr = letters[sCol] + (8 - sRow);
    const endStr = letters[eCol] + (8 - eRow);

    const isMyTurn = (currentTurn === 'white' && playerGetsWhite) || (currentTurn === 'black' && !playerGetsWhite);

    const name = isMyTurn ? "Du" : opponentName;
    const verb = isCapture ? "schlägt" : "zieht";
    const promoText = getsPromoted ? " und wird zur 👑 Dame" : "";

    const li = document.createElement('li');
    li.innerHTML = `<strong>${name}</strong> ${verb} von ${startStr} nach ${endStr}${promoText}`;

    const list = document.getElementById('logList');
    if (list) {
        list.appendChild(li);
        // Box nach unten scrollen lassen
        const box = document.getElementById('moveLog');
        box.scrollTop = box.scrollHeight;
    }
}

/**
 * Führt einen zufälligen, gültigen Zug für den Computer aus.
 */
function makeComputerMove() {
    if (gameMode !== 'computer') return;

    // Nur agieren, wenn der Computer (der Gegner) dran ist
    const compIsWhite = !playerGetsWhite;
    if ((currentTurn === 'white' && !compIsWhite) || (currentTurn === 'black' && compIsWhite)) {
        return;
    }

    const compPieces = (isMultiJumping && selectedPiece) ? [selectedPiece] : Array.from(document.querySelectorAll(`.${currentTurn}-piece`));
    let validMoves = [];
    let captureMoves = [];

    // 1. Alle Steine scannen und mögliche Züge/Schläge sammeln
    compPieces.forEach(piece => {
        const row = parseInt(piece.parentElement.dataset.row);
        const col = parseInt(piece.parentElement.dataset.col);
        const isDame = piece.classList.contains('dame');
        const oppClass = piece.classList.contains('white-piece') ? 'black-piece' : 'white-piece';

        if (isDame) {
            const dirs = [{ dr: -1, dc: -1 }, { dr: -1, dc: 1 }, { dr: 1, dc: -1 }, { dr: 1, dc: 1 }];
            dirs.forEach(dir => {
                let r = row + dir.dr, c = col + dir.dc, foundOpp = false, oppR = -1, oppC = -1;
                while (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
                    const target = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
                    if (target) {
                        if (target.children.length === 0) {
                            if (foundOpp) captureMoves.push({ piece, target });
                            else validMoves.push({ piece, target });
                        } else {
                            if (!foundOpp && target.children[0].classList.contains(oppClass)) {
                                foundOpp = true;
                                oppR = r; oppC = c;
                            } else break;
                        }
                    }
                    r += dir.dr; c += dir.dc;
                }
            });
        } else {
            const dir = piece.classList.contains('white-piece') ? -1 : 1;
            const moves = [{ r: row + dir, c: col - 1 }, { r: row + dir, c: col + 1 }];
            moves.forEach(m => {
                if (m.r >= 0 && m.r <= 7 && m.c >= 0 && m.c <= 7) {
                    const target = document.querySelector(`.cell[data-row="${m.r}"][data-col="${m.c}"]`);
                    if (target) {
                        if (target.children.length === 0) {
                            validMoves.push({ piece, target });
                        } else if (target.children[0].classList.contains(oppClass)) {
                            const jR = m.r + dir, jC = m.c + (m.c - col);
                            if (jR >= 0 && jR <= 7 && jC >= 0 && jC <= 7) {
                                const jumpT = document.querySelector(`.cell[data-row="${jR}"][data-col="${jC}"]`);
                                if (jumpT && jumpT.children.length === 0) captureMoves.push({ piece, target: jumpT });
                            }
                        }
                    }
                }
            });
        }
    });

    // 2. Schlagzwang priorisieren
    const movesToPlay = captureMoves.length > 0 ? captureMoves : validMoves;

    if (movesToPlay.length > 0) {
        // 3. Zufälligen Zug auswählen
        const randomMove = movesToPlay[Math.floor(Math.random() * movesToPlay.length)];

        // 4. Zug mit Verzögerung ausführen (wirkt menschlicher)
        setTimeout(() => {
            randomMove.piece.click(); // Stein anwählen
            setTimeout(() => {
                randomMove.target.click(); // Ziel klicken
            }, 300);
        }, 800);
    }
}

/**
 * Setzt den Mauszeiger für gesperrte Steine auf "Verbot" und deaktiviert Drag & Drop
 */
function updatePieceCursors() {
    const allPieces = document.querySelectorAll('.piece');
    const isMyTurn = (currentTurn === 'white' && playerGetsWhite) || (currentTurn === 'black' && !playerGetsWhite);

    allPieces.forEach(p => {
        let isLocked = false;

        // Option A: Nicht der eigene Stein
        if (!p.classList.contains(currentTurn + '-piece')) isLocked = true;

        // Option B: Gegner ist am Zug
        if (!isMyTurn) isLocked = true;

        // Option C: Multischlag läuft, aber falscher Stein
        if (isMultiJumping && p !== selectedPiece) isLocked = true;

        if (isLocked) {
            p.classList.add('locked');
            p.draggable = false; // Verhindert Geister-Drags
        } else {
            p.classList.remove('locked');
            p.draggable = true;
        }
    });
}

/**
 * Zwischenstand:
 * TODOs:
 * Gameboard wesentlich größer. Evtl ganzer Bildschirm. Dann auch responsive für Handy.
 * Build-Process: Lässt sich Projekt nach Checkout bauen? (Build-Datei)
 * Sieganimation?
 * Chat?
 * Letzte Boardstellung in Endbildschirm
 * UI Checkup
 * Klick auf "nochmal spielen" soll gegner Replay Wunsch anzeigen - dann in Warteschlange gegen gleichen Gegner
 * Klick auf Zurück zur Lobby soll Gegner anzeigen, dass gegner weg ist und Replay Button ausgrauen
 */