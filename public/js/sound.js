// Sound-Effekte (Züge, Münzwurf, Spielende), erzeugt per Web Audio API (also keine Audiodateien nötig)
let audioCtx = null; // Audio-Kontext wird erst bei Bedarf erstellt
let soundEnabled = true; // Ton an/aus (umschaltbar per Button)

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
 * @param {number} freqStart - Anfangsfrequenz in Hertz
 * @param {number} freqEnd - Endfrequenz in Hertz
 * @param {number} duration - Dauer in Sekunden
 * @param {OscillatorType} [type] - Klangform
 * @param {number} [volume] - 0 bis 1
 * @param {number} [delay] - Sekunden
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
 * Spielt ein Rauschen, dessen Klangfarbe von freqStart zu freqEnd gleitet
 * Lautstärke schwillt bis zur Mitte an und klingt dann aus
 * @param {number} freqStart - Anfangsfrequenz in Hertz
 * @param {number} freqEnd - Endfrequenz in Hertz
 * @param {number} duration - Dauer in Sekunden
 * @param {number} [volume] - 0 bis 1
 * @param {number} [delay] - Sekunden
 */
function playNoise(freqStart, freqEnd, duration, volume = 1, delay = 0) {
    const ctx = getAudioContext();
    if (!ctx) return;

    const start = ctx.currentTime + delay;

    // Puffer voller Zufallswerte = weißes Rauschen
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Bandpass lässt nur einen Frequenzbereich durch, das Gleiten klingt wie ein Luftzug
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.5;
    filter.frequency.setValueAtTime(freqStart, start);
    filter.frequency.exponentialRampToValueAtTime(freqEnd, start + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + duration / 2); // Anschwellen
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration); // Ausklingen

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(start);
    noise.stop(start + duration);
}

/**
 * Spielt den passenden Effekt: 'move', 'capture', 'promote', 'coinFlip', 'coinLand', 'win' oder 'lose'
 * @param {'move' | 'capture' | 'promote' | 'coinFlip' | 'coinLand' | 'win' | 'lose'} name
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
        case 'coinFlip': // Die Münze saust durch die Luft: vier Luftzüge, die immer langsamer werden
            [0, 0.4, 0.85, 1.35].forEach((delay, i) => playNoise(700, 2200, 0.35 + i * 0.1, 1, delay));
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
