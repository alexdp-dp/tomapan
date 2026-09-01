# ȚOMAPAN Online — MVP multiplayer

MVP funcțional cu:
- creare cameră privată/publică
- cod de invitație
- listă camere publice
- lobby multiplayer
- host + pornire rundă
- timer sincronizat pe server
- litera comună
- formular TOMAPAN
- STOP
- scor automat simplu: 10 unic / 5 duplicat / 0 gol sau literă greșită
- clasament între runde și final

## Rulare locală

```bash
npm install
npm run dev
```

Apoi deschide `http://localhost:3000` în două ferestre/browser-e diferite pentru test multiplayer.

## Important pentru versiunea production

Acest MVP ține camerele în memoria serverului. Pentru producție recomand:
- PostgreSQL pentru utilizatori, istoric, leaderboard, dicționar de răspunsuri
- Redis pentru rooms/presence/socket scaling
- autentificare opțională + guest mode
- moderare/validare colaborativă a răspunsurilor
- rate limiting și protecție anti-spam
- deploy pe Railway / Render / Fly.io / VPS


## v9

Redesign UI retrowave/synthwave: homepage cu meniu retro, carduri glass, paletă magenta/cyan și fundal SVG generat din cod.


## v10

Homepage refăcut după mockup-ul retrowave: logo brush, meniu sus, două acțiuni jos-stânga, camere publice tabelate jos-dreapta, iconuri SVG neon și butoane magenta/cyan.


## v12
Wallpaper retrowave static fără UI baked-in, generatorul de literă devine hero central, iconuri Font Awesome și blur al fundalului pentru modale și camera de joc.
