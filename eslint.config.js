// ESLint-Konfiguration: Prüft den Code auf typische Fehler (z.B. Tippfehler oder unbekannte Variablen)
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    // Empfohlene ESLint Standardregeln
    js.configs.recommended,

    // Server (Node.js)
    {
        files: ['server.js', 'eslint.config.js'],
        languageOptions: {
            sourceType: 'commonjs',
            globals: globals.node,
        },
    },

    // Browser-Skripte als ES-Module (Abhängigkeiten stehen als import in den Dateien selbst)
    {
        files: ['public/**/*.js'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                ...globals.browser,
                io: 'readonly', // Socket.io-Client aus /socket.io/socket.io.js
            },
        },
    },

    // Installierte Pakete nicht prüfen
    {
        ignores: ['node_modules/'],
    },
];
