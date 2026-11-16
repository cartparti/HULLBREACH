# Hullbreach

A grimdark co-op pixel-art extraction game. Fly your ship between sectors, take contracts from brokers and pilgrims, board burning derelicts, and get the black box out before the husks, the fire or the vacuum get you.

Turn-based, simulation-driven, and built for squads of up to four.

![Hullbreach icon](web/icons/icon-192.png)

## Play

- **On your phone:** open the GitHub Pages site (see *Deploying* below), then use your browser's **Add to Home Screen** / **Install app**. It runs full-screen and works offline for solo play.
- **On PC:** open the same site in any modern browser.
- **Squads (up to 4):** open the **Crew** panel on your ship. In the app, squads meet on a Hullbreach squad server: host one for free with the included relay (see [server/README.md](server/README.md)), set your callsign and connect. The claude.ai build of the game uses claude.ai's own real-time rooms and cloud saves instead. Both run the same squad protocol.

## What's in the game

- **Simulation first.** Zone atmosphere with decompression and wind, spreading fire that needs oxygen, chain-reacting fuel drums, station power, doors that husks batter down.
- **Per-limb wounds.** Bleeding, crippled legs, ruined aim, suit oxygen, trauma kits.
- **Your ship.** A proper hull: drive housings and exhaust at the stern, a reactor in the engine room, rooms off a central spine, and a tapered bridge at the nose. Walk the engine room, armory, quarters, break room, hold, airlock, bathroom, brig, infirmary and bridge. Every fixture does something. Terminals: star map, loadout rack, workbench, wardrobe, stash locker, contract board, records, airlock.
- **Furniture that makes sense.** Lockers and racks line the back wall, desks get chairs, tables sit in the middle with seats around them, crates and drums pack into corners, shrines get an altar, pews and braziers. Steam, sparks, dust in lamp light and beams through doorways.
- **Procedural stations.** Every raid builds a new station from a seed: docking bay, corridors, medbays, labs, shrines, armories, a vault with the black box. Squads share the seed, so everyone boards the same station.
- **Start with nothing.** You begin in street clothes with a 20 O₂ rebreather and three pockets. Find or craft armour, packs and weapons.
- **Loot with rarity.** Common, uncommon, rare, extremely rare and legendary. Machine pistols, revolvers, SMGs, bullpups, battle rifles, auto-shotguns, coach guns, pipe shotguns, bolt-action and marksman rifles, grenade launchers, machetes, crowbars, chain-blades and throwables, plus suits and packs. Extremely rare and legendary gear is unique and named (the Widow, the Last Word, the Hymn of Ash...).
- **Food and water.** Both drain on raids and while the ship travels. Well fed and watered, you slowly regain blood; hungry or thirsty, your aim slips; at zero you lose blood. Eat at the galley bar aboard, or carry rations, stew, water and recaf.
- **Fabricator and ship upgrades.** The fabrication bay crafts weapons, armour, gear, meds, food and ammo. Install ship parts and tech cores found on missions to upgrade it through five levels, unlocking better recipes and better quality gear.
- **Flashlights.** Your light sets how far and wide you see in the dark. The scav kit includes one.
- **Ammo and crafting.** Five ammo types that run out. Find more, buy it, or craft it at the workbench from scrap, propellant and circuitry. Break down gear for materials and upgrade packs up to +3 slots.
- **Inventory.** I / Tab (or the bag button) shows equipped gear, every limb's health, blood, O₂, the ammo pouch and the backpack, with use, equip, throw, drop and give.
- **Armour you can see.** Helmet, chest, legs and accessory slots: 8 helmets, 9 chest pieces, 7 leg pieces and 9 accessories (capes, scarves, bandoliers, spiked pauldrons, shoulder lamps, litany seals, a smoking censer, a skull drone). Every piece is drawn on your character and protects its own limbs.
- **Your look.** Skin tone, face, eyes, hairstyle and colour, top, bottoms and boots are free to change in the wardrobe. Armour sets your silhouette; cloak, visor and crest dyes unlock when you bring them home.
- **A small galaxy.** Three sectors, nine locations: stations with traders, outposts with contract givers, and four derelicts with their own hazards (KS-9's cargo fire, Tithe Hulk 7's dead power, the Mercy of Iron's extra husks, Pyre Station's inferno).
- **Extraction economy.** Scav kit (free: clothes, a pistol, 12 rounds, a bandage) or a custom kit from your stash: two guns, melee, suit, pack, supplies and ammo, all lost if you die.
- **Squad tactics.** Shared vision, name tags, crew cards, pings, chat, downed-and-revive, handing items over, friendly fire.

