# Performance

Sahra's targets come from its brief: a steady 60 frames a second on a mid-range Android phone, no layout shift, and Lighthouse on mobile at 90 or more for Performance and 95 or more for Accessibility, Best Practices and SEO, enforced in CI. This page records how the scene meets them and what was measured.

## How it stays fast

- **Text first, scene after.** The HTML carries the text and a poster of the scene's first frame. Three.js (about 136 kB gzipped) downloads only after the page has loaded and the browser is idle, and only if WebGL2 works.
- **All motion on the GPU.** Each grain's position is computed in the vertex shader every frame. Per frame, JavaScript sets a handful of uniforms (time, light, gusts) and draws two objects: the sky and the sand.
- **Quality that fits the device.** Four tiers, from 49,152 grains at up to pixel ratio 2 down to 9,216 grains at pixel ratio 0.75. The starting tier comes from the device (cores, memory, phone or desktop, software rendering). A frame-rate monitor then steps down a tier when the slowest quarter of frames takes longer than 22 ms. At the lightest tier, the scene gives up for the poster below about 25 fps with a GPU, or below about 45 fps without one (software rendering also costs the page's own main thread).
- **Rest when unseen.** Rendering stops while the tab is hidden or the canvas is off screen, and the scene's clock stands still meanwhile. Stopping releases the GPU's memory at once.
- **Long caching.** Every script, style and poster has a content hash in its name and is cached for a year.

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

Headless Chromium in tests and CI draws WebGL in software (SwiftShader). The scene recognises the renderer and starts at the lightest tier: about 60 fps for a phone-sized page and 44 to 47 fps for a 1280 x 720 page, where frames alternate between 16.7 and 33.3 ms. With software rendering that is below the scene's budget, so after its first judgement (about 2.5 s) it fades back to the poster. End-to-end tests about the running scene lock the tier with `?quality=minimal` so they do not race that.

## Lighthouse

The CI gate runs Lighthouse five times on the mobile preset (a simulated mid-range phone with a 4x slower CPU and a slow 4G connection) against the production build, and fails when the median of the five values misses a budget. CI machines have no GPU, so this measures the software-rendering path described above, including the scene's download and startup; a separate check fails the job unless the scene actually loaded in every run.

Measured on 2026-10-07 (commit 27b373d), five runs each, Performance score per run:

| Where                        | Rendering              | Performance per run | Median | Accessibility, Best Practices, SEO | Layout shift |
| ---------------------------- | ---------------------- | ------------------- | ------ | ---------------------------------- | ------------ |
| GitHub Actions (the CI gate) | software (no GPU)      | 73, 93, 92, 92, 91  | 92     | 100 in every run                   | 0            |
| The 2015 laptop above        | Intel HD Graphics 4600 | 95, 93, 90, 98, 84  | 93     | 100 in every run                   | 0            |

In CI, the median run's largest paint is the heading at about 2.0 s, and its Total Blocking Time is 323 ms. The first CI run is usually the slowest (a cold machine), which is why the gate takes the median of five.

## Known costs, and the next levers

- **Scene startup.** Loading Three.js, creating the renderer and compiling the shaders shows up as one long task of about 570 ms in CI's simulated slow phone (about 140 ms of real work, multiplied by Lighthouse's 4x CPU slowdown). It is the largest single item in Total Blocking Time. The lever: split the startup into several shorter tasks, yielding to the browser between them.
- **The poster's bytes.** On Lighthouse's simulated slow 4G, the poster's download (84 kB for phones) competes with the text's first paint, moving the largest paint from about 1.0 s to about 2.0 s, still inside the 2.5 s "good" line. The poster loads with low priority, but the simulation counts its bytes anyway. The lever: a tiny inline blurred placeholder first, the full poster later.
- **Software rendering before it gives up.** Without a GPU, the scene's frames cost about 60 ms each of simulated main-thread time until the monitor's first judgement (about 2.5 s), when it fades back to the poster.
- **Fill rate.** On GPUs the main cost is drawing pixels (large, soft near grains and the full-screen sky), not the vertex shader. That is why each lower tier lowers the pixel ratio as well as the grain count.
