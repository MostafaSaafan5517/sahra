# Sahra: project guide

Sahra (Arabic for "desert") is a full-screen generative scene of wind moving over desert sand. Tens of thousands of particles form flowing dune lines that drift on their own; the visitor's cursor or finger is a gust of wind that scatters the sand, which then settles back; the light shifts slowly between dawn, midday and dusk. Minimal content sits on top (name, one line, a few links, a "Book a call" button opening a Calendly overlay). It is the homepage of a fictional design studio, labeled as a portfolio project in the footer. A Lab page adds two studies: a self-drawing SVG geometric pattern and a GSAP scroll story. The scene also ships as an embeddable script for Webflow, WordPress and other sites.

This is a public portfolio project proving creative front-end work. Performance, accessibility and a clean commit history matter as much as the visuals. Every technique must be explainable in a client interview, especially the shaders, the adaptive quality system and the loading strategy.

The project name lives only in `src/config.ts` (`SITE_NAME`). HTML pages use the `%SITE_NAME%` token, which a small plugin in `vite.config.ts` replaces at build time; never hard-code the name in `src/` or in HTML. The docs (`README.md`, this file) use it by name.

## Stack

- Vite 8, TypeScript 6.0 in strict mode plus `noUncheckedIndexedAccess`. TypeScript 7 waits until typescript-eslint supports it (it accepts up to 6.0 today)
- Plain Three.js (no React) with custom GLSL shaders for the scene
- GSAP with ScrollTrigger, for the Lab scroll story only
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

