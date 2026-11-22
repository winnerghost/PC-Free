/* IRIS ARDEN — data.js
   All project content lives here. Edit this file to change the work shown on
   the Home, Work and project pages. Each cover is generated from `cover.style`
   (orbits, silk, rings, tiles, flow, cracks) and its five-colour palette. */
(function () {
  "use strict";
  const IA = window.IA;

  IA.site = {
    name: "Iris Arden",
    email: "studio@irisarden.example",
    city: "Lisbon",
    timezone: "Europe/Lisbon",
    tzLabel: "LIS",
  };

  IA.projects = [
    {
      slug: "halden-night-atlas",
      title: "Halden Night Atlas",
      client: "Halden Observatory",
      year: 2026,
      tags: ["Interactive", "WebGL"],
      role: "Creative direction, WebGL engineering",
      stack: ["WebGL2", "GLSL", "Astro", "Web Audio"],
      duration: "7 months",
      featured: true,
      hue: 0.62,
      tagline: "Two thousand years of sky, rendered live in a browser tab.",
      summary:
        "A real-time atlas of 118,000 catalogued stars. Visitors pick any date between 200 BC and today and watch the sky above the observatory turn, with constellations drawn by the cultures that named them.",
      challenge:
        "The observatory's planetarium seats 80 people and books out months ahead. They wanted the same sense of awe for anyone with a phone, with no app to download and no loss of scientific accuracy.",
      approach: [
        ["Accurate before beautiful", "Star positions come from a public astrometric catalogue and are precessed on the GPU for the chosen date. The observatory's astronomers signed off on every view."],
        ["One shader, every device", "Stars render as instanced point sprites in a single draw call. Older phones get fewer faint stars, never a lower frame rate."],
        ["Sound you can steer", "A generative score follows the brightest star in view. Turning the sky shifts the harmony, so exploring feels like playing an instrument."],
      ],
      results: [
        { v: 118, suffix: "k", l: "stars drawn at 60 frames per second" },
        { v: 4.2, decimals: 1, suffix: " min", l: "average time spent per visit" },
        { v: 310, prefix: "+", suffix: "%", l: "school bookings in the first quarter" },
      ],
      credits: [["Client", "Halden Observatory"], ["Design & WebGL", "Iris Arden"], ["Astronomy", "Observatory research team"], ["Sound", "Generative score, in-house"]],
      cover: { style: "orbits", palette: ["#0b0c1d", "#211a46", "#c2b0ff", "#ffb59a", "#f4ede7"] },
    },
    {
      slug: "ophira-nocturne",
      title: "Ophira Nocturne",
      client: "Ophira Parfums",
      year: 2025,
      tags: ["Identity", "WebGL"],
      role: "Art direction, interaction design, front-end",
      stack: ["Three.js", "GLSL", "Hydrogen", "Rive"],
      duration: "4 months",
      featured: true,
      hue: 0.05,
      tagline: "A fragrance launch you can almost smell.",
      summary:
        "Launch campaign and storefront for a night-blooming fragrance. Folds of silk-like light wrap the bottle and respond to touch, scroll and the time of day in the visitor's city.",
      challenge:
        "Perfume is sold on scent, and a screen has none. The brand needed the site to carry the mood of the fragrance in the first three seconds, then get out of the way of buying it.",
      approach: [
        ["Mood in three seconds", "The opening frame is a single slow fold of light timed to a breath. No loader, no copy, nothing covering it."],
        ["Time-aware atmosphere", "Colour temperature follows the visitor's local sunset: warmer at dusk, deep violet after midnight."],
        ["Buying without breaking the spell", "Adding to the bag happens in place. The silk folds around the product instead of opening a new page."],
      ],
      results: [
        { v: 2.1, decimals: 1, suffix: "M", l: "visits in launch week" },
        { v: 38, suffix: "%", l: "of visitors added a bottle to their bag" },
        { v: 1.4, decimals: 1, suffix: " s", l: "to first meaningful paint on a 4G connection" },
      ],
      credits: [["Client", "Ophira Parfums"], ["Direction & build", "Iris Arden"], ["3D bottle", "Studio partner"], ["Copy", "Brand team"]],
      cover: { style: "silk", palette: ["#1a0a14", "#3d1231", "#ffb59a", "#f59ab9", "#c2b0ff"] },
    },
    {
      slug: "northlight-records",
      title: "Northlight Records",
      client: "Northlight Records",
      year: 2025,
      tags: ["Identity", "Interactive"],
      role: "Identity design, generative systems",
      stack: ["TypeScript", "Web Audio", "Canvas", "Node"],
      duration: "Ongoing since 2024",
      featured: true,
      hue: 0.4,
      tagline: "Every release draws its own cover.",
      summary:
        "A generative identity for an independent label. Each record's artwork, posters and web page are drawn by software that listens to the master recording.",
      challenge:
        "Twelve releases a year, a two-person team and no budget for an illustrator per record. The label wanted a recognisable look that still made every album feel like its own object.",
      approach: [
        ["Listen first", "The system analyses tempo, key and loudness over time, then turns them into ring spacing, colour and line weight."],
        ["Rules instead of templates", "Designers tune a handful of parameters per release. One export covers print, social and web sizes."],
        ["Sleeves that play", "On the website the artwork moves with the record, redrawing itself in time with the music."],
      ],
      results: [
        { v: 36, l: "releases designed by the system so far" },
        { v: 9, suffix: " min", l: "from master file to print-ready artwork" },
        { v: 5, suffix: "×", l: "more merch pre-orders per release" },
      ],
      credits: [["Client", "Northlight Records"], ["System design", "Iris Arden"], ["Print", "Riso partner studio"], ["Audio analysis", "Open-source DSP libraries"]],
      cover: { style: "rings", palette: ["#0f0a10", "#251828", "#9ff0d4", "#c2b0ff", "#f4ede7"] },
    },
    {
      slug: "tessellate-motion",
      title: "Tessellate Motion Language",
      client: "Tessellate Labs",
      year: 2024,
      tags: ["Interactive"],
      role: "Motion direction, design systems",
      stack: ["Rive", "Figma", "Swift", "Lottie"],
      duration: "5 months",
      featured: true,
      hue: 0.75,
      tagline: "A motion language for interfaces without screens.",
      summary:
        "Motion principles, tokens and components for a spatial operating system concept. Windows tile, fold and hand off to each other like sheets of glass.",
      challenge:
        "Spatial interfaces float in a real room, so there is no screen edge to slide in from. The team needed rules for where things come from, where they go and how fast, before designing a single app.",
      approach: [
        ["Physics as tokens", "Every transition is a named spring with mass and damping values, shared by design and engineering."],
        ["Depth that explains", "Layers move in parallax by importance. What you need now is closest; what you might need next waits behind."],
        ["A living specification", "The documentation is itself a prototype. Engineers inspect any animation and copy its exact values."],
      ],
      results: [
        { v: 42, l: "motion tokens replacing 300+ one-off animations" },
        { v: 120, suffix: " fps", l: "held on the prototype headset" },
        { v: 60, suffix: "%", l: "less time from design to build for new apps" },
      ],
      credits: [["Client", "Tessellate Labs"], ["Motion direction", "Iris Arden"], ["Engineering", "Tessellate platform team"], ["Research", "In-house UX lab"]],
      cover: { style: "tiles", palette: ["#0e0c18", "#231d38", "#c2b0ff", "#9ff0d4", "#f4ede7"] },
    },
    {
      slug: "atlas-of-tides",
      title: "Atlas of Tides",
      client: "Marlow Ocean Institute",
      year: 2023,
      tags: ["Data", "WebGL"],
      role: "Data visualisation, WebGL engineering",
      stack: ["WebGL", "D3", "GLSL", "Python"],
      duration: "6 months",
      featured: false,
      hue: 0.33,
      tagline: "Thirty years of ocean currents under your fingertip.",
      summary:
        "An interactive map of global surface currents built from three decades of satellite data. A million particles trace the water's path in real time.",
      challenge:
        "The institute's data was accurate, enormous and impossible to read. Researchers wanted a public tool that made the scale of ocean circulation something you feel before you study it.",
      approach: [
        ["Particles carry the data", "Each particle moves through a velocity field decoded from a compressed texture, so a million points cost one draw call."],
        ["Touch to trace", "Press anywhere to release dye into the current and follow where a drop of water travels over a year."],
        ["Readable at every zoom", "Annotations fade in by zoom level, written with the scientists in plain language."],
      ],
      results: [
        { v: 1, suffix: "M", l: "particles animated on the GPU" },
        { v: 30, l: "years of satellite data in one view" },
        { v: 140, suffix: "k", l: "classroom sessions in the first year" },
      ],
      credits: [["Client", "Marlow Ocean Institute"], ["Visualisation", "Iris Arden"], ["Data", "Institute research group"], ["Education", "Partner schools"]],
      cover: { style: "flow", palette: ["#061419", "#0c2a33", "#9ff0d4", "#bfe4ff", "#c2b0ff"] },
    },
    {
      slug: "kintsu-ceramics",
      title: "Kintsu Ceramics",
      client: "Kintsu Workshop",
      year: 2022,
      tags: ["Interactive", "Identity"],
      role: "Product design, 3D configurator",
      stack: ["Three.js", "React", "Blender", "Shopify"],
      duration: "5 months",
      featured: false,
      hue: 0.1,
      tagline: "Repair, made visible and made to order.",
      summary:
        "An online studio for a ceramics workshop that mends broken pieces with gold. Customers design a bowl, then choose how it was broken and how it was repaired.",
      challenge:
        "Each piece is unique, so product photography could never show what a customer would receive. The workshop needed a way to preview a one-of-a-kind object before it existed.",
      approach: [
        ["Procedural cracks", "Fracture patterns grow from the point a customer taps, following the same rules the potters use to plan a repair."],
        ["True-to-kiln materials", "Glazes were scanned from fired test tiles, so the screen matches what comes out of the kiln."],
        ["A certificate of history", "Every order ships with a printed map of its own cracks, generated by the configurator."],
      ],
      results: [
        { v: 3.4, decimals: 1, suffix: "×", l: "conversion rate compared with the previous shop" },
        { v: 28, suffix: "%", l: "fewer returns" },
        { v: 6, suffix: " wks", l: "waiting list, up from none" },
      ],
      credits: [["Client", "Kintsu Workshop"], ["Product design & 3D", "Iris Arden"], ["Ceramics", "Workshop potters"], ["Photography", "Glaze scans in-house"]],
      cover: { style: "cracks", palette: ["#141015", "#2b2329", "#e8c27a", "#ffb59a", "#f4ede7"] },
    },
  ];

  IA.project = (slug) => IA.projects.find((p) => p.slug === slug);
})();
