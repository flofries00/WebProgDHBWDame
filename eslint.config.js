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
            globals: globals.node
        }
    },

    // Browser-Skripte
    {
        files: ['public/**/*.js'],
        languageOptions: {
            sourceType: 'script', // Klassische Skripte, die sich globale Variablen teilen
            globals: {
                ...globals.browser,
                io: 'readonly' // Socket.io-Client aus /socket.io/socket.io.js
            }
        },
        rules: {
            // Globale Funktionen werden aus anderen Dateien bzw. per onclick im HTML aufgerufen
            // daher nur lokale Variablen auf "unbenutzt" prüfen
            'no-unused-vars': ['warn', { vars: 'local' }]
        }
    },

    // game.js nutzt Variablen/Funktionen aus ui.js und sound.js
    {
        files: ['public/game.js'],
        languageOptions: {
            globals: {
                playerGetsWhite: 'readonly',
                gameMode: 'readonly',
                opponentName: 'readonly',
                currentPlayerName: 'readonly',
                socket: 'readonly',
                showScreen: 'readonly',
                fireConfetti: 'readonly',
                playSound: 'readonly',
                leaveToLobby: 'readonly',
                showConfirm: 'readonly'
            }
        }
    },

    // ui.js nutzt Funktionen aus game.js
    {
        files: ['public/ui.js'],
        languageOptions: {
            globals: {
                startGame: 'readonly',
                endGame: 'readonly'
            }
        }
    },

    // Installierte Pakete nicht prüfen
    {
        ignores: ['node_modules/']
    }
];