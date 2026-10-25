// Effekte am Spielende: Konfetti für den Gewinner, Regen für den Verlierer (Animationen per CSS in screens.css)

/**
 * Lässt beim Gewinner Konfetti regnen (Animation per CSS)
 */
export function fireConfetti() {
    if (prefersReducedMotion()) return;

    // Farben der Schnipsel
    const colors = ['#e2001a', '#28a745', '#007bff', '#ffc107', '#ffd700'];

    // 150 Schnipsel erzeugen
    for (let i = 0; i < 150; i++) {
        const conf = document.createElement('div');
        conf.className = 'confetti-piece';

        // Zufällige Position auf der x-Achse
        conf.style.left = Math.random() * 100 + 'vw';
        // Zufällige Farbe
        const randColor = colors[Math.floor(Math.random() * colors.length)];
        conf.style.backgroundColor = randColor;

        // Zufällige Fallgeschwindigkeit und Verzögerung
        conf.style.animationDuration = Math.random() * 3 + 2 + 's';
        conf.style.animationDelay = Math.random() * 1 + 's';

        document.body.appendChild(conf);

        // Nach Ablauf der Animation das Element aus dem HTML löschen
        conf.addEventListener('animationend', () => conf.remove());
    }
}

/**
 * Hat der Nutzer im Betriebssystem "Bewegung reduzieren" eingestellt? Dann gibt es weder Konfetti noch Regen
 */
function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Lässt es beim Verlierer regnen
 */
export function fireRain() {
    if (prefersReducedMotion()) return;

    // 120 Tropfen, die in den ersten 2,5 Sekunden nach und nach starten
    for (let i = 0; i < 120; i++) {
        const drop = document.createElement('div');
        drop.className = 'rain-drop';

        // Zufällige Position, Fallgeschwindigkeit und Verzögerung (Regen fällt schneller als Konfetti)
        drop.style.left = Math.random() * 100 + 'vw';
        drop.style.animationDuration = Math.random() * 0.5 + 0.7 + 's';
        drop.style.animationDelay = Math.random() * 2.5 + 's';

        document.body.appendChild(drop);

        // Nach Ablauf der Animation das Element aus dem HTML löschen
        drop.addEventListener('animationend', () => drop.remove());
    }
}
