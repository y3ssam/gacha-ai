# Development rules

- User explicitly replaced the old gacha-ai game with y3ssam/gacha-game as the actual application base. Keep its original HTML hierarchy, complete CSS, native five-menu navigation, six-position front/back party, four skills, six equipment slots, ten-episode chapters, lorebook and seven-step world creation. Do not restore the old gacha-ai renderer or four-person engine.
- Source: gacha-game@6ae30d1c1f44edd5b9ad85f5dcb1f21d88d3d716. Original CSS is src/game.css; original interactions plus live completion are src/game-ui.js. All original assets are included.
- Engine rules belong in src/game-engine.js. AI supplies validated narrative/appearance only. Browser-local worlds and images belong in IndexedDB through src/game-runtime.js. No player server database. No default/sample playable world.
- Node 22 built-ins and vanilla ES modules; no build or npm install. npm start runs the original extended server.mjs. Preserve loopback/Host/Origin protection and fixed provider endpoints. Do not commit credentials, local connection storage, user saves or generated personal content.
- The original connection manager saves credentials with Windows DPAPI. Never expose them in browser summaries, exports, logs or git.
- Run npm run check and npm test. Separate mocked provider tests from live paid calls and browser verification.
- Original assets and layout must be checked against docs/ORIGINAL-BASE.md. Preserve old v1 IndexedDB data; the replacement uses gacha-game-worlds and v2 exports.
