/* ─────────────────────────────────────────────────────────────────────────
   SENTINEL — launch teaser. Edit the words here.
   Times are in seconds on a 96 BPM grid (bar = 2.5 s); the film is a 40 s
   seamless loop.  *word* = accent colour,  | = line break.
   ───────────────────────────────────────────────────────────────────────── */
window.SENTINEL_CONFIG = {
  duration: 40,
  brand: 'SENTINEL',
  maker: 'Arham Ashraf',
  ring: '#9fd8ff',          // Sentinel's light ring (ice blue)
  nightHour: 21.68,         // 9:41 PM: the time the story happens

  beats: [
    { kind: 'intro', t0: 0.75, t1: 2.35, text: 'It sees.' },
    { kind: 'intro', t0: 3.0, t1: 4.85, text: 'It listens.' },
    { kind: 'intro', t0: 5.45, t1: 7.3, text: 'It never sleeps.' },
    { kind: 'brand', t0: 7.75, t1: 9.85, text: 'SENTINEL', sub: 'The smart guardian for your gate.' },
    { t0: 10.6, t1: 14.7, text: 'Knock *detection.*', sub: 'Know the moment someone knocks.' },
    { t0: 15.35, t1: 19.75, text: 'Gate open. Gate *closed.*', sub: 'Every movement of your gate, in real time.' },
    { t0: 20.35, t1: 24.75, text: 'Senses motion. *24/7.*', sub: 'A camera that watches every hour of every day.' },
    { t0: 26.45, t1: 29.75, text: 'Watch live from *anywhere.*', sub: 'Anywhere in the world, your gate is one tap away.' },
    { t0: 30.45, t1: 34.35, text: 'Saved to the *cloud.*', sub: 'Every clip, ready to replay whenever you need it.' },
    { kind: 'credit', t0: 35.55, t1: 37.35, over: 'Designed & built by', text: 'Arham Ashraf' },
    { kind: 'end', t0: 37.7, t1: 39.45, text: 'SENTINEL', sub: 'Coming soon' },
  ],

  cards: {
    knock: ['Knock detected', 'Front gate · just now'],
    opened: ['Gate opened', 'Front gate · 9:41 PM'],
    closed: ['Gate closed', 'Front gate · 9:42 PM'],
    person: 'Person detected',
    live: ['Front gate', 'Live view'],
    cloud: ['Clip saved to cloud', 'Front gate · 9:42 PM'],
  },

  timing: {
    knockCard: [12.05, 14.5],
    openedCard: [16.2, 17.75],
    closedCard: [18.85, 19.7],
    dial: [20.25, 24.8],
    phone: [27.55, 29.8],
    cloudCard: [32.05, 34.3],
  },

  // home is somewhere in South Asia; arcs reach out to cities around the world
  globe: {
    home: [30.5, 73.8],
    cities: [[51.5, -0.13], [25.2, 55.3], [40.7, -74.0], [1.35, 103.8], [-33.87, 151.2], [43.65, -79.4], [24.7, 46.7]],
  },
};
