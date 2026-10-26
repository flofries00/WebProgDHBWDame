// Kleine Bilder für Variante und Bedenkzeit: ein Brett in der Startaufstellung, eine Uhr und ein Partyhut (SVG).
// Genutzt im Bildschirm "Spiel einrichten" und in der Vorschau eines privaten Raums
import { createInitialBoard } from './rules.js';
import { createPieceElement } from './game.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/**
 * Erzeugt ein SVG-Element mit Attributen (SVG-Elemente brauchen createElementNS statt createElement)
 * @param {string} name - z.B. 'circle'
 * @param {Record<string, string | number>} attributes
 * @returns {SVGElement}
 */
function svgElement(name, attributes) {
    const element = document.createElementNS(SVG_NAMESPACE, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    return element;
}

/**
 * Zeichnet in den Container ein kleines Brett der Variante in der Startaufstellung (gleiche Felder und Steine wie im
 * Spiel, also auch in den gewählten Farben). Der Container hat die Klasse "tutorial-board"
 * @param {HTMLElement} container
 * @param {'klassisch' | 'international'} variant
 */
export function renderBoardPicture(container, variant) {
    const board = createInitialBoard(variant);
    const cells = board.flatMap((row, r) =>
        row.map((piece, c) => {
            const cell = document.createElement('span');
            cell.className = 'cell ' + ((r + c) % 2 !== 0 ? 'black-bg' : 'white-bg');
            if (piece) cell.append(createPieceElement(piece));
            return cell;
        })
    );
    container.style.setProperty('--tutorial-size', board.length);
    container.replaceChildren(...cells);
}

/**
 * Bild zur Bedenkzeit: eine Uhr, deren roter Ausschnitt die Minuten zeigt (das ganze Ziffernblatt sind 10 Minuten)
 * Liefert ein SVG-Element (nur Deko, aria-hidden)
 * @param {string} timeSetting - '1', '3', '5', '10' oder 'party'
 * @returns {SVGSVGElement}
 */
export function createTimeIcon(timeSetting) {
    const icon = svgElement('svg', { viewBox: '0 0 64 64', class: 'time-icon', 'aria-hidden': 'true' });

    if (timeSetting === 'party') {
        icon.append(
            svgElement('path', { d: 'M32 8 L52 58 H12 Z', class: 'hat-cone' }),
            svgElement('path', { d: 'M24.3 28 H39.7 M18.2 44 H45.8', class: 'hat-stripes' }),
            svgElement('circle', { cx: 32, cy: 8, r: 5, class: 'hat-pompom' })
        );
        return icon;
    }

    // Roter Ausschnitt ab 12 Uhr im Uhrzeigersinn. Die Endpunkte rechnet sin/cos aus, wie die Spitze eines Zeigers
    const angle = Math.min(Number(timeSetting) / 10, 0.999) * 2 * Math.PI; // Ein voller Kreis wäre kein Bogen mehr
    const x = (32 + 28 * Math.sin(angle)).toFixed(2);
    const y = (32 - 28 * Math.cos(angle)).toFixed(2);
    const largeArc = angle > Math.PI ? 1 : 0; // Mehr als ein halber Kreis: der große Bogen
    icon.append(
        svgElement('circle', { cx: 32, cy: 32, r: 28, class: 'clock-face' }),
        svgElement('path', { d: `M32 32 L32 4 A28 28 0 ${largeArc} 1 ${x} ${y} Z`, class: 'clock-sector' }),
        svgElement('circle', { cx: 32, cy: 32, r: 3, class: 'clock-center' })
    );
    return icon;
}

/**
 * Beim Start: Bilder in die Karten von "Spiel einrichten" setzen (data-board="klassisch", data-time="5" usw.)
 */
export function renderSetupPictures() {
    for (const element of document.querySelectorAll('#setupScreen [data-board]')) {
        renderBoardPicture(element, element.dataset.board);
    }
    for (const element of document.querySelectorAll('#setupScreen [data-time]')) {
        element.replaceChildren(createTimeIcon(element.dataset.time));
    }
}
