# Development rules

- Official repository: y3ssam/gacha-ai. This is an independent browser-based single-player RPG.
- Use vanilla ES modules, relative asset paths, Node.js 22+ built-ins for the local API bridge. No build or npm install is needed.
- Keep combat, currency, probability, pity, materials, progression and reward grants in src/engine.js, src/events.js and src/progression.js. AI only provides validated descriptive content.
- Do not commit any real service-account JSON, private key, token, local save or generated user content.
- Credentials remain in bridge process memory. Pairing code required; listen on loopback only. No wildcard CORS, arbitrary upstream URLs or secret logging.
- All player progression and generated images live in browser IndexedDB, separated per world. Do not add a server player database.
- Preserve confirmed lore and characters across generation; send previous summaries and choices to the next scenario generation.
- Keep healer/support basic actions non-offensive and validate generated role/skill contracts.
- Keep Korean UI functional and compact. No unsolicited slogans. Use actual game imagery, responsive layouts and accessible controls.
- GitHub Pages must work under /gacha-ai/ with relative paths. The bridge is a separate local process, never deployed as a Pages server.
- Run npm run check and npm test before committing. State explicitly when live AI or browser visual verification could not be run.
- Do not claim production balance or actual provider connectivity from mock/unit tests.

- New world generation is staged in src/generation.js: bible, engine-owned character appearance slots, separate default outfits, enemy registry, 4-chapter campaign batches, banner. Validate references and persist checkpoints before advancing.
- Never reroll frozen costume candidates on reload. Award only prepared images; cosmetic selection never changes stats. Check full requested draw budget before sampling randomness, then debit performed draws only.
- Event progress is collected during active windows; grace permits claims/exchanges only. Keep prior season currency and claims separate. Settle each battle once, and never grant expired event currency to a new season.
- Periodic Vertex releases run only in the open connected client, with per-cycle idempotency and no offline backlog. Failed cycles require manual retry; NAI calls stay tied to user game actions.
- Preserve saved stories when adding characters. New characters may join only unread chapters via registered guest ids. Existing v1 saves must migrate without resetting currency, roster, or pity.

- Character visual identity lives in naiAppearance (all defined fields), compiled identityPrompt, and a separate default outfitPrompt. Generate wardrobe after appearance; costume clothingPrompt never replaces immutable identity fields.
- Use src/image-prompts.js for portraits, banners, CGs and costumes. Never flatten multiple characters into a base caption. Paid requests must contain one NAI char_caption/centers entry per visible person with aligned negative slots.
- CG/banner manifests must list known character ids (protagonist has its own profile), clothing references, actions and distinct positions. Base caption is scene/style only. Reject missing/unknown/overlapping cast, more than six people, and unsupported NAI model versions rather than silently merging or truncating.
- Preserve old art, owned outfit ids and narrative on migration. Upgrade legacy character/wardrobe/CG prompts lazily from confirmed content; retries must keep per-character prompt metadata.

- Keep the game inside the centered 1600×900 logical stage with light gray outer gutters. Use src/viewport.js for scaling; preserve frame-scoped overlays and native-dialog focus behavior. Scroll content inside main/dialog rather than the document.
- Render character art through src/portraits.js: crop each atlas cell first, preserve native aspect ratio, and keep base-gallery art independent of selected costumes. Do not reintroduce stretched 400%/100% sheet backgrounds or duplicate portrait overlays on generated banners.
- User-designated ongoing reference: https://github.com/y3ssam/gacha-game (reviewed 6ae30d1c1f44edd5b9ad85f5dcb1f21d88d3d716). Consult its index.html, asset manifests/READMEs and generation prompts for UI, equipment, materials and dungeon art direction. Implement in y3ssam/gacha-ai; preserve this project's saved data and engine contracts when adapting ideas. See docs/UI-REVIEW.md for the current mapping.
- Follow the reference's actual game-screen hierarchy: 72px player/resources header, 72px bottom navigation, opaque reading surfaces, 24/28px content padding. Body text 16px and secondary text at least 14px in logical coordinates; keep primary actions readable and reserve gold for rarity/reward emphasis.
- Character detail is divided into six sections and settings into connection/saves/image history. Keep growth/equipment/gallery/API actions reachable in their corresponding sections; tab switches must not mutate progression or trigger paid generation. Summon actions and guarantees stay in the dedicated footer. See docs/UI-REVIEW.md for selector-level comparison.
