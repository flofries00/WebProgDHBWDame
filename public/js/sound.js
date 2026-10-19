// Sound-Effekte für Spielzüge, erzeugt per Web Audio API (also keine Audiodateien nötig)
let audioCtx = null; // Audio-Kontext wird erst bei Bedarf erstellt
let soundEnabled = true; // Ton an/aus (Umschaltbar per Button)

/**
 * Liefert den Audio-Kontext und erstellt ihn beim ersten Aufruf
 */
function getAudioContext() {
    if (!audioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null; // Für sehr alte Browser, einfach ohne Ton spielen
        audioCtx = new AudioCtx();
    }
    // Browser starten den Audio-Kontext erst nach einer Nutzeraktion (Autoplay-Sperre)
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

// Bei der ersten Nutzeraktion Audio freischalten
document.addEventListener('pointerdown', getAudioContext, { once: true });
document.addEventListener('keydown', getAudioContext, { once: true });

/**
 * Spielt einen kurzen Ton
 * Tonhöhe gleitet von freqStart zu freqEnd, Lautstärke klingt in 'duration' Sekunden aus
 * delay = Verzögerung in Sekunden (für mehrere Töne hintereinander)
 */
function playTone(freqStart, freqEnd, duration, type = 'sine', volume = 0.3, delay = 0) {
    const ctx = getAudioContext();
    if (!ctx) return;

    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator(); // Tonerzeuger
    const gain = ctx.createGain(); // Lautstärkeregler

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, start);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, start + duration);

    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration); // Ausklingen

    osc.connect(gain);
    gain.connect(ctx.destination); // Ausgabe an Lautsprecher

    osc.start(start);
    osc.stop(start + duration);
}

/**
 * Spielt den passenden Effekt: 'move', 'capture', 'promote', 'coinFlip', 'coinLand', 'win' oder 'lose'
 */
export function playSound(name) {
    if (!soundEnabled) return;
    switch (name) {
        case 'move': // Kurzes "Klack", wie Holz auf Holz
            playTone(200, 180, 0.08, 'triangle', 0.35);
            break;
        case 'capture': // Doppeltes, tieferes Klopfen
            playTone(300, 120, 0.1, 'triangle', 0.4);
            playTone(220, 90, 0.12, 'triangle', 0.4, 0.09);
            break;
        case 'promote': // Aufsteigender Dreiklang
            [523, 659, 784, 1047].forEach((freq, i) => playTone(freq, freq, 0.15, 'sine', 0.25, i * 0.09));
            break;
        case 'coinFlip': // Schnelles Klimpern der drehenden Münze, wird zum Ende hin langsamer
            [0, 0.12, 0.25, 0.39, 0.55, 0.73, 0.94, 1.18, 1.46, 1.78].forEach((delay) =>
                playTone(2400, 2200, 0.04, 'triangle', 0.12, delay)
            );
            break;
        case 'coinLand': // Metallisches "Pling" beim Aufprall
            playTone(1760, 1700, 0.5, 'sine', 0.25);
            playTone(2640, 2600, 0.35, 'sine', 0.12);
            break;
        case 'win': // Kurze Fanfare
            [523, 659, 784].forEach((freq, i) => playTone(freq, freq, 0.12, 'triangle', 0.3, i * 0.1));
            playTone(1047, 1047, 0.6, 'triangle', 0.3, 0.3);
            playTone(784, 784, 0.6, 'sine', 0.15, 0.3);
            break;
        case 'lose': // Langsam absteigende Töne
            [392, 370, 349].forEach((freq, i) => playTone(freq, freq, 0.3, 'sine', 0.3, i * 0.3));
            playTone(330, 220, 0.7, 'sine', 0.3, 0.9);
            break;
    }
}

/**
 * Schaltet die Sounds an/aus und passt das Symbol im Button an
 */
export function toggleSound() {
    soundEnabled = !soundEnabled;
    document.getElementById('soundBtn').textContent = soundEnabled ? '🔊' : '🔇';
}
