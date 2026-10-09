# How the dunes stay at 60 frames a second on a phone

Sahra draws up to 49,152 grains of sand, moves every one of them every frame, lets a finger blow them around, and changes the light through the day. On a mid-range Android phone it holds 60 frames a second, and without a graphics chip the page still scores 100 on Lighthouse's simulated slow phone. This is how, in four parts: the shaders, the adaptive quality, the loading, and how all of it is measured. The numbers are in [performance.md](performance.md).

## 1. The sand is computed on the GPU, not moved by JavaScript

The usual way to animate thousands of particles is a JavaScript loop that moves each one and uploads the new positions every frame. At 49,152 grains that is millions of numbers a second through the main thread, which is also busy with scrolling, input and the rest of the page. Sahra does none of it.

**Each grain is a point whose position is not a place.** When the scene starts, `dunes.ts` builds one buffer, once: for every grain, three numbers packed into `position`. They are its place along its line (from left to right), which line it belongs to (from the farthest to the nearest), and a fixed random number. That buffer never changes. The whole scene is two draw calls: the sky, and all the grains as one `THREE.Points` object.

**The vertex shader turns those three numbers into a grain of a moving desert,** every frame, on the GPU (`src/scene/shaders/dunes.vert.glsl`):

- **Depth.** Lines are spaced evenly in _inverse_ depth, which spaces them evenly on screen: wide apart up close, gathering toward the horizon, as real dune ridges do. Each line is as wide as the view at its depth, so the sand reaches both edges on any screen shape.
- **Drift.** Each grain streams downwind at a slightly different speed from its random number, and wraps around at the edge of the view, so the sand never runs out.
- **The flow field.** Two samples of simplex noise, moving slowly through time, carry grains sideways off their line and back, like currents in the wind.
- **The dunes.** The height comes from "ridged" noise (one minus the absolute value of noise), which gives sharp crests and soft troughs. A second noise warps it so crest lines curve, and the whole field creeps slowly downwind. Right in front of the camera the sand is flattened, so the nearest lines stay below the bottom of the view.
- **The sun.** One extra height sample, a small step to the side, gives each grain's slope, and from it a surface normal. Faces turned toward the sun take the lit colour, the rest the shade colour. That is the entire lighting model: one dot product per grain.
- **Distance.** Points shrink with distance; below one pixel they stay one pixel and fade instead, which stops distant sand from shimmering. Far grains take on the horizon's colour (haze), and the nearest are drawn softer, as if out of focus.

Per frame, JavaScript only updates a few uniforms: the time and the light's colours. The fragment shader rounds each point into a soft grain, and a full-screen quad behind it draws the sky (`sky.frag.glsl`): the horizon's glow fading up into the dark, a bloom where a low sun sits, and a faint grain that changes every frame. That grain also dithers the dark gradients, which would otherwise show bands on 8-bit screens.

**The wind you can touch.** Gusts are the one thing that comes from outside the GPU, and they follow the same rule: no per-grain work in JavaScript. A pointer or finger moving across the sand becomes a gust, with a place on the ground, a direction, a strength from its speed, and a start time. Gusts go into a ring of 12 slots that _are_ the uniform arrays. The vertex shader loops over the 12 slots; each live gust pushes nearby grains along its direction, scatters them a little and lifts them, then lets them settle back over the gust's life. JavaScript writes at most one gust per twelfth of a gust's life, so a slot is never reused while its sand is still in the air. Fingers use passive touch events, which keep arriving while the page scrolls and never block it.

**The light through the day.** `lighting.ts` holds three moments, dawn, midday and dusk: sky, horizon, ground, lit sand, shaded sand and the sun's direction. Each frame eases between them by the time of day. Every visit starts at the same moment (dusk), so the first frame is always the same picture, which is what makes the poster possible (see section 3).

## 2. The quality fits the device, and keeps fitting it

