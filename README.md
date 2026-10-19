# Dame – Browser Multiplayer

Ein modernes, browserbasiertes Dame-Spiel, entwickelt als Projekt für den Kurs Web-Engineering an der DHBW. Der Fokus liegt aktuell auf einer sauberen Trennung von Benutzeroberfläche und Spiellogik im Frontend sowie einer intuitiven User Experience durch visuelles Feedback.

## Aktueller Funktionsumfang (Frontend)

- **Lobby & Validierung:** Namenseingabe mit Regex-Prüfung und Fail-Safes.
- **Münzwurf-Animation:** 3D-CSS-Animation zur zufälligen Bestimmung des Startspielers inkl. Bounce-Effekt.
- **Vollständige Regel-Engine** für die Variante „Klassisch“ (siehe [Spielregeln](#spielregeln)), inkl. automatischer Erkennung und roter Hervorhebung der Pflichtschläge.
- **UX-Features:** Optische Trophäen-Anzeige geschlagener Steine in der Kopfzeile, globale Deselektion ("Klick-ins-Leere") und Anzeige der Zugberechtigung.

## Spielregeln

Aktuell wird die Variante **„Klassisch“** gespielt. Eine zweite Variante „International“ (10×10) ist geplant.

### Variante „Klassisch“

**Aufbau**

- Brett mit 8×8 Feldern, gespielt wird nur auf den dunklen Feldern.
- Jede Seite beginnt mit 12 Steinen auf den ersten drei Reihen.
- Weiß beginnt.

**Ziehen**

- Normale Steine ziehen ein Feld diagonal **vorwärts**.
- Eine **Dame** zieht beliebig weit diagonal in alle vier Richtungen („fliegende Dame“).

**Schlagen**

- Normale Steine schlagen nur **vorwärts**: Sie springen über einen direkt benachbarten gegnerischen Stein auf das leere Feld dahinter.
- Eine Dame schlägt in alle Richtungen: Sie überspringt aus beliebiger Entfernung genau einen gegnerischen Stein und landet auf einem beliebigen freien Feld dahinter.
- Es gilt **Schlagzwang**: Kann ein Stein schlagen, muss geschlagen werden. Gibt es mehrere Möglichkeiten, ist die Wahl frei (kein Mehrheitsschlag).
- **Mehrfachsprung:** Kann derselbe Stein nach einem Schlag erneut schlagen, muss er weiterschlagen.
- Geschlagene Steine werden sofort vom Brett genommen.

**Beförderung**

- Ein Stein, der die gegnerische Grundlinie erreicht, wird zur Dame (gekennzeichnet durch eine Krone).
- Wird ein Stein während eines Schlags befördert, endet der Zug sofort.

**Spielende**

- Gewonnen hat, wessen Gegner keine Steine mehr hat **oder** keinen gültigen Zug mehr ausführen kann.
- Jede Seite hat 5 Minuten Bedenkzeit (Schachuhr-Prinzip). Wer die Zeit überschreitet, verliert.
- Wer aufgibt oder eine Online-Partie verlässt, verliert.

## Dateistruktur

Das Projekt verzichtet im Frontend vollständig auf externe Frameworks (Vanilla HTML/CSS/JS):

- `server.js` – Node.js-Server (Express + Socket.io): liefert das Frontend aus, vermittelt Online-Partien und leitet Züge, Chat und Revanche-Anfragen weiter.
- `public/index.html` – Semantisches Grundgerüst und Container für die verschiedenen Bildschirme (Screens).
- `public/style.css` – Komplettes Styling inkl. CSS-Grid für das Spielbrett, Flexbox für UI-Elemente und Keyframe-Animationen.
- `public/ui.js` – Verwaltung der Benutzeroberfläche, Screen-Wechsel, Formularvalidierung, Münzwurf und Chat.
- `public/game.js` – Kernlogik des Brettspiels (Zugberechnung, Schlagzwang, Timer, Siegbedingungen, Computergegner).

## Lokale Ausführung

Voraussetzung: [Node.js](https://nodejs.org/) ab Version 18 (für die `.env`-Datei ab Version 20.12).

1. Repository klonen:
   `git clone https://github.com/flofries00/WebProgDHBWDame.git`
2. In den Projektordner wechseln und Abhängigkeiten installieren:
   `npm install`
3. Build-Schritt (es wird nichts kompiliert, der Befehl ist der Vollständigkeit halber vorhanden):
   `npm run build`
4. Server starten:
   `npm start` (Standard-Port 3000)
5. Im Browser `http://localhost:3000` öffnen.
   Für eine Online-Partie die Seite in einem zweiten Tab öffnen und in beiden „Gegen Mensch“ wählen.

### Port festlegen

Der Port kann auf drei Arten gesetzt werden (in dieser Priorität):

1. Als Argument: `npm start -- 8080`
2. Als Umgebungsvariable: `PORT=8080 npm start`
3. In einer Datei `.env` (Vorlage: `cp .env.example .env`)

Hinweis: `npm build` (ohne `run`) existiert in aktuellen npm-Versionen nicht, richtig ist `npm run build`.

### Tests ausführen

```bash
npm test
```

## Betrieb auf dem Ubuntu-Server

```bash
git clone https://github.com/flofries00/WebProgDHBWDame.git
cd WebProgDHBWDame
npm install
npm run build
nohup npm start -- 8080 > server.log 2>&1 &
```

Der Server läuft dann im Hintergrund weiter, auch nach dem Abmelden. Ausgaben stehen in `server.log`.
Beenden mit: `pkill -f "node server.js"`

## Nächste Entwicklungsschritte

- Umstellung auf ES-Module und CSP-taugliches HTML (ohne Inline-Handler)
- Private Räume für Online-Partien
- Zweite Variante „International“ (10×10, Rückwärtsschlagen, Mehrheitsschlag)
- Barrierefreiheit, Dark-Mode und Tutorial
