# GRIDIRON '99 — Retro Football Prototype

This is a separate, isolated game project inside the existing `fourthdown-ai` repository.

## Location

- App entry: `public/retro-bowl/index.html`
- Game engine: `public/retro-bowl/game.js`
- Local URL when the existing Worker/static assets project is running: `/retro-bowl/`

The existing GRIDIRON IQ app, Worker API, deployment configuration, and NFL analytics data remain untouched.

## Current prototype

- Side-view pixel-style football field rendered with Canvas.
- Responsive layout and touch controls for phones.
- Run, pass/throw, sprint, and dodge actions.
- First downs, tackles, turnovers on downs, touchdowns, quarter clock, and score.
- Franchise team selection, 17-game regular season structure, basic win/loss record, and browser-local save.
- Roster panel populated with real NFL player names and team associations from the repository's existing 2026 player dataset.

## Player data

The game reads `/data/nfl-players.json`, which is already maintained by the parent GRIDIRON IQ project. It contains NFL player-stat records sourced from nflverse. The current file identifies its season and retrieval timestamp in the JSON.

Important limitations:
- A statistics dataset is not the same as an official, complete active roster feed. Players who have not recorded a qualifying stat may be absent, and a player's team association may reflect their statistical record rather than a verified current depth chart.
- The displayed overall ratings are prototype gameplay estimates calculated from statistical production. They are not official ratings.
- Real player names are used as requested; official NFL/team logos, uniforms, photos, and player likenesses are not included.

## Run locally

From the repository root:

```bash
npm install
npm run dev
```

Then open `http://localhost:8787/retro-bowl/`.

## Next development milestones

1. Improve the play engine and make pass targeting/catching/tackling more reliable.
2. Add playable defensive possessions and defensive controls.
3. Add authentic 32-team schedules, standings, playoffs, and Super Bowl.
4. Build deeper rosters, depth charts, player ratings, contracts, draft, trades, injuries, and progression.
5. Add original pixel-art player sprites, team customization, sound, and an installable iPhone experience.
6. Add automated tests and verify the game in mobile Safari.

This is an early playable foundation, not a finished Retro Bowl replacement.