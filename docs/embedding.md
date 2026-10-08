# Embedding the dune scene

The scene from the home page can run on any site: Webflow, WordPress, Framer, a page builder or plain HTML. It takes a box on the page and one script. See it on a plain HTML page: [sahra-khaki.vercel.app/embed/](https://sahra-khaki.vercel.app/embed/).

## The two lines

```html
<div data-sahra style="height: 480px; background: #0b0908"></div>
<script type="module" src="https://sahra-khaki.vercel.app/embed/sahra.js"></script>
```

- The `div` is the box the scene fills. Put it where the scene should be. Every box with `data-sahra` gets its own scene.
- The script starts every box on the page. Add it once per page, anywhere (the end of the page is a good place). Keep `type="module"`: without it the script does not run.

## Give the box a size and a background

The scene fills its box, so the box needs a height:

```html
<!-- A fixed height -->
<div data-sahra style="height: 480px"></div>
<!-- A full-screen hero -->
<div data-sahra style="min-height: 100svh"></div>
<!-- A shape that scales with the width -->
<div data-sahra style="aspect-ratio: 16 / 9"></div>
```

The box's own background shows until the scene fades in, and stays wherever the scene cannot run (see [What visitors get](#what-visitors-get)). Give it a dark colour close to the scene, such as `#0b0908`, or a still picture of the scene. Rounded corners (`border-radius`) clip the scene too.

## Put content on top

Anything inside the box stays above the scene: a heading, a button, a whole hero section.

```html
<div data-sahra style="min-height: 100svh; padding: 4rem 1.5rem; background: #0b0908">
  <h1 style="color: #fafafa">Your studio</h1>
  <p style="color: #e5e5e5">One line about what you do.</p>
</div>
```

The scene is dark, so light text reads well over it. Where the sand rises behind your text, a soft dark gradient behind the text keeps it readable.

## Options

Options are attributes on the box, next to `data-sahra`.

| Attribute      | Values                                     | Default           | What it does                                                                                                                                                                  |
| -------------- | ------------------------------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-light`   | `cycle`, `dawn`, `midday`, `dusk`          | `cycle`           | `cycle` moves the light through dawn, midday and dusk over three minutes. The others hold one light.                                                                          |
| `data-sky`     | a colour, `#rgb` or `#rrggbb`              | the light's own   | The top of the sky.                                                                                                                                                           |
| `data-horizon` | a colour                                   | the light's own   | The glow just above the horizon; far sand fades into it.                                                                                                                      |
| `data-ground`  | a colour                                   | the light's own   | The ground between the dune lines.                                                                                                                                            |
| `data-sand`    | a colour                                   | the light's own   | Sand facing the sun.                                                                                                                                                          |
| `data-shade`   | a colour                                   | the light's own   | Sand turned away from the sun.                                                                                                                                                |
| `data-density` | `high`, `medium`, `low`, `minimal`         | set by the device | The most grains the scene may draw. It still starts lighter on a weaker device, and draws fewer if frames get slow.                                                           |
| `data-quality` | `high`, `medium`, `low`, `minimal`, `auto` | none              | For tests and screen recordings only: fixes the quality (or keeps it automatic with `auto`) and runs the scene even where it normally would not. Leave it out on a real site. |

Any colour holds the light: the scene keeps one light (dusk, unless `data-light` names another) with your colours in place of its own. For example, moonlit dunes with fewer grains:

```html
<div
  data-sahra
  data-light="dawn"
  data-sky="#070b14"
  data-horizon="#1d2740"
  data-ground="#080a10"
  data-sand="#c9d6f0"
  data-shade="#3b4a6b"
  data-density="low"
  style="height: 480px; background: #070b14"
></div>
```

A value the scene cannot use is named in the browser's console (for example `Sahra: data-sand="gold" is not a colour like #efa463.`), and the scene runs without it.

## Webflow

1. **Add the box.** Drag a **Div Block** where the scene should go. In the **Style** panel, give it a height (for example 480 px, or 100 VH for a full-screen hero) and a dark background colour.
2. **Mark it.** With the Div Block selected, open the **Settings** panel (the gear icon), scroll to **Custom attributes** and click **+**. Name: `data-sahra`. If Webflow asks for a value, type `true` (any value works). Add options the same way, for example Name `data-light`, Value `dusk`.
3. **Add the script.** For one page: open **Page settings** (the gear next to the page's name in the Pages panel), find **Custom code**, and paste the script line into **Before `</body>` tag**. For every page: **Site settings** > **Custom code** > **Footer code**. Save.

   ```html
   <script type="module" src="https://sahra-khaki.vercel.app/embed/sahra.js"></script>
   ```

4. **Publish.** Webflow runs custom code on the published site, your `webflow.io` address included, but not in the Designer, where the box shows only its background.

Webflow's custom code fields need a paid plan. If they are greyed out, check your site's plan.

To put text over the scene, place your heading and buttons inside the Div Block.

## WordPress

With the block editor:

1. **Add the box and the script.** Edit the page, add a **Custom HTML** block where the scene should go, and paste both lines:

   ```html
   <div data-sahra style="height: 480px; background: #0b0908"></div>
   <script type="module" src="https://sahra-khaki.vercel.app/embed/sahra.js"></script>
   ```

2. **Check it.** Use **Preview** in the block (or the page preview), then update or publish the page.

If the script disappears when you save, your account is not allowed to add scripts. WordPress keeps `<script>` tags only for users who may post unfiltered HTML: administrators and editors on a single site, and only super admins on a multisite network. On WordPress.com, scripts need a plan that allows plugins. In that case:

- keep only the `div` in the Custom HTML block, and
- add the script to every page instead: with a code snippets plugin (WPCode, for example, set to the site's footer), or in your theme's footer, if you can edit it.

Page builders work the same way: put both lines in their HTML widget (Elementor's **HTML** widget, Divi's **Code** module).

## Any other site

Wherever a site lets you add your own HTML, the two lines work: the `div` where the scene goes, the script once per page. On sites that change pages without reloading (single-page apps, Framer and the like), boxes added later start by themselves, and a box taken off the page releases its scene and the memory it used.

A box inside a shadow root (a web component) is out of the script's sight. Start it yourself:

```html
<script type="module">
  import { mount } from "https://sahra-khaki.vercel.app/embed/sahra.js";
  mount(document.querySelector("my-hero").shadowRoot.querySelector("[data-sahra]"));
</script>
```

## What visitors get

- **On phones and computers with a graphics chip:** the live scene. It picks how many grains to draw from the device, and draws fewer if frames get slow, aiming at a steady 60 frames a second.
- **Without WebGL2, or where the graphics are drawn by the processor (no graphics chip):** the box's own background. Nothing else downloads.
- **With reduced motion turned on:** one still frame of the scene.
- **A box further down the page:** nothing loads until the visitor scrolls near it. The scene pauses while it is off screen and while the tab is hidden.
- **What it costs:** the script is about 3 kB; the scene, about 134 kB (compressed), downloads only where it can run, once, and is then cached.
- **Privacy:** no cookies and no tracking. The script fetches only its own files.

## Checking that it works

Each box records how it went in `data-state`:

| `data-state`  | Meaning                                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| (none yet)    | The box is not near the screen yet, or the page is still loading.                                                 |
| `running`     | The scene is on screen.                                                                                           |
| `low-power`   | WebGL is drawn by the processor, or the device was too slow even at the lightest quality. The background shows.   |
| `unsupported` | The browser has no WebGL2. The background shows.                                                                  |
| `lost`        | The browser took the graphics away for a moment (phones do when short of memory). The scene comes back by itself. |
| `failed`      | The scene could not start. The console says why.                                                                  |

Your CSS can follow it, for example to show a hint that only makes sense while the scene is there (with `visibility`, so nothing moves when it appears):

```css
[data-sahra] .hint {
  visibility: hidden;
}
[data-sahra][data-state="running"] .hint {
  visibility: visible;
}
```

```html
<div data-sahra style="height: 480px; background: #0b0908">
  <p class="hint">Move the pointer across the sand.</p>
</div>
```

## When nothing shows

- **The box has no height.** Give it a `height`, `min-height` or `aspect-ratio`.
- **The script tag has no `type="module"`,** or it was removed when saving (see [WordPress](#wordpress)).
- **The site has a Content Security Policy** that blocks scripts from other sites. Add `https://sahra-khaki.vercel.app` to its `script-src`.
- **`data-state` is `low-power` or `unsupported`:** that device cannot run the scene, so the background shows, as intended. Try another browser or device.
- **The console names an option** it cannot use: fix the value it quotes.

## Hosting it yourself

To serve the files from your own domain, build the project (`pnpm build`) and copy `dist/embed/sahra.js` and the `dist/embed/assets/` folder next to each other, as they are. The script finds the scene beside itself. If pages on other domains load it, your server must send `Access-Control-Allow-Origin` for both files, as this site does (`vercel.json`): browsers load module scripts from other domains only with it.