## Controls

| | PC | Phone |
|---|---|---|
| Move | WASD / arrows, or click a tile to walk | D-pad, or tap a tile |
| Shoot | Click a husk, window or fuel drum | Tap once to target, tap again or **FIRE** |
| Use / interact | F | **USE** |
| Pick up | G | **GRAB** |
| Items | 1–9, or click the hotbar | Hotbar or **Kit** drawer |
| Inventory | I or Tab | **Inv** |
| Swap guns | R | **Swap** |
| Throw | Pick the throwable, then click a spot (Esc cancels) | Tap it, then tap a spot |
| Ping (squads) | Z, middle-click or Alt+click | Long-press |
| Chat (squads) | Enter | **Chat** |
| Give item (squads) | Right-click it on the hotbar | Kit → *Hand to…* |

## Project layout

```
src/
  head.html   markup + styles (HUD, panels, touch controls)
  items.js    item catalogue: rarities, weapons, armour, packs, ammo, recipes, dyes
  gen.js      procedural station generator (seeded, deterministic)
  sim.js      the rules: pure, deterministic, serialisable state (Sim.act / Sim.newGame)
  world.js    galaxy, traders, contracts, the crew ship (World.act)
  client.js   pixel-art renderer, lighting, effects, input
  base.js     ship base: terminals, loadout, stash, travel, raids, saves
  transport.js app connection to the squad relay (same interface as claude.ai rooms)
  net.js      squads: host-sequenced lockstep + replay, crew presence
  squadui.js  shared vision, tags, pings, chat, crew cards, revive/give
  boot.js     start-up
server/       squad relay for the app (Node + ws), render.yaml for one-click hosting
web/          app manifest, service worker, icons
tools/        build.mjs (no dependencies), make-icons.mjs (Playwright)
tests/        rules tests (plain Node)
```

### How multiplayer stays in sync

`Sim` is deterministic: every random roll comes from a seed stored in the state. In a squad the leader's page is the sequencer: crew send action requests, the leader applies them with `Sim.act` and broadcasts `{n, actor, action}`; every page replays the same numbered actions on the same seeded station. Messages stay tiny (well under the 4 KB room limit), a missed message triggers a replay of the action log, and a state hash every few actions catches divergence. Ship walking is cosmetic and travels as presence instead.

In the app the same messages travel through `server/index.mjs`, a relay that mirrors claude.ai rooms (lobby, named squad rooms, presence, 4 KB messages). It only forwards; the leader's game is the referee.

## Development

Requires Node 18+.

```sh
npm test          # rules tests
npm run test:relay  # relay tests (after: npm install --prefix server)
npm run relay     # run the squad relay locally on :8787
npm run build     # dist/app (web app) and dist/artifact.html (claude.ai build)
npm run serve     # build and serve dist/app locally
npm run icons     # regenerate app icons from the game sprite (needs Playwright)
```

## Deploying

### GitHub Pages (installable web app)

The workflow in `.github/workflows/pages.yml` runs the tests and deploys `dist/app` on every push to `main`.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The site appears at `https://<owner>.github.io/<repo>/`.

### Android and iOS apps (Capacitor)

The web app is wrapped as a native app with [Capacitor](https://capacitorjs.com/). On your own machine:

```sh
npm install
npx cap add android      # needs Android Studio
npx cap add ios          # needs a Mac with Xcode
npm run cap:android      # build, sync, open in Android Studio
npm run cap:ios          # build, sync, open in Xcode
```

Publishing needs a Google Play developer account (one-time fee) and/or an Apple Developer Program membership (yearly).

## Roadmap

- Account saves for the app (cloud stash shared across devices)
- Second enemy type that hunts by sound
- Two-person actions: forcing the vault together, carrying downed crew
- More contracts and derelict layouts
