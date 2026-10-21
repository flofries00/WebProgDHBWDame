// Verbindung zum Server, die alle Module gemeinsam nutzen
// io() stellt die Socket.io-Bibliothek bereit, die in index.html vor den Modulen geladen wird
export const socket = io();