- One composition over the scene: the studio's name (`h1`), one line, one action ("Hire on Upwork", an amber pill, to Mostafa's Upwork profile) and one quiet link ("Source on GitHub"). Mostafa dropped the brief's Calendly "Book a call" on 2026-10-08; there is one contact action, so no second link with the same intent. A footer says plainly that the studio is fictional and the site a portfolio project. Copy: no em or en dashes, no invented clients, numbers or praise.
- The text sits in the sky, above the dunes, on every screen shape; `.text-scrim` (`src/style.css`) is a soft dark wash behind it for wide windows where far dunes reach up, and the footer sits on a dark gradient over the near sand. Both work on the poster too.
- Design (per the `design-taste-frontend` skill): Instrument Sans; one accent, the dusk amber `--color-accent` (#efa463, also the icon's sun), used for the one action's fill, hover and focus; text in neutrals; left-aligned, airy, dark only (the scene and poster are a dark desert). The icon (`src/favicon.svg`) is a single geometric mark: the sun half set behind the horizon.
- Readability is measured, not assumed: `e2e/readability.spec.ts` sets six points of the light cycle at the densest tier, makes the text transparent, measures the background behind every text element from screenshots (95th-percentile pixel: the scene, haze and wash together) and checks WCAG AA against each text's colour. Lowest measured: footer 9:1, "Hire on Upwork" (dark ink on the amber pill) 9.6:1, the line 14.6:1, the GitHub link 15.9:1, name 18.4:1. Computed colours can come back as `oklch()`: the test converts them by painting a pixel.

## How the scene loads

1. The HTML holds the content and an empty, `aria-hidden` scene container (`[data-scene]`, fixed behind the content), so the content paints with almost no JavaScript (the entry script is about 1.5 kB gzipped).
2. `src/main.ts` waits for the `load` event and then an idle moment, so the scene never competes with the content's first paint.
3. It creates the canvas and a WebGL2 context itself, before downloading anything, asking with `failIfMajorPerformanceCaveat` (and checking the renderer's name too). No WebGL2 (`unsupported`) or WebGL only in software (`low-power`: no GPU, so SwiftShader and the like; slow, and it makes the whole page sluggish) means the poster stays and Three.js is never downloaded. `?quality` in the URL (any value) asks for the scene anyway.
4. Only then is `src/scene/scene.ts` imported. It is a separate chunk (Three.js, about 130 kB gzipped), and Three.js reuses that context.
5. Startup runs in short tasks (`nextTask()` between creating the renderer, building the grains and compiling), so the browser can respond in between. Shaders compile with `renderer.compileAsync` (non-blocking where the browser supports parallel shader compilation); the first frame is drawn, and only then does the canvas fade in.
6. With `prefers-reduced-motion: reduce`, one still frame is drawn and no animation loop starts.

The container's `data-state` records the scene's state: `unsupported` (no WebGL2), `running` (on screen), `failed` (could not start), `lost` (the browser took WebGL away for now; Three.js restores itself and the state returns to `running`) or `low-power` (too slow even at the lightest quality). CSS shows the canvas only while `running`, so in every other state the poster beneath it shows. Tests wait on the state instead of on timers.

## Adaptive quality, pausing and cleanup

- `quality.ts` defines four tiers, `high`, `medium`, `low` and `minimal`, each with fewer grains (lines times points per line) and a lower pixel-ratio cap. `initialTier` picks the starting one from the device: a software WebGL renderer (SwiftShader, llvmpipe) starts at `minimal`; data saver, two cores or two GB of memory at `low`; desktops with four cores or more at `high`; phones by memory and cores (Safari reports no memory: treated as 4 GB, so `medium`).
- `frame-monitor.ts` judges the frame rate: after a one-second warmup it looks at a 1.5 s window, and when the 75th-percentile frame takes longer than the budget it is given, it says so and starts over. Above 22 ms (below about 45 fps) the scene steps down one tier (new geometry, new pixel ratio). It never steps up: no flip-flopping. At `minimal` the budget is 40 ms (below about 25 fps), because giving up for the poster is a much bigger step than a lighter tier. (Software-only WebGL never gets here: `main.ts` shows the poster instead, unless `?quality` asks for the scene.) A slow verdict at `minimal` freezes the scene and reports `low-power`; `main.ts` lets the canvas fade out to the poster, then calls `stop()` and removes the canvas.
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

- Every visit starts the scene's clock at `startTime` (12 s) and the light at `startPhase` (0.62, dusk), so the first frame is always the same picture. The poster is that frame, captured from the real scene by `pnpm poster` (`scripts/capture-poster.ts`): it builds and serves the site, opens it with reduced motion (one still frame), hides the text, screenshots the scene and lets the browser encode WebP (quality 0.6) into `src/poster/`.
- **Capture the poster again whenever the first frame changes**: settings, shaders, the light, the camera. Nothing checks this automatically.
- Two shapes, several widths: landscape (captured as a 1440 by 720 window at double resolution; 1440, 2048 and 2880 wide) and portrait for phones (430 by 932 at double resolution; 430 and 860 wide). Grains are sized in CSS pixels, so each is captured at a typical window size to look like the live scene. `index.html` picks portrait for screens taller than wide; `object-fit: cover` crops the sides, which keeps the live scene's vertical framing.
- The `<picture>` sits in the scene container; the canvas is absolutely positioned above it and fades in over it once the first frame is drawn. Without WebGL2 (or if the scene fails), the poster simply stays.
- It loads with `fetchpriority="low"`: it is decoration, the text is the content (and the Largest Contentful Paint). Even so, Lighthouse's simulated slow 4G counts its download alongside the first paint: locally about 2.1 s for the text's paint instead of about 1 s, scores 95 to 99. The next step if needed is a tiny inline blurred placeholder first, with the full poster loaded later. Grain is not what makes the files big (removing it changed nothing); the sharp sand grains are.

## How the gusts work

- `wind.ts` turns pointer and finger movement into gusts: each has a ground position (the screen point projected onto a plane at the dunes' average height; nothing in the sky), a direction, a strength from the pointer's speed, and a start time on the shader's clock (`performance.now()` seconds, like `uTime`).
- Gusts live in `GustField`: two flat `Float32Array`s that are the uniform values themselves (`uGustOrigins`, `uGustDirections`), `MAX_GUSTS` slots, the oldest replaced first. The vertex shader loops over them: each pushes nearby sand along its direction, scatters and lifts it, then lets it settle over the gust's life.
- `GustTrail` makes at most one gust per `gustLife / MAX_GUSTS` seconds, so a slot is never reused while its gust is still blowing (the sand would snap back). A stroke needs two samples for a speed; a pause over 0.25 s or a lifted finger starts a new stroke.
- Mouse and pen use pointer events; fingers use passive touch events, which keep arriving while the browser scrolls or zooms and never block either. Listeners are attached only when the scene animates (not with reduced motion).
- `?tune` in the URL opens a lil-gui panel (`tune.ts`, its own lazy chunk, about 8 kB gzipped) with sliders for the wind, flow, dune height, grain size and gusts, applied live to the uniforms. "Copy values" copies them as JSON for `settings.ts`. Visitors without `?tune` never download it.
- To see gusts while developing, use a real browser window or a headless script: the in-app preview pane, when hidden, pauses animation frames and throttles timers, so synthetic pointer events there arrive seconds apart and never form a stroke.

## Testing conventions

- **Unit tests (Vitest)** sit next to the code as `src/**/*.test.ts` and cover pure logic. Tests describe behaviour in plain words.
- **End-to-end tests (Playwright)** live in `e2e/` and run against the production build (`pnpm build && pnpm preview` on port 3301), in two profiles: `desktop` (Desktop Chrome) and `mobile` (Pixel 7: small viewport, touch). Import `test` and `expect` from `e2e/test.ts`, never from `@playwright/test`: its automatic fixture fails any test whose page logs a console error or throws.
- Every page gets an axe check (WCAG 2.2 AA tags plus best practices) with the scene running.
- Motion is checked by comparing two screenshots of the canvas half a second apart, as raw bytes (`Buffer.equals`). Never `expect(buffer).toEqual(buffer)` on screenshots: when it fails, building the diff takes minutes.
- Touch drags go through the DevTools protocol (`Input.dispatchTouchEvent`), since Playwright has no touch-drag helper; `sweepAcrossTheSand` in `e2e/home.spec.ts` uses it on the phone profile and the mouse elsewhere.
- Browser launch flags (`launchOptions`) can only be set at the top of a spec file, so a test that needs a different browser (like `e2e/no-webgl2.spec.ts`, which runs Chromium with `--disable-webgl2`) gets its own file.
- Headless Chromium renders WebGL in software (Playwright passes `--enable-unsafe-swiftshader`), so the scene tests work on CI machines without a GPU. It is slow: measured on the dune scene, about 60 frames a second at desktop size but about 12 on the phone profile, where drawing the large near grains dominates. Two such pages at once starve each other (even the canvas fade-in stalls), so Playwright runs with one worker.
- A new test should be seen failing once: break the code it guards, run it, restore.

## Lighthouse and CI

- `pnpm lighthouse` (after `pnpm build`) runs Lighthouse CI five times on the mobile preset against `dist/`, served by Lighthouse CI's own static server (gzip, like Vercel). It fails when the median of the five values (`aggregationMethod: "median"`, which absorbs up to two slow, cold runs) is below Performance 90 or Accessibility, Best Practices, SEO 95, or layout shift is above 0.01. Never use `median-run`: Lighthouse CI picks that run by its first paint and time to interactive, not by score, and it once passed a build whose scores were 77, 77, 78, 89 and 93. Reports land in `.lighthouseci/` (open the `.html` files).
- CI machines have no GPU, so CI's Lighthouse measures what a visitor without one gets: the text and the poster, no Three.js. `scripts/check-lighthouse-path.ts` reports which page each run measured (the scene's script downloaded or not) and fails if the runs disagree or, with `LIGHTHOUSE_EXPECTS=poster` (set in CI), if any run measured the scene. The live scene's cost is measured where there is a GPU (`docs/performance.md`), and its weight is gated in CI by `pnpm size` (`scripts/check-sizes.ts`: page script, styles, the scene chunk and the posters against fixed budgets, after `pnpm build`).
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
```

Playwright reuses a server already running on port 3301 outside CI, so stop any `pnpm preview` left running before trusting a local end-to-end run against changed code.

## Folder structure

```
index.html           home page: text layer, poster, font preload, icon (content first, scripts after)
src/
  config.ts          SITE_NAME, the single place for the project name
  main.ts            entry for the home page: waits for idle, checks WebGL2, lazy-loads the scene
  style.css          Tailwind, the font faces, theme tokens (font, accent), the text scrim
  fonts/             Instrument Sans (Latin, variable weight) and its OFL licence
  favicon.svg        the icon
  poster/            the poster, landscape and portrait WebP at several widths (pnpm poster)
  scene/
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
.github/
  workflows/ci.yml   checks, end-to-end and Lighthouse jobs
  actions/setup/     shared pnpm + Node + install steps
lighthouserc.json    Lighthouse CI: runs, Chrome flags, score budgets
vercel.json          Vercel: long caching for /assets/
vite.config.ts       Tailwind plugin, %SITE_NAME% plugin, ports, chunk size limit
vitest.config.ts     unit tests: src/**/*.test.ts
playwright.config.ts desktop + mobile profiles against the production build
tsconfig.json        app code (browser types)
tsconfig.node.json   config files, e2e/ and scripts/ (Node types, plus DOM for code run in the page)
```

## Status

Phases 0 to 3 done and live (scene, light, poster, adaptive quality; measurements in `docs/performance.md`). Phase 4 (text layer) on `feature/sahra-content-layer` (PR #3); the Calendly booking was dropped, the action is "Hire on Upwork". Phases: 0 setup, 1 scene prototype, 2 art direction, 3 performance and adaptivity, 4 content layer and booking, 5 Lab, 6 embeddable package, 7 docs and portfolio packaging.
