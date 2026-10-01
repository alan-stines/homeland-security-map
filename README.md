# MGA Global Threat Watch

A static, GitHub Pages-compatible homeland security exercise dashboard. Open `index.html` or serve this folder with `python -m http.server 8080`.

Designed for unattended full-screen TV display, with a fixed viewport layout and no scrolling. The world map fills the display area, with compact readiness and highlighted-event overlays, a three-bulletin strip, and a single latest-event ticker. Category icons beside Pause toggle the map layers. Use the Full screen button after opening the page.

Fictional events arrive every 5–8 simulation seconds and live for 38–65 simulation seconds before fading and clearing. The seeded opening events clear gradually after 28–63 simulation seconds. Readiness controls the simulation clock: level 5 runs at 0.5×, level 4 at 0.75×, level 3 at 1×, level 2 at 2×, and level 1 at 4×. Click a numbered level or choose it in the dropdown. Changing level immediately speeds up or slows down the remaining arrival timers, existing event lifetimes, spotlight rotation, and map animations without resetting events. At level 5, arrivals take about 10–16 real seconds; at level 1, about 1.25–2 seconds. The next-arrival countdown shows real seconds and the event log shows simulation time.

New arrivals show expanding rings; aging events dim in their final five simulation seconds. The highlighted location rotates every nine simulation seconds. The catalog contains 60 fictional scenarios and 18 vector icons, including wildfire, blizzard, volcanic ash, floods, hazmat, aviation, rail, rescue, medical logistics, and communications. Opening events span multiple continents; a shuffled catalog gives every scenario a turn before repeating. Event history and the active marker collection remain bounded.

Rendering reuses unchanged markup and SVG markers. Timer-only display updates run at most once per second, while arrivals, clearing, and controls update immediately. Bulletin progress uses transforms instead of rebuilding cards. The full-map scanning animation was removed to reduce repaints, and simulation work pauses while the page is hidden. The clock uses elapsed real time to preserve readiness speeds when timer callbacks drift.

Run `node simulation.test.cjs` for catalog validation, no-repeat selection, all readiness speeds, pause/hidden-tab behavior, cached markup, and a 10,000-tick fast-mode soak test.

Includes category filters, pause/advance controls, keyboard-accessible markers, and a manually selected five-level DEFCON-style exercise readiness indicator. Pause freezes event aging and animation; Next event can still add an event manually. All incidents are fictional; no live intelligence, weather feeds, or official alert levels are represented. Levels run from 5 (routine) to 1 (critical) and do not change automatically.

No build or dependencies are required. Map geometry and the MGA logo are reused from the public MGA threat-sim project. Typography uses Google Fonts with system fallbacks. The dashboard itself and map work without network access after downloading the files.

For GitHub Pages, publish the repository root from the main branch. This project has not been deployed by this change.
