# About the owner: Syed Arham Ashraf

This repository holds Arham's personal portfolio in `portfolio/`. The root files are a separate project (PC-Free, forked from jephersonRD/pc-free) and are not part of the portfolio.

## Who he is (his own description)

- **Name:** Syed Arham Ashraf
- **Based in:** Raebareli, Uttar Pradesh, India, with ambitions to expand into Lucknow and beyond.
- **Describes himself as:** an aspiring entrepreneur, digital creator and technology enthusiast. A builder with an entrepreneurial mindset who identifies opportunities, develops ideas, creates digital products and turns concepts into something tangible. Not "just someone who builds websites."
- **Interests:** website development and digital experiences; frontend development and interactive web technologies; digital entrepreneurship and business development; brand building and creative direction; AI-powered tools and emerging technologies; digital marketing and online business growth; product ideation.
- **Personality the portfolio should convey:** entrepreneurial rather than corporate; creative but commercially aware; interested in technology and innovation; ambitious without pretending to be more experienced than he is; curious, experimental, continuously evolving; passionate about building things with real value.
- **Stage:** early in his professional journey. He has curiosity, initiative, willingness to experiment and a drive to build. He does not claim decades of experience or a large client portfolio.

## Ventures and projects

1. **QLive (Queue Live)**: Founder & CEO. Started as queue and appointment management for local healthcare businesses. First implementation: a clinic queue system with token generation, queue tracking, estimated waiting times and analytics, built with PHP and MySQL. Later evolved toward premium digital experiences and web development, to help businesses build a stronger digital presence. Website: https://q-live.in
2. **Nexora**: business venture helping local businesses strengthen their digital presence. Offerings: website development, Google Business Profile setup, Instagram presence, NFC-enabled Google review cards. No website given.
3. **Nuviistudios**: his creative digital exploration: immersive web experiences, experimentation, ambitious web projects, combining technology, visual storytelling and interaction. Website: https://nuviistudios.com
4. **Dead Air**: a horror and survival game concept he is exploring in Roblox Studio (interactive storytelling, atmosphere, game concepts).

## Hard rule for anything written about him

Do not invent achievements, clients, projects, statistics, years, testimonials, qualifications, job history, awards or contact details. If information is missing, leave it out; the portfolio hides empty fields on purpose. Only add new facts he provides.

Not yet provided (ask before adding): a public email address, social profile links, a photo, dates or years for any venture, and his title at Nexora, Nuviistudios or Dead Air.

## Working on the portfolio

- Static site, no build step. Serve `portfolio/` with any static server (`python3 -m http.server`). GSAP, ScrollTrigger and Lenis are vendored in `portfolio/assets/js/vendor/`.
- All venture content lives in `portfolio/assets/js/data.js` (`IA.projects`), and site settings (email, form endpoint, social links, time zone) in `IA.site` in the same file.
- The five HTML pages (index, ventures, venture, about, contact) share identical header, menu, backstage, footer and script blocks. A change to navigation or the footer must be made in all five.
- Concept, "Liquid → Solid" (chosen after Arham rejected an earlier iris/aperture design as generic; do not bring that back): one ray-marched liquid-chrome object (`scene.js`) travels through the site, hardening from liquid into each venture's form. Pages behave as cards: the menu drops the page to reveal links and previews each page's form; page changes deal a new card in. Type is Archivo with its variable width axis plus Geist Mono labels; studio-grey light sections and ink dark sections, signal blue accent. Tokens are at the top of `portfolio/assets/css/main.css`.
- Sections place the object with `data-obj="shape x y size dark [accent]"` (`data-obj-m` for phones) and set colours with `data-tone`.
