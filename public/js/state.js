/**
 * Gemeinsamer Zustand, den mehrere Module lesen und ändern.
 * Importierte Variablen kann ein ES-Modul nicht neu zuweisen, die Eigenschaften eines Objekts aber schon
 */
export const state = {
    gameMode: '', // 'computer' oder 'online'
    currentPlayerName: '', // Eigener Spielername
    opponentName: 'Computer', // Name des Gegners
    playerGetsWhite: true, // Spielt der eigene Spieler weiß?
    timeSetting: '5', // Gewählte Bedenkzeit
    timeMinutes: 5, // Tatsächliche Bedenkzeit pro Spieler in Minuten
};
