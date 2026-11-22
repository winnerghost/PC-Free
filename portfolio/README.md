# Iris Arden — portfolio

A multi-page portfolio built by hand with no frameworks, no build step and no image files. Every visual on the site is drawn live in the browser.

The name, projects, clients and figures are placeholder content for a fictional creative technologist. Replace them with your own (see **Make it yours** below).

## The concept: Lacquer & Opal

The whole identity is built around a lens. A living iris, written as a WebGL shader, sits behind every page:

- **Home** — scrolling dilates the pupil until it swallows the screen, so you fall into the site. At the footer it contracts again beside the call to action.
- **Page transitions** — a seven-blade camera aperture closes, the next page loads behind it, and the blades open again. The iris glides to its new position for that page instead of reloading.
- **f-stop meter** — the small dial in the corner stops down from f/1.4 to f/22 as you read further down a page.
- **Work** — each project frame starts as a monochrome latent image; your cursor is a lens that develops it into colour.
- **Theme** — Lacquer (dark mulberry) and Porcelain (light). The switch runs through the aperture, and the iris changes from light on black to pigment on porcelain.

## Pages

| File | What it is |
| --- | --- |
| `index.html` | Hero with the iris, scroll-lit manifesto, selected work with a floating cursor preview, a pinned horizontal process section, capabilities marquee |
| `work.html` | Filterable grid with tilt, glare and the developing lens; switchable list view |
| `project.html` | Case study template filled from `data.js` (`project.html#slug`), with a live animated cover, results counters and a "next project" hand-off |
| `about.html` | Contour-map self-portrait you can disturb, experience timeline, interactive toolkit constellation, principles, talks |
| `lab.html` | Four live experiments: Field Type (particles), Aperture (optics), Long Exposure (light painting), Moiré |
| `contact.html` | Variable-weight title that swells toward the cursor, copy-to-clipboard email, project form |

## Run it

Any static server works. From this folder:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

It also deploys as-is to GitHub Pages, Netlify or Vercel. Opening the files straight from disk (`file://`) works too, but page transitions fall back to normal page loads because browsers block `fetch` there.

## Make it yours

- **Projects**: edit `assets/js/data.js`. Each project has text, results and a generated cover (`cover.style` is one of `orbits`, `silk`, `rings`, `tiles`, `flow`, `cracks`, plus a five-colour palette).
- **Name, email, city, time zone**: `IA.site` at the top of `assets/js/data.js`, then search and replace "Iris Arden" and the email address across the HTML files.
- **Colours and type**: all tokens are at the top of `assets/css/style.css` (dark values on `:root`, light values in the two Porcelain blocks).
- **Contact form**: with no server, the form prepares the message and offers to open it in the visitor's email app or copy it. To send directly, add a form service endpoint (for example Formspree) as `data-endpoint="https://…"` on the `<form>` in `contact.html`.
- **Portrait**: the About page draws a contour portrait. To use a photo, replace the `<canvas>` inside `.portrait-frame` with an `<img>`.

## How it is built

| File | Responsibility |
| --- | --- |
| `assets/js/lib.js` | Math, easing, one shared `requestAnimationFrame` ticker, tweens, text splitting, seeded noise |
| `assets/js/gl.js` | The iris fragment shader and its per-page state |
| `assets/js/art.js` | Aperture blade renderer and the generative project covers |
| `assets/js/core.js` | Theme, smooth wheel scrolling, custom cursor, magnetic and tilt effects, aperture transitions, the fetch-based router, preloader, header |
| `assets/js/pages.js` | Home, Work, Project, About and Contact behaviour |
| `assets/js/lab.js` | The four Lab experiments |

Accessibility and performance:

- `prefers-reduced-motion` turns off smooth scrolling, the custom cursor, scroll reveals and the aperture animation, and slows the shader to a near-still image.
- Touch and keyboard scrolling stay native; the custom cursor only appears with a mouse.
- The shader lowers its own resolution when frames run long and pauses while the aperture is closed or the tab is hidden. Lab experiments only run while on screen.
- If WebGL is unavailable, a CSS gradient iris is shown instead.
