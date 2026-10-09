# Performance

Sahra's targets come from its brief: a steady 60 frames a second on a mid-range Android phone, no layout shift, and Lighthouse on mobile at 90 or more for Performance and 95 or more for Accessibility, Best Practices and SEO, enforced in CI. This page records how the scene meets them and what was measured.

## How it stays fast

- **Text first, scene after.** The HTML carries the text and a poster of the scene's first frame. Three.js (about 134 kB gzipped) downloads only after the page has loaded and the browser is idle, and only if the browser can draw WebGL2 on a GPU. Without one (WebGL only in software, as on CI machines and some locked-down computers), the poster stays: drawing in software would make the whole page sluggish.
- **Startup in short steps.** Creating the renderer, building the grains and compiling the shaders run as separate tasks, so the browser can respond in between.
- **All motion on the GPU.** Each grain's position is computed in the vertex shader every frame. Per frame, JavaScript sets a handful of uniforms (time, light, gusts) and draws two objects: the sky and the sand.
- **Quality that fits the device.** Four tiers, from 49,152 grains at up to pixel ratio 2 down to 9,216 grains at pixel ratio 0.75. The starting tier comes from the device (cores, memory, phone or desktop, software rendering). A frame-rate monitor then steps down a tier when the slowest quarter of frames takes longer than 22 ms. At the lightest tier, the scene gives up for the poster below about 25 fps.
- **Rest when unseen.** Rendering stops while the tab is hidden or the canvas is off screen, and the scene's clock stands still meanwhile. Stopping releases the GPU's memory at once.
- **Long caching.** Every script, style and poster has a content hash in its name and is cached for a year. The embed's `sahra.js` keeps its name (other sites link to it), so it is cached for an hour.

## Real devices

Measured on 2026-10-07 with the `?debug` overlay, which shows the frame rate over the last 1.5 s, the slowest quarter of frames, the tier and the GPU.

| Device                                              | GPU                    | Browser    | Canvas (pixel ratio) | Tier                                        | Frame rate | Slowest quarter |
| --------------------------------------------------- | ---------------------- | ---------- | -------------------- | ------------------------------------------- | ---------- | --------------- |
| HONOR 400 (Android), held still for 30 s            | Adreno 720             | Chrome     | 722 x 1328 (2)       | high, 49,152 grains                         | 60.1 fps   | 16.7 ms         |
| HONOR 400, while dragging a finger for 10 s (gusts) | Adreno 720             | Chrome     | 722 x 1328 (2)       | high                                        | 58.8 fps   | 16.7 ms         |
| 2015 laptop (Core i7-4720HQ), 1280 x 720 window     | Intel HD Graphics 4600 | Chrome 154 | 1280 x 720 (1)       | high                                        | 60.1 fps   | 16.7 ms         |
| Same laptop, 1440 x 900 window at pixel ratio 2     | Intel HD Graphics 4600 | Chrome 154 | 2160 x 1350 (1.5)    | started high, stepped itself down to medium | 60.1 fps   | 16.7 ms         |

16.7 ms is one frame at 60 Hz: on these devices even the slowest quarter of frames arrived on time. The last row shows the monitor at work: at pixel ratio 2 (2880 x 1800 pixels) the integrated GPU fell behind, the scene stepped down to medium, and it held 60 fps from there. The laptop rows were measured in Chrome driven by Playwright, with the GPU in use (the renderer string reports the Intel GPU through Direct3D 11).

## Without a GPU

Browsers without a GPU can still offer WebGL, drawn in software (Chrome's SwiftShader). Measured before the page stopped running the scene there: the lightest tier managed about 45 to 60 fps in headless Chromium, but every frame also cost the page's own main thread about 60 ms on CI's simulated slow phone, so the whole page got sluggish. Since then the page asks for WebGL with `failIfMajorPerformanceCaveat` (and checks the renderer's name), and without a GPU it keeps the poster and never downloads Three.js. `?quality=...` in the URL runs the scene anyway; the end-to-end tests use it, because headless Chromium has only software WebGL.

## Lighthouse

The CI gate runs Lighthouse five times on the mobile preset (a simulated mid-range phone with a 4x slower CPU and a slow 4G connection) against the production build, and fails when the median of the five values misses a budget. CI machines have no GPU, so CI measures what a visitor without one gets: the text and the poster. A check confirms every run measured exactly that, and size budgets on the built files (`pnpm size`) keep the scene's weight in check, since CI's Lighthouse never downloads it. The live scene is measured where there is a GPU.

The latest CI gate, on commit a4c31e0 (2026-10-09, the code now live), five runs per page, Performance score per run:

