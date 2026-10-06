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
- Fonts: open-license (OFL) only, because the repo is public and the font files ship in it. Self-hosted with `@font-face`, `font-display: swap` and a metric-matched fallback so the swap causes no layout shift.
- Config files (`vite.config.ts` and friends) import local TypeScript with an explicit `.ts` extension, which Vite's upcoming native config loader requires.

## How the scene loads

1. The HTML holds the content and an empty, `aria-hidden` scene container (`[data-scene]`, fixed behind the content), so the content paints with almost no JavaScript (the entry script is about 1.5 kB gzipped).
2. `src/main.ts` waits for the `load` event and then an idle moment, so the scene never competes with the content's first paint.
3. It creates the canvas and a WebGL2 context itself, before downloading anything. No WebGL2 means the page stays as it is and Three.js is never downloaded.
4. Only then is `src/scene/scene.ts` imported. It is a separate chunk (Three.js, about 130 kB gzipped), and Three.js reuses that context.
5. Shaders compile with `renderer.compileAsync` (non-blocking where the browser supports parallel shader compilation); the first frame is drawn, and only then does the canvas fade in.
6. With `prefers-reduced-motion: reduce`, one still frame is drawn and no animation loop starts.

The container's `data-state` records the outcome: `unsupported` (no WebGL2), `running` (first frame on screen) or `failed`. CSS reads it (the canvas fades in on `running`), and tests wait on it instead of on timers.

GLSL lives in `src/scene/shaders/*.glsl`, imported as strings with Vite's `?raw` suffix. `noise.glsl` (simplex noise from webgl-noise, MIT) is prepended to the vertex shader in `scene.ts`.

## How the dunes work

- Each point's `position` is not a place: it packs its layout (place along its line, which line, a fixed random number), built once by `createDuneGeometry` in `dunes.ts` with a seeded random generator, so the sand is laid out the same on every visit. Lines are stored farthest first, so nearer sand draws over farther sand.
- The vertex shader computes everything else, every frame: line depth (evenly spaced in inverse depth, so evenly spaced on screen), line width (the view's width at that depth, from `uAspect`), the downwind drift (wrapping at the edges), the noise flow field, the dune height (ridged noise with a warp, creeping downwind), a flatter foreground (so the nearest lines stay below the bottom edge), crest shading, point size and fading.
- Per frame, JavaScript only updates `uTime`. Tunable values live in `src/scene/settings.ts`.

## How the gusts work

- `wind.ts` turns pointer and finger movement into gusts: each has a ground position (the screen point projected onto a plane at the dunes' average height; nothing in the sky), a direction, a strength from the pointer's speed, and a start time on the shader's clock (`performance.now()` seconds, like `uTime`).
- Gusts live in `GustField`: two flat `Float32Array`s that are the uniform values themselves (`uGustOrigins`, `uGustDirections`), `MAX_GUSTS` slots, the oldest replaced first. The vertex shader loops over them: each pushes nearby sand along its direction, scatters and lifts it, then lets it settle over the gust's life.
- `GustTrail` makes at most one gust per `gustLife / MAX_GUSTS` seconds, so a slot is never reused while its gust is still blowing (the sand would snap back). A stroke needs two samples for a speed; a pause over 0.25 s or a lifted finger starts a new stroke.
- Mouse and pen use pointer events; fingers use passive touch events, which keep arriving while the browser scrolls or zooms and never block either. Listeners are attached only when the scene animates (not with reduced motion).
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

- `pnpm lighthouse` (after `pnpm build`) runs Lighthouse CI five times on the mobile preset against `dist/`, served by Lighthouse CI's own static server (gzip, like Vercel). It fails when the median run (which absorbs up to two slow, cold runs) scores below Performance 90 or Accessibility, Best Practices, SEO 95, or shifts layout more than 0.01. Reports land in `.lighthouseci/` (open the `.html` files).
- Lighthouse launches its own Chrome, which has no GPU in CI. `--enable-unsafe-swiftshader` in `lighthouserc.json` gives it software WebGL, and `scripts/check-lighthouse-scene.ts` fails the run unless the scene chunk was downloaded in every run. Without that guard, a Chrome without WebGL would never load Three.js and the scores would flatter the page.
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
```

Playwright reuses a server already running on port 3301 outside CI, so stop any `pnpm preview` left running before trusting a local end-to-end run against changed code.

## Folder structure

```
index.html           home page (content in HTML first, scripts after)
src/
  config.ts          SITE_NAME, the single place for the project name
  main.ts            entry for the home page: waits for idle, checks WebGL2, lazy-loads the scene
  style.css          Tailwind and global styles
  scene/
    scene.ts         Three.js renderer, dune points, uniforms, render loop, input wiring
    camera.ts        the camera and the near and far depths (shared with the tests)
    wind.ts          gusts: GustField (uniform arrays), groundPoint, GustTrail, listeners (wind.test.ts)
    dunes.ts         the points' layout and the seeded random generator (unit-tested in dunes.test.ts)
    settings.ts      tunable values: counts, wind, flow, dune height, grain size, gusts
    shaders/         noise.glsl, dunes.vert.glsl (all motion), dunes.frag.glsl (round soft grains)
e2e/
  test.ts            Playwright test + expect, failing on page errors
  *.spec.ts          end-to-end specs
scripts/
  check-lighthouse-scene.ts   fails unless the scene loaded in every Lighthouse run (Node runs .ts directly)
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

Phase 0 (setup) done: scaffold, lazy-loaded Three.js scene, tests, CI with Lighthouse, Vercel with previews. Phase 1 (scene prototype) in progress on `feature/sahra-dune-scene`. Phases: 0 setup, 1 scene prototype, 2 art direction, 3 performance and adaptivity, 4 content layer and booking, 5 Lab, 6 embeddable package, 7 docs and portfolio packaging. The favicon is deliberately empty (`data:,`) until the brand mark lands in Phase 4.
