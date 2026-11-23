# Syed Arham Ashraf — portfolio

The personal site of Syed Arham Ashraf: aspiring entrepreneur, digital creator and technology enthusiast from Raebareli, Uttar Pradesh, India, and Founder & CEO of QLive.

Built by hand with no frameworks, no build step and no image files. Every visual on the site is drawn live in the browser.

## The idea: vision

The identity is built around an eye and a lens, standing for vision: a founder's eye for opportunities, and the focus needed to turn an idea into something tangible.

- **A living iris** (a WebGL shader) sits behind every page. On the home page, scrolling dilates the pupil until you fall into the site; at the footer it closes again beside the call to action.
- **Page transitions** close a seven-blade camera aperture, load the next page behind it, and open again.
- **f-stop meter**: the dial in the corner stops down from f/1.4 to f/22 as you read down a page.
- **Ventures**: each frame starts as a monochrome latent image; the cursor develops it into colour.
- **Themes**: Lacquer (dark mulberry) and Porcelain (light), switched through the aperture.

## Pages

| File | What it is |
| --- | --- |
| `index.html` | Hero with the iris and full-width name, "Who I am" text that lights up as you scroll, the four ventures with a floating preview, "From idea to tangible" (Notice, Shape, Build, Grow), interests marquee |
| `ventures.html` | QLive, Nexora, Nuviistudios and Dead Air as a filterable grid or list |
| `venture.html` | One page per venture (`venture.html#qlive`), filled from `data.js`, with a live generative cover |
| `about.html` | Profile in his own words, Then · Now · Next with a live map from Raebareli to Lucknow, an interests constellation, mindset |
| `lab.html` | Interactive experiments built into the site: particle type, a camera aperture, light painting, moiré |
| `contact.html` | "Let's build", location and local time, links to QLive and Nuviistudios |

## Content rule

Everything on the site comes from Arham's own description. Nothing is invented: no years, statistics, clients or testimonials. Fields left empty in `data.js` are hidden on the page rather than filled in.

## Updating it

- **Ventures**: `assets/js/data.js` → `IA.projects`. Empty fields (`role`, `status`, `stack`, `link`, `story`) are hidden automatically. Cover styles: `queue` (QLive), `signal` (Nexora), `silk` (Nuviistudios), `static` (Dead Air); `orbits`, `rings`, `tiles`, `flow`, `cracks` are also available.
- **Email and social links**: `IA.site.email` and `IA.site.socials` in `data.js`. Adding an email turns on the email card, the footer email button and the contact form. Social links appear on the Contact page and in the footer.
- **Sending the form directly**: set `IA.site.formEndpoint` to a form service URL (for example Formspree). Without it, the form prepares the message for the visitor's email app.
- **Photo**: the About page draws a contour portrait. To use a photo, replace the `<canvas>` in `.portrait-frame` with an `<img>`.
- **Colours and type**: tokens at the top of `assets/css/style.css`.
- The six HTML pages share the same header, menu and footer; change all six together.

## Run it

```bash
cd portfolio
python3 -m http.server 8000
# open http://localhost:8000
```

Deploys as-is to GitHub Pages, Netlify or Vercel. Opened straight from disk (`file://`), page transitions fall back to normal page loads.

## How it is built

| File | Responsibility |
| --- | --- |
| `assets/js/lib.js` | Math, easing, one shared animation loop, tweens, text splitting, seeded noise |
| `assets/js/data.js` | Site settings and venture content |
| `assets/js/gl.js` | The iris shader and its per-page state |
| `assets/js/art.js` | Aperture renderer and generative venture covers |
| `assets/js/core.js` | Theme, smooth scrolling, cursor, transitions, router, preloader, header |
| `assets/js/pages.js` | Home, Ventures, Venture, About and Contact behaviour |
| `assets/js/lab.js` | The Lab experiments |

Accessibility and performance: `prefers-reduced-motion` turns off smooth scrolling, the custom cursor, scroll reveals and the aperture animation; touch and keyboard scrolling stay native; the shader lowers its resolution when frames run long and pauses when hidden; Lab experiments only run on screen; without WebGL a CSS gradient iris is shown.
