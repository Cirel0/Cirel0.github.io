# Cirel0 — Roblox scripting portfolio

Live site: https://cirel0.github.io

## Edit content

| File | What to change |
|------|----------------|
| `data/profile.json` | Bio, skills, avatar path, contact links |
| `data/games.json` | Games (name, `placeId`, role, tags, blurb, image, `playUrl`) |
| `data/testimonials.json` | Curated quotes |
| `assets/` | Replace placeholder SVGs with real images |

When you set a real Roblox `placeId`, a GitHub Action refreshes `data/stats.json` hourly (CCU + visits). Games without a `placeId` keep the numbers already in `stats.json` until you add one.

## Local preview

Open `index.html` via a local static server (needed for `fetch` of JSON):

```bash
npx --yes serve .
```
