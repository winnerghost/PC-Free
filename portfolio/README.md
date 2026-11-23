# Syed Arham Ashraf — "Liquid → Solid"

The personal site of Syed Arham Ashraf: aspiring entrepreneur, digital creator and technology enthusiast from Raebareli, Uttar Pradesh, India, and Founder & CEO of QLive.

## The concept

Arham turns ideas into something tangible, and the site acts that out.

- **One object, live in 3D.** A liquid-chrome object, ray-marched in a WebGL shader (`assets/js/scene.js`), travels through the whole site. On the home page it starts as liquid you can push with your cursor, then hardens into a solid as you scroll through "Every idea starts liquid…", with a live *State* and *Solidity* readout.
- **It becomes the work.** In the ventures section it reshapes into each venture: a **Q** for QLive, a **tap card with NFC waves** for Nexora, a **twisted ring** for Nuviistudios and an **unstable, glitching sphere** for Dead Air, each lit in that venture's colour.
- **Pages are cards.** The menu drops the current page down like a card to reveal the navigation, and hovering any link morphs the object into that page's form as a live preview. Changing page deals a new card in: the old page lifts away, the destination's name stretches across the backstage, and the next page rises into place while the object glides to its new spot.
- **Type that moves.** Archivo's variable width axis drives the type: headlines unfold from condensed to full width, letters swell toward the cursor, and big type squeezes with scroll speed. Labels decode from scrambled glyphs.

## Pages

| File | What it is |
| --- | --- |
| `index.html` | "Ideas → Tangible" hero, the liquid-to-solid statement, the four ventures on one pinned stage, "Who I am" |
| `ventures.html` | The four ventures as a list; hovering a name turns the object into it |
| `venture.html` | One page per venture (`venture.html#qlive`), filled from `data.js` |
| `about.html` | Profile in his own words, "Business. Technology. Creativity." diagram with the object at the centre, Then · Now · Next, mindset |
| `contact.html` | "Let's build", location and local time, links to QLive and Nuviistudios |

## Content rule

Everything on the site comes from Arham's own description (see `../CLAUDE.md`). Nothing is invented: no years, statistics, clients or testimonials. Empty fields in `data.js` are hidden, not filled in.

## Updating it

- **Ventures**: `assets/js/data.js` → `IA.projects`. `shape` picks the object's form (`liquid`, `solid`, `qlive`, `card`, `twist`, `dead`, `gem`, `drop`) and `accent` the colour of its light.
- **Email and social links**: `IA.site.email` and `IA.site.socials`. Adding an email turns on the email buttons and the contact form.
- **Sending the form directly**: set `IA.site.formEndpoint` to a form service URL (for example Formspree).
- **Where the object sits**: each section's `data-obj="shape x y size dark [accent]"` (x/y from -1 to 1 across the screen, `-` keeps the current form, `none` hides it); `data-obj-m` is the phone version. `data-tone="light|dark"` sets the section's colours.
- **Colours and type**: tokens at the top of `assets/css/main.css`.
- The five HTML pages share the same header, menu, backstage and footer; change them together.

## Run it

```bash
cd portfolio
python3 -m http.server 8000
# open http://localhost:8000
```

Deploys as-is to GitHub Pages, Netlify or Vercel. Opened from disk (`file://`), page changes fall back to normal page loads.

## Built with

Hand-written WebGL (no 3D library), [GSAP](https://gsap.com) with ScrollTrigger, and [Lenis](https://lenis.darkroom.engineering) for smooth scrolling, all vendored in `assets/js/vendor/`. Fonts: Archivo and Geist Mono from Google Fonts.

Accessibility and performance: `prefers-reduced-motion` turns off smooth scrolling, the cursor, reveals and card animations, and slows the object to a near-still; touch scrolling stays native; the shader lowers its resolution when frames run long and only ray-marches inside the object's bounds; without WebGL the site works without the object.
