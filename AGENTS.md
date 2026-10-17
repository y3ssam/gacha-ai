# Development rules

- Official repository: y3ssam/gacha-ai. This is an independent browser-based single-player RPG.
- Use vanilla ES modules, relative asset paths, Node.js 22+ built-ins for the local API bridge. No build or npm install is needed.
- Keep combat, currency, probability, pity, materials, progression and reward grants in src/engine.js. AI only provides validated descriptive content.
- Do not commit any real service-account JSON, private key, token, local save or generated user content.
- Credentials remain in bridge process memory. Pairing code required; listen on loopback only. No wildcard CORS, arbitrary upstream URLs or secret logging.
- All player progression and generated images live in browser IndexedDB, separated per world. Do not add a server player database.
- Preserve confirmed lore and characters across generation; send previous summaries and choices to the next scenario generation.
- Keep healer/support basic actions non-offensive and validate generated role/skill contracts.
- Keep Korean UI functional and compact. No unsolicited slogans. Use actual game imagery, responsive layouts and accessible controls.
- GitHub Pages must work under /gacha-ai/ with relative paths. The bridge is a separate local process, never deployed as a Pages server.
- Run npm run check and npm test before committing. State explicitly when live AI or browser visual verification could not be run.
- Do not claim production balance or actual provider connectivity from mock/unit tests.
