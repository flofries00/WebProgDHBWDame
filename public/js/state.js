/**
 * Gemeinsamer Zustand, den mehrere Module lesen und ändern.
 * Importierte Variablen kann ein ES-Modul nicht neu zuweisen, die Eigenschaften eines Objekts aber schon
 */
export const state = {
    gameMode: '', // 'computer' oder 'online'
    currentPlayerName: '', // Eigener Spielername
    opponentName: 'Computer', // Name des Gegners
    playerGetsWhite: true, // Spielt der eigene Spieler Weiß?
    variant: 'klassisch', // Gewählte Variante: 'klassisch' oder 'international'
    timeSetting: '5', // Gewählte Bedenkzeit: '1', '3', '5', '10' (Minuten) oder 'party'
    timeMinutes: 5, // Tatsächliche Bedenkzeit pro Spieler in Minuten (im Partymodus ausgelost)
    gameStartsAt: 0, // Zeitpunkt (Date.now()), zu dem die Partie nach Münzwurf und Countdown beginnt
};
