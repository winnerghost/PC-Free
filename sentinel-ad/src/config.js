/* ─────────────────────────────────────────────────────────────────────────
   SENTINEL — ad configuration.  Edit the words, price and colours here.
   Times are in seconds. The film is a 36-second seamless loop, cut to an
   80 BPM grid (one beat = 0.75 s, one bar = 3 s), so the music lines up.

   Text markup:  *word*  → accent colour (cyan, or red while the alarm is on)
                 |       → line break
   ───────────────────────────────────────────────────────────────────────── */
window.SENTINEL_CONFIG = {
  duration: 36,
  bpm: 80,

  brand: 'SENTINEL',
  maker: 'Arham Ashraf',
  currency: 'Rs',
  price: '5,999',
  clock: { hh: '03', mm: '07', ampm: 'AM' },

  // Headlines, in order. Each one flows up and out as the next flows in.
  beats: [
    { t0: 0.30, t1: 2.62, text: "Everyone's asleep." },
    { t0: 3.04, t1: 5.42, text: '*Sentinel* isn’t.' },
    { t0: 6.42, t1: 8.62, text: 'Meet *Sentinel.*', sub: 'The home guard that never sleeps.' },
    { t0: 9.20, t1: 11.62, text: 'Sees in the *dark.*' },
    { t0: 12.20, t1: 14.62, text: 'Catches *every move.*' },
    { t0: 15.30, t1: 17.62, text: 'Alerts your phone.|*Instantly.*' },
    { t0: 18.20, t1: 20.62, text: 'Sounds the *alarm.*' },
    { t0: 21.20, t1: 23.52, text: 'Plug it in.|*You’re protected.*' },
    { t0: 24.62, t1: 28.92, text: 'Peace of mind.', sub: 'One-time price · No monthly fees' },
    { t0: 29.55, t1: 32.05, kind: 'credit', over: 'Designed & built by', text: 'Arham Ashraf' },
    { t0: 32.50, t1: 35.12, kind: 'endcard', text: 'SENTINEL', sub: 'Never sleeps.', cta: 'Order now', ctaPrice: 'Rs 5,999' },
  ],

  // Little viewfinder read-out in the top-left corner (one per bar).
  hud: [
    [0.0, 'CAM 01 · 03:07 AM · ALL QUIET'],
    [3.0, 'SENTINEL · ONLINE'],
    [6.0, 'SYSTEM · READY'],
    [9.0, 'IR NIGHT VISION · ON'],
    [12.0, 'MOTION · DETECTED'],
    [15.0, 'ALERT · SENT TO PHONE'],
    [18.0, 'SIREN · ACTIVE'],
    [21.0, 'STATUS · ARMED'],
    [24.0, 'ONE-TIME · RS 5,999'],
    [29.25, 'DESIGNED & BUILT · A. ASHRAF'],
    [32.25, 'SENTINEL · NEVER SLEEPS'],
  ],

  // Words that travel around the price ring.
  badge: 'ONE-TIME PRICE • NO MONTHLY FEES • BUILT TO PROTECT • ',

  // Phone notification.
  notification: { app: 'SENTINEL', when: 'now', title: 'Motion detected', body: 'Person at front door' },

  colors: {
    bg: '#030509',
    bgLift: '#0b1626',
    accent: '#3fe6ff',      // Sentinel cyan
    accentHot: '#d9fbff',
    alert: '#ff2e4f',       // alarm red
    alertHot: '#ffd6dc',
    text: '#f3f6fa',
    dim: '#8b96a8',
  },
};
