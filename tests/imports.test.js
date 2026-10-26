// Prüft die Importe zwischen den eigenen Dateien, ohne sie auszuführen (die Browser-Module brauchen ein HTML-Dokument).
// Ein falsch geschriebener Name im Import fällt ESLint nicht auf, im Browser lädt dann aber die ganze Seite nicht
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const JS_DIR = path.join(ROOT, 'public', 'js');

// Alle eigenen Module: Browser-Dateien und der Server
const FILES = [...fs.readdirSync(JS_DIR).map((name) => path.join(JS_DIR, name)), path.join(ROOT, 'server.js')];

/**
 * Namen, die eine Datei exportiert (export function, export async function, export const, export let)
 */
function exportedNames(source) {
    return new Set([...source.matchAll(/^export (?:async )?(?:function|const|let) (\w+)/gm)].map((match) => match[1]));
}

/**
 * Importe aus eigenen Dateien: { names, from } für jedes "import { a, b } from './datei.js'" (auch über mehrere Zeilen)
 */
function localImports(source) {
    return [...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*'(\.[^']+)'/g)].map((match) => ({
        names: match[1]
            .split(',')
            .map((name) => name.trim().split(/\s+as\s+/)[0])
            .filter(Boolean),
        from: match[2],
    }));
}

describe('Importe zwischen den eigenen Dateien', () => {
    for (const file of FILES) {
        const source = fs.readFileSync(file, 'utf8');
        const imports = localImports(source);
        if (imports.length === 0) continue;

        it(`${path.relative(ROOT, file)}: alle importierten Namen gibt es in der Zieldatei`, () => {
            for (const { names, from } of imports) {
                const target = path.resolve(path.dirname(file), from);
                assert.ok(fs.existsSync(target), `Datei fehlt: ${from}`);
                const exported = exportedNames(fs.readFileSync(target, 'utf8'));
                for (const name of names) {
                    assert.ok(exported.has(name), `"${name}" wird von ${from} nicht exportiert`);
                }
            }
        });
    }
});
