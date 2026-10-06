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

GLSL lives in `src/scene/shaders/*.glsl`, imported as strings with Vite's `?raw` suffix.

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
```

## Folder structure

```
index.html           home page (content in HTML first, scripts after)
src/
  config.ts          SITE_NAME, the single place for the project name
  main.ts            entry for the home page: waits for idle, checks WebGL2, lazy-loads the scene
  style.css          Tailwind and global styles
  scene/
    scene.ts         Three.js renderer, camera, points, render loop
    shaders/         GLSL vertex and fragment shaders
vite.config.ts       Tailwind plugin, %SITE_NAME% plugin, ports, chunk size limit
tsconfig.json        app code (browser types)
tsconfig.node.json   config files (Node types)
```

## Status

Phase 0 (setup) in progress. Phases: 0 setup, 1 scene prototype, 2 art direction, 3 performance and adaptivity, 4 content layer and booking, 5 Lab, 6 embeddable package, 7 docs and portfolio packaging. The favicon is deliberately empty (`data:,`) until the brand mark lands in Phase 4.
