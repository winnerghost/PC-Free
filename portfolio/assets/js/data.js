/* SYED ARHAM ASHRAF — data.js
   Everything the site says about the ventures lives here.
   Rule for this file: only real facts. If something is unknown (a year, a
   number, a link), leave it out; the pages hide any field that is empty.

   Cover styles: queue, signal, silk, static (plus orbits, rings, tiles,
   flow, cracks), each with a five-colour palette. */
(function () {
  "use strict";
  const IA = window.IA;

  IA.site = {
    name: "Syed Arham Ashraf",
    role: "Founder & CEO, QLive",
    city: "Raebareli",
    region: "Uttar Pradesh, India",
    timezone: "Asia/Kolkata",
    tzLabel: "IST",
    // Add a public email to switch on the email card and the contact form.
    email: "",
    // Optional form service endpoint (for example Formspree) to send messages directly.
    formEndpoint: "",
    // Public profiles, shown on the Contact page and in the footer, e.g.
    // { label: "Instagram", href: "https://www.instagram.com/your-handle/" }
    socials: [],
  };

  IA.projects = [
    {
      slug: "qlive",
      title: "QLive",
      kind: "Venture",
      role: "Founder & CEO",
      status: "Evolving",
      tags: ["Business", "Web"],
      stack: ["PHP", "MySQL"],
      hue: 0.42,
      link: { label: "q-live.in", href: "https://q-live.in" },
      tagline: "Queue Live: from a clinic waiting room to premium digital experiences.",
      summary:
        "QLive (Queue Live) is my venture. It started with an idea for queue and appointment management for local healthcare businesses, and has since evolved toward premium digital experiences and web development.",
      idea:
        "The first implementation was a queue management system for a clinic. It made the waiting room visible: who is next, how long the wait will be, and how the day is going.",
      includesTitle: "The clinic system",
      includes: ["Token generation", "Live queue tracking", "Estimated waiting times", "Analytics"],
      story: [
        ["Where it started", "Queue and appointment management for local healthcare businesses, built with PHP and MySQL."],
        ["Where it is going", "Premium digital experiences and web development, with a vision of helping businesses establish a stronger digital presence."],
      ],
      cover: { style: "queue", palette: ["#071316", "#0f2a2e", "#9ff0d4", "#c2b0ff", "#f4ede7"] },
    },
    {
      slug: "nexora",
      title: "Nexora",
      kind: "Venture",
      role: "",
      status: "",
      tags: ["Business", "Web"],
      stack: [],
      hue: 0.08,
      link: null,
      tagline: "Practical digital presence for traditional businesses.",
      summary:
        "Nexora is a business venture focused on helping local businesses strengthen their digital presence.",
      idea:
        "Bring practical digital solutions to traditional businesses, and help them become more accessible, credible and digitally connected.",
      includesTitle: "What Nexora offers",
      includes: ["Website development", "Google Business Profile setup", "Instagram presence", "NFC-enabled Google review cards"],
      story: [],
      cover: { style: "signal", palette: ["#0d0b16", "#211a3a", "#ffb59a", "#c2b0ff", "#f4ede7"] },
    },
    {
      slug: "nuviistudios",
      title: "Nuviistudios",
      kind: "Creative exploration",
      role: "",
      status: "",
      tags: ["Creative", "Web"],
      stack: [],
      hue: 0.9,
      link: { label: "nuviistudios.com", href: "https://nuviistudios.com" },
      tagline: "Where technology, visual storytelling and interaction meet.",
      summary:
        "Nuviistudios represents my interest in creative digital experiences, experimentation and ambitious web projects.",
      idea:
        "I'm fascinated by immersive web experiences, and by what becomes possible when technology, visual storytelling and interaction are combined.",
      includesTitle: "What it explores",
      includes: ["Immersive web experiences", "Visual storytelling", "Interaction", "Ambitious web projects"],
      story: [],
      cover: { style: "silk", palette: ["#1a0a14", "#3d1231", "#ffb59a", "#f59ab9", "#c2b0ff"] },
    },
    {
      slug: "dead-air",
      title: "Dead Air",
      kind: "Game concept",
      role: "",
      status: "Concept in exploration",
      tags: ["Game", "Creative"],
      stack: ["Roblox Studio"],
      hue: 0.02,
      link: null,
      tagline: "A horror and survival game, explored in Roblox Studio.",
      summary: "Dead Air is a horror and survival game concept I'm exploring through Roblox Studio.",
      idea:
        "It reflects another side of my creativity: interactive storytelling, game concepts and atmosphere, and building experiences beyond traditional websites.",
      includesTitle: "What it explores",
      includes: ["Horror and survival", "Interactive storytelling", "Atmosphere", "Game concepts"],
      story: [],
      cover: { style: "static", palette: ["#09090a", "#151213", "#d6483a", "#86978d", "#e9e4dc"] },
    },
  ];

  IA.project = (slug) => IA.projects.find((p) => p.slug === slug);
})();
