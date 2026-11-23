/* ARHAM — data.js
   Everything the site says lives here.
   Rule: only real facts. If something is unknown (a year, a number, a link),
   leave it empty; the pages hide empty fields instead of filling them in.

   shape  = the form the 3D object takes for this venture:
            liquid, solid, qlive, card, twist, dead, gem, drop
   accent = the colour of the light reflected in the object */
(function () {
  "use strict";
  const IA = (window.IA = window.IA || {});

  IA.site = {
    name: "Syed Arham Ashraf",
    role: "Founder & CEO, QLive",
    city: "Raebareli",
    region: "Uttar Pradesh, India",
    timezone: "Asia/Kolkata",
    tzLabel: "IST",
    // Add a public email to switch on the email button and the contact form.
    email: "",
    // Optional form service endpoint (for example Formspree) to send messages directly.
    formEndpoint: "",
    // Public profiles, e.g. { label: "Instagram", href: "https://www.instagram.com/your-handle/" }
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
      shape: "qlive",
      accent: "#19d3a6",
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
    },
    {
      slug: "nexora",
      title: "Nexora",
      kind: "Venture",
      role: "",
      status: "",
      tags: ["Business", "Web"],
      stack: [],
      shape: "card",
      accent: "#ff7a2f",
      link: null,
      tagline: "Practical digital presence for traditional businesses.",
      summary: "Nexora is a business venture focused on helping local businesses strengthen their digital presence.",
      idea:
        "Bring practical digital solutions to traditional businesses, and help them become more accessible, credible and digitally connected.",
      includesTitle: "What Nexora offers",
      includes: ["Website development", "Google Business Profile setup", "Instagram presence", "NFC-enabled Google review cards"],
      story: [],
    },
    {
      slug: "nuviistudios",
      title: "Nuviistudios",
      kind: "Creative exploration",
      role: "",
      status: "",
      tags: ["Creative", "Web"],
      stack: [],
      shape: "twist",
      accent: "#b46cff",
      link: { label: "nuviistudios.com", href: "https://nuviistudios.com" },
      tagline: "Where technology, visual storytelling and interaction meet.",
      summary: "Nuviistudios represents my interest in creative digital experiences, experimentation and ambitious web projects.",
      idea:
        "I'm fascinated by immersive web experiences, and by what becomes possible when technology, visual storytelling and interaction are combined.",
      includesTitle: "What it explores",
      includes: ["Immersive web experiences", "Visual storytelling", "Interaction", "Ambitious web projects"],
      story: [],
    },
    {
      slug: "dead-air",
      title: "Dead Air",
      kind: "Game concept",
      role: "",
      status: "Concept in exploration",
      tags: ["Game", "Creative"],
      stack: ["Roblox Studio"],
      shape: "dead",
      accent: "#ff2e2e",
      link: null,
      tagline: "A horror and survival game, explored in Roblox Studio.",
      summary: "Dead Air is a horror and survival game concept I'm exploring through Roblox Studio.",
      idea:
        "It reflects another side of my creativity: interactive storytelling, game concepts and atmosphere, and building experiences beyond traditional websites.",
      includesTitle: "What it explores",
      includes: ["Horror and survival", "Interactive storytelling", "Atmosphere", "Game concepts"],
      story: [],
    },
  ];

  IA.project = (slug) => IA.projects.find((p) => p.slug === slug);
})();
