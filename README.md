# Sahra

[![CI](https://github.com/MostafaSaafan5517/sahra/actions/workflows/ci.yml/badge.svg)](https://github.com/MostafaSaafan5517/sahra/actions/workflows/ci.yml)

**Live:** https://sahra-khaki.vercel.app

Sahra (Arabic for "desert") is a generative scene of wind moving over desert sand, built with Three.js and custom GLSL shaders. Tens of thousands of particles form dune lines that drift on their own, your cursor or finger is a gust of wind, and the light moves slowly between dawn, midday and dusk.

It is a creative front-end portfolio project by Mostafa Saafan: the homepage of a fictional design studio, built to production standards for performance and accessibility.

**Status:** in development. The project setup is done (a placeholder scene, tests, CI with Lighthouse budgets, deployment with previews); the dune scene comes next.

## Running it locally

Requires Node 24 and pnpm 11.

```bash
pnpm install
pnpm dev
```

The dev server runs on http://localhost:3300.

## Testing

```bash
pnpm test         # unit tests (Vitest)
pnpm test:e2e     # end-to-end tests (Playwright, desktop and mobile) against the production build
pnpm build && pnpm lighthouse   # Lighthouse CI, mobile, five runs
```

CI runs all three on every push to `main` and on every pull request. The Lighthouse job fails below 90 for Performance or 95 for Accessibility, Best Practices and SEO, and it checks that the WebGL scene actually loaded in every run, so the scores include its real cost.
