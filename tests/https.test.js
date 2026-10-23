// Integrationstests für HTTPS: Startet den echten Server mit HTTP und HTTPS gleichzeitig.
// Das Zertifikat wird nur für den Test erzeugt (selbst signiert, mit openssl) und danach gelöscht.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { get } from 'node:https';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';

const SERVER_FILE = fileURLToPath(new URL('../server.js', import.meta.url));

// Ohne openssl kann kein Zertifikat erzeugt werden, dann werden die Tests übersprungen
const hasOpenssl = spawnSync('openssl', ['version']).status === 0;

let certDir;
let certFile;
let keyFile;
const processes = []; // Alle gestarteten Server, damit sie am Ende beendet werden
const clients = [];

/**
 * Sucht einen freien Port, damit der Test nicht mit einem bereits laufenden Server kollidiert
 */
function getFreePort() {
    return new Promise((resolve) => {
        const probe = createServer();
        probe.listen(0, () => {
            const { port } = probe.address();
            probe.close(() => resolve(port));
        });
    });
}

/**
 * Wartet, bis ein Ereignis ankommt, und liefert dessen Daten (bricht nach einer Zeit mit Fehler ab)
 */
function waitFor(socket, eventName, timeout = 2000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Ereignis "${eventName}" kam nicht an`)), timeout);
        socket.once(eventName, (data) => {
            clearTimeout(timer);
            resolve(data);
        });
    });
}

/**
 * Startet den Server. Ohne untilText wird gewartet, bis er sich beendet (liefert Code und Fehlerausgabe).
 */
function startServer(args, env = {}, untilText = null) {
    const server = spawn(process.execPath, [SERVER_FILE, ...args], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, ...env },
    });
    processes.push(server);

    let output = '';
    let errors = '';
    return new Promise((resolve, reject) => {
        server.stdout.on('data', (data) => {
            output += data.toString();
            if (untilText && output.includes(untilText)) resolve();
        });
        server.stderr.on('data', (data) => (errors += data.toString()));
        server.on('exit', (code) => {
            if (untilText) reject(new Error(`Server wurde beendet (Code ${code}): ${errors}`));
            else resolve({ code, errors });
        });
    });
}

/**
 * Verbindet einen Test-Client. Das selbst signierte Zertifikat wird nur im Test akzeptiert.
 */
async function connectClient(url) {
    const client = io(url, { forceNew: true, transports: ['websocket'], rejectUnauthorized: false });
    clients.push(client);
    await waitFor(client, 'connect');
    return client;
}

describe('HTTPS', { skip: !hasOpenssl && 'openssl ist nicht installiert' }, () => {
    let httpPort;
    let httpsPort;

    // Zertifikat erzeugen und den Server mit HTTP und HTTPS starten
    before(async () => {
        certDir = mkdtempSync(path.join(tmpdir(), 'dame-certs-'));
        certFile = path.join(certDir, 'server.crt');
        keyFile = path.join(certDir, 'server.key');
        // prettier-ignore
        const result = spawnSync('openssl', [
            'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
            '-keyout', keyFile, '-out', certFile, '-subj', '/CN=localhost',
        ]);
        assert.equal(result.status, 0, 'Zertifikat konnte nicht erzeugt werden');

        httpPort = await getFreePort();
        httpsPort = await getFreePort();
        await startServer([String(httpPort), String(httpsPort)], { TLS_CERT: certFile, TLS_KEY: keyFile }, 'https://');
    });

    // Nach allen Tests: Clients trennen, Server beenden und das Zertifikat löschen
    after(() => {
        clients.forEach((client) => client.disconnect());
        processes.forEach((server) => server.kill());
        rmSync(certDir, { recursive: true, force: true });
    });

    it('liefert die Seite über HTTPS aus', async () => {
        const { status, body } = await new Promise((resolve, reject) => {
            get(`https://localhost:${httpsPort}/`, { rejectUnauthorized: false }, (res) => {
                let body = '';
                res.on('data', (chunk) => (body += chunk));
                res.on('end', () => resolve({ status: res.statusCode, body }));
            }).on('error', reject);
        });
        assert.equal(status, 200);
        assert.match(body, /<title>/);
    });

    it('bringt einen Spieler über HTTP und einen über HTTPS zusammen', async () => {
        const viaHttp = await connectClient(`http://localhost:${httpPort}`);
        const viaHttps = await connectClient(`https://localhost:${httpsPort}`);
        const matchHttp = waitFor(viaHttp, 'matchFound');
        const matchHttps = waitFor(viaHttps, 'matchFound');
        viaHttp.emit('findMatch', 'Anna', '5');
        viaHttps.emit('findMatch', 'Bernd', '5');
        const [infoHttp, infoHttps] = await Promise.all([matchHttp, matchHttps]);
        assert.equal(infoHttp.oppName, 'Bernd');
        assert.equal(infoHttps.oppName, 'Anna');
    });

    it('bricht mit verständlicher Meldung ab, wenn das Zertifikat fehlt', async () => {
        const port = await getFreePort();
        const missing = path.join(certDir, 'gibtsnicht.crt');
        const { code, errors } = await startServer([String(port), String(port + 1)], {
            TLS_CERT: missing,
            TLS_KEY: keyFile,
        });
        assert.equal(code, 1);
        assert.match(errors, /Für HTTPS fehlen Zertifikat oder Schlüssel/);
    });
});
