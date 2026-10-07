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
Das Projekt ist modular und verzichtet vollständig auf externe Frameworks (Vanilla HTML/CSS/JS):
* `index.html` – Semantisches Grundgerüst und Container für die verschiedenen Bildschirme (Screens).
* `style.css` – Komplettes Styling inkl. CSS-Grid für das Spielbrett, Flexbox für UI-Elemente und Keyframe-Animationen.
* `ui.js` – Verwaltung der Benutzeroberfläche, Screen-Wechsel, Formularvalidierung und Münzwurf-Logik.
* `game.js` – Kernlogik des Brettspiels (Zugberechnung, Schlagzwang-Prüfung, DOM-Manipulation beim Verschieben der Steine).

## Lokale Ausführung
Da sich das Projekt aktuell im reinen Frontend-Zwischenstand befindet, wird noch kein Webserver benötigt.
1. Das Archiv entpacken oder das Repository klonen.
2. Die Datei `index.html` mit einem beliebigen modernen Webbrowser öffnen.

## Nächste Entwicklungsschritte
* Implementierung einer Timer-Funktion für die Züge.
* Automatische Auswertung der Siegbedingungen (keine Steine / keine gültigen Züge mehr übrig) und Aufruf des End-Screens.
* **Backend-Integration:** Aufsetzen eines Node.js-Servers auf der Ubuntu-Umgebung für echte Netzwerk-Multiplayer-Sitzungen via WebSockets.
