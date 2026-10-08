# Sahra: project guide

Sahra (Arabic for "desert") is a full-screen generative scene of wind moving over desert sand. Tens of thousands of particles form flowing dune lines that drift on their own; the visitor's cursor or finger is a gust of wind that scatters the sand, which then settles back; the light shifts slowly between dawn, midday and dusk. Minimal content sits on top (name, one line, a "Hire on Upwork" button and a few links). It is the homepage of a fictional design studio, labeled as a portfolio project in the footer. A Lab page (`/lab/`) adds two studies: a self-drawing SVG geometric pattern and a GSAP scroll story. The scene also ships as an embeddable script for Webflow, WordPress and other sites.

This is a public portfolio project proving creative front-end work. Performance, accessibility and a clean commit history matter as much as the visuals. Every technique must be explainable in a client interview, especially the shaders, the adaptive quality system and the loading strategy.

The project name lives only in `src/config.ts` (`SITE_NAME`). HTML pages use the `%SITE_NAME%` token, which a small plugin in `vite.config.ts` replaces at build time; never hard-code the name in `src/` or in HTML. The docs (`README.md`, this file) use it by name.

## Stack

- Vite 8, TypeScript 6.0 in strict mode plus `noUncheckedIndexedAccess`. TypeScript 7 waits until typescript-eslint supports it (it accepts up to 6.0 today)
- Plain Three.js (no React) with custom GLSL shaders for the scene
- GSAP 3 with ScrollTrigger, for the Lab scroll story only (free for any use under GSAP's own "standard no-charge" licence, which is not an OSI open-source licence; installed from npm, never committed)
- Tailwind CSS v4 through its Vite plugin; self-hosted fonts
- Vitest (unit), Playwright (end-to-end, with axe accessibility checks), Lighthouse CI
- GitHub Actions CI; Vercel hosting with a preview deployment per branch
- pnpm 11; Node 24. `engines.node` in `package.json` is the single source of truth for the Node version (Vercel and CI both read it)

## Non-negotiable rules

1. **Smooth on real phones.** The target is a steady 60 fps on a mid-range Android phone. Particles are points or instances whose motion is computed in shaders; per frame, JavaScript only updates a few uniforms, never per-particle data.
2. **Adaptive quality.** The device pixel ratio is capped, the particle count is chosen by device capability, and a runtime frame-rate monitor steps quality down automatically when frames drop.
3. **Fast first paint.** The text content and a static poster of the scene are in the HTML and render immediately; Three.js loads afterwards, so the Largest Contentful Paint never waits for WebGL. No layout shift. Lighthouse on mobile: Performance 90+, Accessibility, Best Practices and SEO 95+, enforced in CI.
4. **Graceful fallbacks.** Without WebGL2, on low-power devices, or when the visitor prefers reduced motion, the static poster shows (for reduced motion, a still frame with no drift). The page is always fully usable.
5. **Respect the device.** Rendering pauses when the tab is hidden or the scene is scrolled out of view; GPU resources are released on teardown.
6. **Readable content.** Text keeps WCAG AA contrast over every lighting state (checked by a test, not by eye); keyboard navigation and visible focus everywhere; the canvas is decorative and hidden from screen readers.
7. **Touch is a first-class input.** Finger drags create gusts; nothing depends on hover.
8. **Honest copy.** No em dashes or en dashes anywhere in site copy (use a hyphen, comma, period or colon). No fake clients, testimonials, awards or metrics.
9. **Small, reviewable steps.** Each meaningful step ends with a stop for Mostafa's review and a suggested Conventional Commits message (`feat:`, `fix:`, `refactor:`, `perf:`, `test:`, `docs:`, `ci:`, `chore:`). Mostafa commits and pushes himself; Claude never commits or pushes unless he asks.

## Code conventions

- Prettier formats everything (Tailwind classes are sorted automatically). ESLint (`strictTypeChecked`) must pass with zero warnings.
- No `console.log`; `console.warn`/`console.error` only for real failures. No commented-out code, no unused code, no empty `catch` blocks, no abstractions for single-use code.
- Never listen to `window` scroll events. Use GSAP ScrollTrigger, IntersectionObserver or CSS scroll-driven animations.
- Design follows the `design-taste-frontend` skill for the content layer and the Lab: one theme for the whole site (dark), one accent color, one corner-radius system, icons from a library. Hand-drawn SVG is allowed only where the brief asks for it (the Lab's geometric drawing).
- Fonts: open-license (OFL) only, because the repo is public and the font files ship in it. Self-hosted in `src/fonts/` with its licence, preloaded, `font-display: optional` (a late font is skipped for that visit instead of swapped in, so text never moves) and metric-matched fallback faces (`Instrument Sans Arial`, `Instrument Sans Roboto`), each under its own family name.
- Config files (`vite.config.ts` and friends) import local TypeScript with an explicit `.ts` extension, which Vite's upcoming native config loader requires.

## The text layer

- One composition over the scene: the studio's name (`h1`), one line, one action ("Hire on Upwork", an amber pill, to Mostafa's Upwork profile) and two quiet links ("The Lab" and "Source on GitHub", in that order for the keyboard). Mostafa dropped the brief's Calendly "Book a call" on 2026-10-08; there is one contact action, so no second link with the same intent. A footer says plainly that the studio is fictional and the site a portfolio project. Copy: no em or en dashes, no invented clients, numbers or praise.
- The text sits in the sky, above the dunes, on every screen shape; `.text-scrim` (`src/style.css`) is a soft dark wash behind it for wide windows where far dunes reach up, and the footer sits on a dark gradient over the near sand. Both work on the poster too.
- Design (per the `design-taste-frontend` skill): Instrument Sans; one accent, the dusk amber `--color-accent` (#efa463, also the icon's sun), used for the one action's fill, hover and focus; text in neutrals; left-aligned, airy, dark only (the scene and poster are a dark desert). The icon (`src/favicon.svg`) is a single geometric mark: the sun half set behind the horizon.
- Readability is measured, not assumed: `e2e/readability.spec.ts` sets six points of the light cycle at the densest tier, makes the text transparent, measures the background behind every text element from screenshots (95th-percentile pixel: the scene, haze and wash together) and checks WCAG AA against each text's colour. Lowest measured: footer 9:1, "Hire on Upwork" (dark ink on the amber pill) 9.6:1, the line 14.6:1, the GitHub link 15.9:1, name 18.4:1. Computed colours can come back as `oklch()`: the test converts them by painting a pixel.

## The Lab

`lab/index.html` (served at `/lab/`): the same font, header link home, "Hire on Upwork" and footer as the home page; no scene and no Three.js. Studies of the kind clients ask for, each built to stay light on a phone:

1. **A pattern that draws itself.** Eight-point stars in the tradition of Islamic geometric art, built with Hankin's "polygons in contact" method on the octagon and square tiling (4.8.8): from the middle of every edge, two lines leave into each tile at the contact angle and run until they meet the neighbouring edge's line. Octagons get eight-point stars, squares small four-point stars, and every line crosses an edge straight into the next tile. The contact angle is 60 degrees (67.5, the other classic choice, crowds the stars with overlapping kites; compared side by side from 45 to 72).
   - `src/lab/pattern.ts` computes the tiling and the stars and writes the `<svg>`. It runs at build time only, through the `sahra:lab-pattern` plugin in `vite.config.ts`, which replaces `%LAB_PATTERN%` in the page: the drawing is plain SVG in the HTML, so no script draws it, it paints with the page and cannot shift the layout. Unit tests (`pattern.test.ts`) check the tiling (sides 1, no gaps), the exact meeting points (law of sines), the eightfold symmetry, and that lines run straight across shared edges.
   - The drawing is 960 by 640 units (3 by 2), four octagons tall, and covers its figure: 3 by 2 from `sm` up, a square on phones (`preserveAspectRatio="xMidYMid slice"` crops the sides and keeps the centre star in the middle). Strokes are in the drawing's units, so `src/lab/lab.css` sets thicker ones below 40rem to keep lines about 1 px wide.
   - Three groups: the tiling's octagon outlines (the construction lines; the squares are the gaps between them), the small stars (dim, neutral-600) and the large stars (neutral-300; they lead). Every path has `pathLength="1"` and `--order` (0 at the centre tile, 1 at the farthest).
   - `src/lab/lab.css` draws it: `stroke-dasharray: 1 1` and an animation of `stroke-dashoffset` from 1 to 0, delayed by `--order`. The grid sketches itself, the stars draw from the centre out (about 4 s in all), the grid fades to a faint trace, and a slow wave of amber light keeps passing outwards over the large stars (a `stroke` animation, every 10 s). At rest every line is whole, so with reduced motion nothing animates and the finished drawing shows.
   - `src/lab/main.ts` only gates it: the figure (`.drawing`) has `is-offscreen` until an IntersectionObserver sees 30% of it, so on a short screen the drawing waits for the visitor, and the light pauses while it is off screen. "Draw it again" (shown only with JavaScript and motion allowed) sets `is-restarting` for a moment, which removes the animations so they start anew. The button is `invisible` (not `hidden`) until the script shows it, so its room is kept and nothing moves: CI caught the text beside the drawing jumping 37 px when a slower machine painted before the script ran.
   - Cost, measured with `requestAnimationFrame` in Chromium on a 2015 laptop GPU (Intel HD 4600), phone profile, CPU slowed four times: usually 60 fps both while drawing and with the light idling (over several runs on a busy machine: 52 to 60 idle, 43 to 60 drawing). The light repaints about 35 lines a frame, which is cheap where Chrome rasterizes on the GPU, as on phones. A compositor-only alternative (an amber ring blended over the drawing with `mix-blend-mode`) measured worse with a GPU and much worse without one, since a blended render surface costs more than the lines, so it was dropped. Measure on a real GPU (Playwright with `--use-angle=d3d11`): headless Chromium without one rasterizes and composites on the CPU, which makes SVG animation look several times slower than it is.

2. **A story told by scrolling.** Pinned panels, staged reveals and a horizontal pan, the kind of scroll story restaurants and brands ask for, about how a dune moves and one day on the dunes. All copy is honest: the facts about sand are general (saltation), and the pictures are stills of this site's own scene.
   - The markup in `lab/index.html` is a complete page on its own: every line shown, and the day's pictures in a row that scrolls sideways by itself (`overflow-x: auto`, scroll snap, `tabindex="0"` with a label so keyboards can scroll it). That is what visitors get with reduced motion or without JavaScript.
   - `src/lab/main.ts` imports `src/lab/story.ts` (GSAP and ScrollTrigger, their own chunk, about 43 kB gzipped) once the page is idle (`whenPageIsIdle`, `src/when-idle.ts`, shared with the home page), and never with reduced motion. `startStory` marks the section `data-enhanced` (from then `lab.css` makes the row as wide as its pictures, no longer scrolling or snapping), takes the row out of the tab order and shows the progress line (kept `invisible` until then, like the button, so nothing moves).
   - Part one pins (`pin: true`) for two screens of scrolling while each line comes up in turn and the one before steps back to 40% opacity (3.7:1, above the 3:1 AA asks of large text); lines waiting their turn are fully transparent, so no faint text is ever on screen (screen readers still read them). Part two pins for as long as the row is wider than the window, and the scroll slides the row left by exactly that much (`invalidateOnRefresh` recomputes it on resize), with an amber progress line. `scrub: 0.6` lets the motion trail the scroll slightly, which smooths a flick of the wheel. `ignoreMobileResize` stops phones' address bar from re-laying out the pins.
   - GSAP fixes a pinned element's width and moves its margins to the pin spacer, so the row's full-width bleed (negative margins) sits on a wrapper around the pinned element, never on it.
   - The last panel's link ("See it move") sits off screen until the pan reaches it: focusing it from the keyboard scrolls the page to the end of the pan.
   - The pictures are stills of the live scene at dawn, midday and dusk (`src/lab/stills/`, square WebP at 720, 1080 and 1440 wide, lazy-loaded), captured by `pnpm stills` (`scripts/capture-stills.ts`): it opens the scene at `?quality=high&tune`, jumps the light through the tuning panel, hides the text and the panel and lets the browser encode WebP. The page crops them to 3 by 2 (4 by 5 on phones) with `object-fit: cover`. The scene keeps moving, so a new capture is never quite the same picture; capture them again when the scene's look changes.
   - Cost, measured the same way as the drawing (a real GPU, phone profile, CPU slowed four times) while scrolling steadily through the whole story: 59.5 fps, the 95th-percentile frame 16.7 ms. The motion is only transforms and opacity. Lighthouse (mobile) for the Lab with GSAP loaded: 99 in all five runs, no layout shift.

## How the pages are built

- Vite builds two pages (`build.rolldownOptions.input`: `home` is `index.html`, `lab` is `lab/index.html`), each with its own entry script (`src/main.ts`, `src/lab/main.ts`).
- What both pages load is grouped into one chunk with a plain name (`output.codeSplitting.groups`, name `shared`): `src/style.css` (Tailwind, fonts, theme) becomes `shared-*.css`, and `src/when-idle.ts` with Vite's preload helper (both pages load chunks on demand) `shared-*.js`. Without the group, Rolldown names the shared chunk after whichever module comes first (it once came out as `preload-helper-*.css`).
- The modulepreload polyfill is off (`build.modulePreload.polyfill: false`): every browser this site supports has modulepreload, and the polyfill would be a shared script request on both pages.

## How the scene loads

1. The HTML holds the content and an empty, `aria-hidden` scene container (`[data-scene]`, fixed behind the content), so the content paints with almost no JavaScript (the entry script is about 1.5 kB gzipped).
2. `src/main.ts` waits for the `load` event and then an idle moment, so the scene never competes with the content's first paint, and calls `mountScene` (`src/scene/mount.ts`) with the URL's flags: `?quality` (`force` and `lockedTier`), `?debug`, `?tune`. The scene reads no URL itself.
3. `mountScene` creates the canvas and a WebGL2 context itself, before downloading anything, asking with `failIfMajorPerformanceCaveat` (and checking the renderer's name too). No WebGL2 (`unsupported`) or WebGL only in software (`low-power`: no GPU, so SwiftShader and the like; slow, and it makes the whole page sluggish) means the poster stays and Three.js is never downloaded. `?quality` in the URL (any value) asks for the scene anyway.
4. Only then is `src/scene/scene.ts` imported. It is a separate chunk (Three.js, about 130 kB gzipped), and Three.js reuses that context.
5. Startup runs in short tasks (`nextTask()` between creating the renderer, building the grains and compiling), so the browser can respond in between. Shaders compile with `renderer.compileAsync` (non-blocking where the browser supports parallel shader compilation); the first frame is drawn, and only then does the canvas fade in.
6. With `prefers-reduced-motion: reduce`, one still frame is drawn and no animation loop starts.

The container's `data-state` records the scene's state: `unsupported` (no WebGL2), `running` (on screen), `failed` (could not start), `lost` (the browser took WebGL away for now; Three.js restores itself and the state returns to `running`) or `low-power` (too slow even at the lightest quality). The canvas shows only while `running` (its opacity and fade are inline styles set by `mountScene`, so they work on any page, not only with this site's CSS), so in every other state the poster beneath it shows. Tests wait on the state instead of on timers.

## Adaptive quality, pausing and cleanup

- `quality.ts` defines four tiers, `high`, `medium`, `low` and `minimal`, each with fewer grains (lines times points per line) and a lower pixel-ratio cap. `initialTier` picks the starting one from the device: a software WebGL renderer (SwiftShader, llvmpipe) starts at `minimal`; data saver, two cores or two GB of memory at `low`; desktops with four cores or more at `high`; phones by memory and cores (Safari reports no memory: treated as 4 GB, so `medium`).
- `frame-monitor.ts` judges the frame rate: after a one-second warmup it looks at a 1.5 s window, and when the 75th-percentile frame takes longer than the budget it is given, it says so and starts over. Above 22 ms (below about 45 fps) the scene steps down one tier (new geometry, new pixel ratio). It never steps up: no flip-flopping. At `minimal` the budget is 40 ms (below about 25 fps), because giving up for the poster is a much bigger step than a lighter tier. (Software-only WebGL never gets here: `mountScene` does not start the scene there, unless `?quality` asks for it.) A slow verdict at `minimal` freezes the scene and reports `low-power`; `mountScene` lets the canvas fade out to the poster, then calls `stop()` and removes the canvas.
- The loop runs only when it is worth it: not with reduced motion, not while the tab is hidden (`visibilitychange`), not while the canvas is off screen (IntersectionObserver; matters for embeds), not while WebGL is lost, not after `low-power` or `stop()`. The scene's clock stands still while paused, so it resumes where it left off, and the monitor restarts on resume (it has no pause logic of its own, so any long gap it sees is a slow frame).
- `?quality=high|medium|low|minimal` locks the tier and turns adaptation off (no stepping down, no giving up): for screen recordings and comparing tiers by eye. `?quality=auto` keeps the automatic tiers. Any `?quality` also runs the scene on software-only WebGL. Headless Chromium has only software WebGL, so on the plain URL the end-to-end tests see the poster (one test checks exactly that); tests about the running scene use `STEADY_SCENE` (`/?quality=minimal`), tests about adaptation `ADAPTIVE_SCENE` (`/?quality=auto`).
- `?debug` opens an overlay (`debug.ts`, its own lazy chunk) with the frame rate, the slowest quarter of frames, the tier, grains, pixel ratio, canvas size, state and renderer, updated every second. It is how the real-device numbers in `docs/performance.md` are measured.
- `stop()` removes every listener and observer, disposes geometries and materials, disposes the renderer and calls `WEBGL_lose_context` to free GPU memory at once.
- Tests: `quality.test.ts` and `frame-monitor.test.ts` cover the rules; end-to-end tests cover pausing on a hidden tab and the fallback (Chrome's CPU throttled 30 times through the DevTools protocol). Headless Chromium reports SwiftShader, so the end-to-end tests run at `minimal`.

GLSL lives in `src/scene/shaders/*.glsl`, imported as strings with Vite's `?raw` suffix. `noise.glsl` (simplex noise from webgl-noise, MIT) is prepended to the vertex shader in `scene.ts`.

## How the dunes work

- Each point's `position` is not a place: it packs its layout (place along its line, which line, a fixed random number), built once by `createDuneGeometry` in `dunes.ts` with a seeded random generator, so the sand is laid out the same on every visit. Lines are stored farthest first, so nearer sand draws over farther sand.
- The vertex shader computes everything else, every frame: line depth (evenly spaced in inverse depth, so evenly spaced on screen), line width (the view's width at that depth, from `uAspect`), the downwind drift (wrapping at the edges), the noise flow field, the dune height (ridged noise with a warp, creeping downwind), a flatter foreground (so the nearest lines stay below the bottom edge), sun shading, point size, haze and fading.
- Per frame, JavaScript only updates a few uniforms (time and the light). Tunable values live in `src/scene/settings.ts`; grain counts come from the quality tier.

## How the light works

- `lighting.ts` holds three keyframes, `DAWN`, `MIDDAY` and `DUSK` (sky top, horizon glow, ground, lit sand, shaded sand, sun direction), and `lightAt(phase)`, which eases between them: 0 dawn, 1/3 midday, 2/3 dusk, 1 dawn again. It writes into an existing object, so the render loop allocates nothing.
- Each frame, `scene.ts` computes the phase (`startPhase` plus elapsed time over `cycleSeconds`, 180 s by default), gets the light and copies it into uniforms; the shaders do the rest. Colours are display (sRGB) values that the shaders write out unchanged.
- The sky is a full-screen quad (`sky.*.glsl`) drawn before the dunes: the horizon glow fades up into the dark sky and lingers down as haze behind the far dunes; a low sun adds a bloom on its side (left at dawn, right at dusk); a faint per-frame grain also dithers the dark gradients against banding.
- The dunes are lit by the sun: one extra height sample gives each grain's slope, and faces toward the sun take the lit colour, the rest the shade colour. Far sand fades into the horizon colour; the nearest grains are drawn softer.
- Readability is a test, not a judgement: `lighting.test.ts` checks the page's text colours against the sky, the horizon (with the sun bloom, `SUN_GLOW`) and the ground at 300 points of the cycle, all at least 4.5:1. Sand grains behind the text are a Phase 4 concern (dimming the sand under the text).
- `?tune` adds `cycleSeconds` and `startPhase` (jump to a point of the cycle) to the panel.

## The poster

- Every visit starts the scene's clock at `startTime` (12 s) and the light at `startPhase` (0.62, dusk), so the first frame is always the same picture. The poster is that frame, captured from the real scene by `pnpm poster` (`scripts/capture-poster.ts`): it builds and serves the site, opens `/?quality=high` with reduced motion (one still frame at the densest tier; `?quality` is what makes headless Chromium's software WebGL run the scene at all), hides the text and the footer, screenshots the scene and lets the browser encode WebP (quality 0.6, `scripts/encode-webp.ts`) into `src/poster/`. The capture is deterministic: run again on an unchanged scene, it writes the same bytes.
- **Capture the poster again whenever the first frame changes**: settings, shaders, the light, the camera. Nothing checks this automatically.
- Two shapes, several widths: landscape (captured as a 1440 by 720 window at double resolution; 1440, 2048 and 2880 wide) and portrait for phones (430 by 932 at double resolution; 430 and 860 wide). Grains are sized in CSS pixels, so each is captured at a typical window size to look like the live scene. `index.html` picks portrait for screens taller than wide; `object-fit: cover` crops the sides, which keeps the live scene's vertical framing.
- The `<picture>` sits in the scene container; the canvas is absolutely positioned above it and fades in over it once the first frame is drawn. Without WebGL2 (or if the scene fails), the poster simply stays.
- It loads with `fetchpriority="low"`: it is decoration, the text is the content (and the Largest Contentful Paint). Even so, Lighthouse's simulated slow 4G counts its download alongside the first paint: locally about 2.1 s for the text's paint instead of about 1 s, scores 95 to 99. The next step if needed is a tiny inline blurred placeholder first, with the full poster loaded later. Grain is not what makes the files big (removing it changed nothing); the sharp sand grains are.

## How the gusts work

- `wind.ts` turns pointer and finger movement into gusts: each has a ground position (the screen point projected onto a plane at the dunes' average height; nothing in the sky), a direction, a strength from the pointer's speed, and a start time on the shader's clock (`performance.now()` seconds, like `uTime`).
- Movement is measured within the canvas's own box (`pointInBox`), and leaving the box ends the stroke; on the home page the box is the whole window.
- Gusts live in `GustField`: two flat `Float32Array`s that are the uniform values themselves (`uGustOrigins`, `uGustDirections`), `MAX_GUSTS` slots, the oldest replaced first. The vertex shader loops over them: each pushes nearby sand along its direction, scatters and lifts it, then lets it settle over the gust's life.
- `GustTrail` makes at most one gust per `gustLife / MAX_GUSTS` seconds, so a slot is never reused while its gust is still blowing (the sand would snap back). A stroke needs two samples for a speed; a pause over 0.25 s or a lifted finger starts a new stroke.
- Mouse and pen use pointer events; fingers use passive touch events, which keep arriving while the browser scrolls or zooms and never block either. Listeners are attached only when the scene animates (not with reduced motion).
- `?tune` in the URL opens a lil-gui panel (`tune.ts`, its own lazy chunk, about 8 kB gzipped) with sliders for the wind, flow, dune height, grain size and gusts, applied live to the uniforms. "Copy values" copies them as JSON for `settings.ts`. Visitors without `?tune` never download it.
- To see gusts while developing, use a real browser window or a headless script: the in-app preview pane, when hidden, pauses animation frames and throttles timers, so synthetic pointer events there arrive seconds apart and never form a stroke.

## Testing conventions

- **Unit tests (Vitest)** sit next to the code as `src/**/*.test.ts` and cover pure logic. Tests describe behaviour in plain words.
- **End-to-end tests (Playwright)** live in `e2e/` (`home.spec.ts`, `lab.spec.ts`, `readability.spec.ts`, `no-webgl2.spec.ts`) and run against the production build (`pnpm build && pnpm preview` on port 3301), in two profiles: `desktop` (Desktop Chrome) and `mobile` (Pixel 7: small viewport, touch). Import `test` and `expect` from `e2e/test.ts`, never from `@playwright/test`: its automatic fixture fails any test whose page logs a console error or throws.
- Every page gets an axe check (WCAG 2.2 AA tags plus best practices) with the scene running.
- Motion is checked by comparing two screenshots of the canvas half a second apart, as raw bytes (`Buffer.equals`). Never `expect(buffer).toEqual(buffer)` on screenshots: when it fails, building the diff takes minutes.
- Touch drags go through the DevTools protocol (`Input.dispatchTouchEvent`), since Playwright has no touch-drag helper; `sweepAcrossTheSand` in `e2e/home.spec.ts` uses it on the phone profile and the mouse elsewhere.
- Browser launch flags (`launchOptions`) can only be set at the top of a spec file, so a test that needs a different browser (like `e2e/no-webgl2.spec.ts`, which runs Chromium with `--disable-webgl2`) gets its own file.
- Headless Chromium renders WebGL in software (Playwright passes `--enable-unsafe-swiftshader`), so the scene tests work on CI machines without a GPU. It is slow: measured on the dune scene, about 60 frames a second at desktop size but about 12 on the phone profile, where drawing the large near grains dominates. Two such pages at once starve each other (even the canvas fade-in stalls), so Playwright runs with one worker.
- Scroll story tests wait for `storyPins` in `e2e/lab.spec.ts` (the section `data-enhanced` and both pin spacers given their padding) before reading any position: right after GSAP starts, ScrollTrigger has not laid out the pins yet. They scroll with `scrollTo` and poll, since `scrub` makes the motion trail the scroll.
- Layout stability is tested two ways on the Lab: the summed layout shift while it loads (with its script held back half a second, as on a slow phone) and, deterministically, `lays out the same before and after its script runs` (the script served empty, then normally; every part down to the story's first pin must sit in the same place). Whether the first paint comes before a module script depends on the machine, so the timing test alone can pass locally and fail on CI.
- A new test should be seen failing once: break the code it guards, run it, restore.

## Lighthouse and CI

- `pnpm lighthouse` (after `pnpm build`) runs Lighthouse CI five times on the mobile preset against every page in `dist/` (it finds `index.html` and `lab/index.html` by itself), served by Lighthouse CI's own static server (gzip, like Vercel). The budgets apply to each page. It fails when the median of the five values (`aggregationMethod: "median"`, which absorbs up to two slow, cold runs) is below Performance 90 or Accessibility, Best Practices, SEO 95, or layout shift is above 0.01. Never use `median-run`: Lighthouse CI picks that run by its first paint and time to interactive, not by score, and it once passed a build whose scores were 77, 77, 78, 89 and 93. Reports land in `.lighthouseci/` (open the `.html` files).
- CI machines have no GPU, so CI's Lighthouse measures what a visitor without one gets: the text and the poster, no Three.js. `scripts/check-lighthouse-path.ts` reports which version of the home page each run measured (the scene's script downloaded or not) and fails if those runs disagree or, with `LIGHTHOUSE_EXPECTS=poster` (set in CI), if any measured the scene; it also fails if another page (the Lab) loaded the scene. Locally, with a GPU, the home page's runs measure the live scene: run it without `LIGHTHOUSE_EXPECTS`. The live scene's cost is measured where there is a GPU (`docs/performance.md`), and its weight is gated in CI by `pnpm size` (`scripts/check-sizes.ts`, after `pnpm build`: the home page's script, the shared styles and script, the scene chunk, the font, the posters, and the Lab's page with its drawing, its script, its styles, the scroll story's GSAP chunk and the largest still at phone and laptop size, against fixed budgets).
- Lighthouse's own injected script (`_lighthouse-eval.js`) sometimes shows up as a long task of up to a second or so, mostly in the first, cold run; it is noise in Total Blocking Time that the median absorbs.
- The metric to watch is Total Blocking Time: Lighthouse simulates a slow phone CPU (4x), and Three.js's startup shows up there.
- GitHub Actions (`.github/workflows/ci.yml`) runs on pushes to `main` and on pull requests, in three jobs: format, lint, typecheck and unit tests; end-to-end tests; Lighthouse. Each job sets up through `.github/actions/setup` (pnpm from `packageManager`, Node from `engines.node`, frozen lockfile). Lighthouse reports are uploaded as an artifact on every run, the Playwright report on failure.
- Known variance: the first Lighthouse run on a fresh CI machine can be far slower (seen: Performance 72, Total Blocking Time 1.9 s, against 100 and about 30 ms for the warm runs). That cold run is the closest to a slow phone's first visit, so it is the number Phase 3 must bring down, not one to explain away.

## Deployment

- Vercel project `sahra` in the personal team `mostafa-saafan-s-projects`, connected to the GitHub repo. Production: https://sahra-khaki.vercel.app (`sahra.vercel.app` belongs to someone else). Every push to `main` deploys production; every other branch and pull request gets its own preview deployment. Previews sit behind Vercel's login by default (Standard Protection), so only team members can open them.
- Vercel reads the Node version from `engines.node` and the pnpm version from `packageManager`, and installs from the frozen lockfile; the build is `vite build` into `dist/` (detected, no settings needed).
- `vercel.json` only sets caching: files in `/assets/` have content hashes in their names, so they are cached for a year (`immutable`); HTML keeps Vercel's default (always revalidated), so a new deploy is seen immediately.
- `vercel link` writes a `.env.local` with a short-lived OIDC token and appends duplicate lines to `.gitignore`. The site needs no environment variables: delete the file and revert the `.gitignore` change.

## Dependencies

- Verify a package's current version and peer ranges (`npm view <pkg> version peerDependencies`) before adding it.
- pnpm 11 holds back releases younger than its minimum release age (a supply-chain safeguard). Don't add `minimumReleaseAgeExclude` entries; use the previous release and let the newer one age.

## Commands

```bash
pnpm dev            # dev server on http://localhost:3300
pnpm build          # production build into dist/
pnpm preview        # serve dist/ on http://localhost:3301
pnpm typecheck      # app code (tsconfig.json) and config files (tsconfig.node.json)
pnpm lint
pnpm format         # or format:check
pnpm test           # unit tests (Vitest); test:watch while working
pnpm test:e2e       # end-to-end tests (Playwright), builds and serves on 3301 first
pnpm lighthouse     # Lighthouse CI on dist/ (run pnpm build first)
pnpm size          # size budgets for dist/ (run pnpm build first)
pnpm poster         # capture the poster (the scene's first frame) into src/poster/
pnpm stills         # capture the Lab's dawn, midday and dusk stills into src/lab/stills/
```

Playwright reuses a server already running on port 3301 outside CI, so stop any `pnpm preview` left running before trusting a local end-to-end run against changed code.

## Folder structure

```
index.html           home page: text layer, poster, font preload, icon (content first, scripts after)
lab/index.html       the Lab page; %LAB_PATTERN% becomes the drawing at build time
src/
  config.ts          SITE_NAME, the single place for the project name
  main.ts            entry for the home page: reads its URL flags, mounts the scene when idle
  when-idle.ts       whenPageIsIdle: after the load event and an idle moment (both pages)
  lab/
    pattern.ts       the Lab's drawing: tiling, Hankin's stars, the SVG (build time; pattern.test.ts)
    lab.css          draws it: dash offsets from the centre out, the grid fading back, the light;
                     the scroll story's row once GSAP drives it
    main.ts          entry for the Lab: holds the drawing until on screen, "Draw it again", loads
                     the scroll story when idle
    story.ts         the scroll story: GSAP ScrollTrigger pins, staged reveals, the horizontal pan
    stills/          dawn, midday and dusk stills of the scene for the pan (pnpm stills)
  style.css          Tailwind, the font faces, theme tokens (font, accent), the text scrim
  fonts/             Instrument Sans (Latin, variable weight) and its OFL licence
  favicon.svg        the icon
  poster/            the poster, landscape and portrait WebP at several widths (pnpm poster)
  scene/
    mount.ts         checks WebGL2, adds the canvas, loads the scene, keeps data-state
    scene.ts         renderer, dunes, sky, uniforms, render loop, tiers, pausing, stop(), ?tune wiring
    quality.ts       quality tiers and the starting tier from device signals (quality.test.ts)
    frame-monitor.ts judges the frame rate for stepping quality down (frame-monitor.test.ts)
    camera.ts        the camera and the near and far depths (shared with the tests)
    lighting.ts      the dawn, midday and dusk keyframes, lightAt, contrastRatio (lighting.test.ts)
    wind.ts          gusts: GustField (uniform arrays), groundPoint, GustTrail, listeners (wind.test.ts)
    tune.ts          the ?tune panel (lil-gui), loaded only with that flag
    debug.ts         the ?debug overlay (frame rate, quality, renderer), loaded only with that flag
    dunes.ts         the points' layout and the seeded random generator (unit-tested in dunes.test.ts)
    settings.ts      tunable values: wind, flow, dune height, grain size, gusts, light cycle, start
    shaders/         noise.glsl; dunes.vert.glsl (all motion, sun shading), dunes.frag.glsl (soft
                     grains, haze); sky.vert.glsl and sky.frag.glsl (gradient, sun bloom, grain)
e2e/
  test.ts            Playwright test + expect, failing on page errors
  *.spec.ts          end-to-end specs
scripts/
  check-lighthouse-path.ts    which page Lighthouse measured (scene or poster); fails on a mix or a mismatch
  check-sizes.ts              size budgets for the built files (pnpm size)
  capture-poster.ts           captures the poster from the real scene (pnpm poster)
  capture-stills.ts           captures the Lab's stills from the real scene (pnpm stills)
  encode-webp.ts              WebP encoding in the browser, for both capture scripts
.github/
  workflows/ci.yml   checks, end-to-end and Lighthouse jobs
  actions/setup/     shared pnpm + Node + install steps
lighthouserc.json    Lighthouse CI: runs, Chrome flags, score budgets
vercel.json          Vercel: long caching for /assets/
vite.config.ts       Tailwind, the %SITE_NAME% and %LAB_PATTERN% plugins, the two pages, ports
vitest.config.ts     unit tests: src/**/*.test.ts
playwright.config.ts desktop + mobile profiles against the production build
tsconfig.json        app code (browser types)
tsconfig.node.json   config files, e2e/ and scripts/ (Node types, plus DOM for code run in the page)
```

## Status

Phases 0 to 4 done and live (scene, light, poster, adaptive quality, text layer; measurements in `docs/performance.md`; the Calendly booking was dropped, the action is "Hire on Upwork"). Phase 5 (the Lab) is on `feature/sahra-lab` (draft PR #4): the self-drawing pattern and the GSAP scroll story are done; next, Mostafa's review on his phone, then merge. Phases: 0 setup, 1 scene prototype, 2 art direction, 3 performance and adaptivity, 4 content layer and booking, 5 Lab, 6 embeddable package, 7 docs and portfolio packaging.
