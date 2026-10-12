# Dame – Browser Multiplayer

Ein modernes, browserbasiertes Dame-Spiel, entwickelt als Projekt für den Kurs Web-Engineering an der DHBW. Der Fokus liegt aktuell auf einer sauberen Trennung von Benutzeroberfläche und Spiellogik im Frontend sowie einer intuitiven User Experience durch visuelles Feedback.

## Aktueller Funktionsumfang (Frontend)
* **Lobby & Validierung:** Namenseingabe mit Regex-Prüfung und Fail-Safes.
* **Münzwurf-Animation:** 3D-CSS-Animation zur zufälligen Bestimmung des Startspielers inkl. Bounce-Effekt.
* **Vollständige Regel-Engine:**
  * Diagonales Ziehen und Schlagen.
  * Systemweiter Schlagzwang (mit automatischer Erkennung und roter Hervorhebung der Pflichtzüge).
  * Beförderung zur "Dame" (gekennzeichnet durch ein Kronen-Emoji) bei Erreichen der gegnerischen Grundlinie.
  * "Fliegende Dame": Gekrönte Steine können beliebig weit in alle vier diagonalen Richtungen ziehen und schlagen.
* **UX-Features:** Optische Trophäen-Anzeige geschlagener Steine in der Kopfzeile, globale Deselektion ("Klick-ins-Leere") und Anzeige der Zugberechtigung.

## Dateistruktur
Das Projekt verzichtet im Frontend vollständig auf externe Frameworks (Vanilla HTML/CSS/JS):
* `server.js` – Node.js-Server (Express + Socket.io): liefert das Frontend aus, vermittelt Online-Partien und leitet Züge, Chat und Revanche-Anfragen weiter.
* `public/index.html` – Semantisches Grundgerüst und Container für die verschiedenen Bildschirme (Screens).
* `public/style.css` – Komplettes Styling inkl. CSS-Grid für das Spielbrett, Flexbox für UI-Elemente und Keyframe-Animationen.
* `public/ui.js` – Verwaltung der Benutzeroberfläche, Screen-Wechsel, Formularvalidierung, Münzwurf und Chat.
* `public/game.js` – Kernlogik des Brettspiels (Zugberechnung, Schlagzwang, Timer, Siegbedingungen, Computergegner).

## Lokale Ausführung
Voraussetzung: [Node.js](https://nodejs.org/) ab Version 18.

1. Repository klonen:
   `git clone https://github.com/flofries00/WebProgDHBWDame.git`
2. In den Projektordner wechseln und Abhängigkeiten installieren:
   `npm install`
3. Server starten:
   `npm start`
4. Im Browser `http://localhost:3000` öffnen.
   Für eine Online-Partie die Seite in einem zweiten Tab öffnen und in beiden „Gegen Mensch“ wählen.

Optional kann ein anderer Port gesetzt werden, z.B. unter Linux: `PORT=8080 npm start`

## Nächste Entwicklungsschritte
* Abbrechen-Button während des Spiels
* Tutorial
* Dark-Mode
* Zug-Sounds