No single number of grains suits every device. A high-end laptop can draw far more than a five-year-old phone, and the same phone draws less on a battery-saving setting. So the scene has four tiers, from `high` (49,152 grains at up to twice the pixel density) to `minimal` (9,216 grains at three quarters of the screen's pixel density). Each lower tier cuts both the grains and the pixel ratio, because on a GPU the larger cost is filling pixels, not running the vertex shader.

**A first guess from the device** (`quality.ts`). Software rendering means the lightest tier. A data-saver setting, two cores or 2 GB of memory mean `low`. Desktops with four cores or more start at `high`, and phones are judged by memory and cores. Safari reports no memory, so it counts as a typical 4 GB, which means `medium`. The guess errs toward quality on capable devices, because the next step corrects it.

**A frame-rate monitor that corrects the guess** (`frame-monitor.ts`). After a one-second warmup (shaders, caches and memory settle in the first frames), it judges 1.5 seconds of frames at a time by their 75th percentile, not their average: an average hides the stutter people notice. If that frame takes more than 22 ms (below about 45 fps), the scene steps down a tier, rebuilds its grains, and the monitor starts over to judge the new tier on its own frames. It never steps back up, which avoids flip-flopping between tiers. At the lightest tier it is more forgiving, 40 ms (about 25 fps), because giving up is a bigger step: the canvas fades out to the poster and the scene releases everything it held.

On a 2015 laptop this happened exactly as designed. At pixel ratio 2 (2880 by 1800 pixels) the integrated GPU fell behind, the scene stepped itself down to `medium`, and it held 60 fps from there.

**Rest when unseen.** The render loop runs only while it is worth it. It stops while the tab is hidden, while the canvas is scrolled off screen, while the browser has taken WebGL away (phones do under memory pressure), and with reduced motion, where one still frame is drawn. The scene's clock stands still while paused, so it resumes where it left off. Stopping for good removes every listener and asks the browser to free the GPU's memory at once, which matters for the embed on single-page sites.

## 3. Text first, scene after

The page has to be readable at once on a slow phone and a slow connection, and the scene must never get in its way.

1. **The HTML holds the content** and a poster of the scene's first frame, as an image. The poster is a real capture of the scene (`pnpm poster` renders it in a browser and saves it as WebP), so when the live scene fades in over it, nothing jumps. The poster loads with low priority: the text is the largest paint, not the decoration.
2. **The scene waits** for the page's `load` event and an idle moment, so its download never competes with the first paint.
3. **It checks before it downloads.** It creates the canvas and a WebGL2 context itself, asking with `failIfMajorPerformanceCaveat`, and also checks the renderer's name. Without WebGL2, or with WebGL drawn only in software (no graphics chip, as on CI machines and some locked-down computers), the poster stays and Three.js is never downloaded. Software WebGL could run the scene, but it would make the whole page sluggish.
4. **Only then does Three.js load,** as its own chunk (about 134 kB compressed), reusing the context already created.
5. **Startup runs in short tasks:** creating the renderer, building the grains and compiling the shaders are separate steps with a yield to the browser between each, and the shaders compile without blocking where the browser can. This split cut the longest startup task from about 250 ms to about 100 ms on a simulated slow phone.
6. **The canvas fades in** over the poster only once its first frame is drawn.

The same path runs the [embed](embedding.md) on other sites. There, a 3 kB loader waits until a box is near the screen, then goes through the same check before it fetches the scene.

## 4. Proving it, every time

None of this counts unless it is measured, and measured again on every change.

- **Real devices.** `?debug` overlays the frame rate, the slowest quarter of frames, the tier and the GPU's name. That is how the phone and laptop numbers in [performance.md](performance.md) were taken.
- **Lighthouse on every pull request.** CI runs Lighthouse five times on the mobile preset against every page and fails below 90 for Performance or 95 for the rest, or on layout shift above 0.01. It judges the median of the five runs. An earlier setting picked one "representative" run by its timings, not its score, and once let a build through with scores of 77, 77, 78, 89 and 93. CI's machines have no GPU, so a script checks that every run measured the poster path, as a visitor without a GPU gets it. The scene's own weight is held by **size budgets** on every built file.
- **End-to-end tests** on the production build, in a desktop and a phone profile. They check the scene animates, gusts blow, quality locks, the scene pauses on a hidden tab, and a 30-times slower CPU falls back to the poster. They also check reduced motion, accessibility with axe, zero layout shift, and the embed running on a page from another origin.
- **Readability is a test, not a judgement.** Text sits over a scene whose light changes all day. One test sets six points of the day at the densest tier, makes the text transparent, measures the background behind every piece of text from screenshots, and checks WCAG AA contrast against it. The lowest it has measured is 9 to 1, where AA asks for 4.5.

## What I would do next

- **A tiny blurred placeholder** in the HTML before the poster, so even a very slow connection paints the desert at once.
- **A real-device lab** beyond one phone and one laptop: an older Android, an iPhone with Safari, a low-end Chromebook. The tiers' first guesses are only as good as the devices behind them.
- **WebGPU** where it is available, for compute-driven sand that collides with itself, kept behind the same checks and the same fallback.
