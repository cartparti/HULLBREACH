# Hullbreach squad relay

A small WebSocket server that lets players of the Hullbreach app form squads. It relays room presence and messages; it never runs game rules. The squad leader's game sequences every raid action (lockstep), exactly as the claude.ai version does.

## Run locally

```sh
cd server
npm install
PORT=8787 node index.mjs
```

Open the app with `?server=ws://localhost:8787` (or enter the address in the **Crew** panel). Every player in a squad must use the same server.

## Host it for free (Render)

1. Sign in at render.com with GitHub.
2. **New → Blueprint**, pick this repository. Render reads `render.yaml` and creates the `hullbreach-relay` web service.
3. When it's live, copy its address and change `https://` to `wss://`, for example `wss://hullbreach-relay.onrender.com`.
4. Make it the app's default: in the GitHub repo go to **Settings → Secrets and variables → Actions → Variables**, add `HB_SERVER` with that `wss://` address, then re-run the *Test and deploy* workflow. Players can still change the server in the Crew panel.

The free plan sleeps after a while without players; the first connection wakes it in under a minute.

Any host that runs Node 18+ and allows WebSockets works (Fly.io, Railway, a VPS). Serve it over TLS (`wss://`): the app on GitHub Pages is HTTPS and browsers block plain `ws://` from HTTPS pages.

## Limits

Mirrors claude.ai rooms: 4 KB per message and per presence object, 40 messages a second per connection (burst 80), 16 rooms per connection. Idle connections are dropped after a missed heartbeat.