| Page       | What CI measures                     | Performance per run    | Median | Accessibility, Best Practices, SEO | Layout shift | Largest paint |
| ---------- | ------------------------------------ | ---------------------- | ------ | ---------------------------------- | ------------ | ------------- |
| Home       | the text and the poster (no GPU)     | 88, 100, 100, 100, 100 | 100    | 100 in every run                   | 0            | 1.2 to 1.4 s  |
| Lab        | the pattern and the story            | 100 in every run       | 100    | 100 in every run                   | 0            | 1.4 to 1.7 s  |
| Embed demo | the page, with the boxes' background | 100 in every run       | 100    | 100 in every run                   | 0            | 0.9 s         |

The one lower run is the usual cold first run on a fresh CI machine: its blocking time is Lighthouse's own injected script, not the page.

With a GPU, on the 2015 laptop above, Lighthouse measures the live scene, and the numbers move with whatever else the machine is doing (its benchmark index ranged from 700 to 1,400 across these days):

| When       | Page       | What it measures                        | Performance per run  | Median |
| ---------- | ---------- | --------------------------------------- | -------------------- | ------ |
| 2026-10-07 | Home       | the live scene, after the startup split | 90, 100, 100, 98, 95 | 98     |
| 2026-10-09 | Home       | the live scene, on a busier machine     | 82, 87, 89, 90, 95   | 89     |
| 2026-10-09 | Lab        | the pattern and the story, with GSAP    | 98, 99, 99, 100, 100 | 99     |
| 2026-10-09 | Embed demo | two live scenes                         | 91, 95, 96, 97, 99   | 96     |

Accessibility, Best Practices and SEO were 100 and layout shift 0 in every one of these runs. On the home page the score follows the machine: on one busy evening it measured the previous release at 77 to 95. The scene's own cost there is its startup (see below); in Lighthouse's simulated slow phone its longest task is about 90 to 120 ms.

Before the poster path, CI measured the scene drawn in software, with a gate that swung between 85 and 92 depending on how fast the CI machine happened to be; the earlier aggregation (`median-run`, which picks a run by its first paint and time to interactive, not by score) even let a build with scores of 77, 77, 78, 89 and 93 through.

## The Lab

Measured in Chromium on the same laptop's GPU, with a phone-sized window and the CPU slowed four times, sampling every frame with `requestAnimationFrame`:

| What                                              | Frame rate                | Slowest frames                  |
| ------------------------------------------------- | ------------------------- | ------------------------------- |
| The pattern drawing itself (the first 4 s)        | usually 60 fps (43 to 60) | 95th percentile 16.8 to 50 ms   |
| The pattern idling, its amber light passing over  | usually 60 fps (52 to 60) | 95th percentile 16.7 to 33.3 ms |
| Scrolling steadily through the whole scroll story | 59.5 fps                  | 95th percentile 16.7 ms         |

The ranges are over several runs on a busy machine; the low ends came from runs while other programs were working. The pattern is plain SVG written at build time, so it costs no script; its light repaints about 35 lines a frame, which is cheap where the browser draws on the GPU. A version that moved the light on the compositor instead (an amber ring blended over the drawing) measured slower with a GPU and much slower without one, so it was dropped. The scroll story's GSAP (about 43 kB compressed) loads only once the page is idle, and its motion is only transforms and opacity.

One lesson worth keeping: headless Chromium without a GPU draws and composites everything on the CPU, so SVG and CSS animation measured there looks several times slower than it is. These numbers come from Chromium using the real GPU.

## The embed

- **What a site downloads:** one file, `sahra.js`, about 3.3 kB compressed. The scene (about 134 kB) comes only when a box is near the screen and the device can run it, and is then cached for a year. A test checks that an embedding page fetches exactly the loader before any box starts, then only the scene.
- **Checked live** from a page on another domain (`https://host.example`, served by the test browser) with the real GPU: two boxes ran, one inside a shadow root started with `mount()`, with no errors, and both files carried the `Access-Control-Allow-Origin` header that cross-domain module scripts need.
- **The demo page** scores 100 in CI (no GPU, so the boxes keep their background) and 91 to 99 on the laptop with two live scenes.

## Known costs, and the next levers

- **Scene startup.** Measured with the GPU and Chrome's CPU throttled 4 times: creating the renderer, building the grains and starting the shader compile used to run as one task of 226 to 273 ms. Split into separate tasks, the longest is now 93 to 107 ms, and the blocking time beyond 50 ms per task fell from about 230 to 270 ms to about 80 to 140 ms in warm runs. A cold first visit is still about 260 ms, mostly the browser compiling the shaders. What remains in one piece is evaluating Three.js itself when its file arrives.
- **The poster's bytes.** On a simulated slow 4G connection the phone poster (82 kB) can compete with the text's first paint. It loads with low priority, and in CI's runs the largest paint (the heading) landed at about 0.9 s. If it ever matters, the lever is a tiny inline blurred placeholder first, the full poster later.
- **Fill rate.** On GPUs the main cost is drawing pixels (large, soft near grains and the full-screen sky), not the vertex shader. That is why each lower tier lowers the pixel ratio as well as the grain count.
