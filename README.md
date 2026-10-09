# Spies in Disguise

A mobile-first two-player bluffing game. The static PWA can live on `decadenceinc.com`; the included WebSocket gateway can run on Render.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000` on two devices. For phones on the same Wi-Fi, use your computer's LAN address (for example `http://192.168.1.20:3000`).

## Deploy

### Single Render service

Create a Render Web Service from this repository. `render.yaml` supplies the commands. The gateway also serves the PWA.

### decadenceinc.com + Render gateway

1. Upload the contents of `public/` to the desired path on decadenceinc.com.
2. Deploy this repository on Render.
3. Set the gateway URL in `public/config.js`:

```html
window.SPIES_IN_DISGUISE_GATEWAY = "wss://YOUR-SERVICE.onrender.com";
```

Render's free service may sleep when idle, so the first connection can take a little longer. Room data is intentionally temporary and disappears when the service restarts.

## Monitoring

`GET /health` returns deployment version, process uptime/startup time, active room and WebSocket counts, and aggregate counters for connections, socket errors, message errors, room creation failures, and expirations. Logs are structured JSON and intentionally exclude room codes, names, reconnect tokens, and card data.

The `Monitor production gateway` GitHub Actions workflow runs hourly and can also be started manually. It records HTTP wake latency, opens a real WebSocket, creates a protocol-2 lobby, validates that hands remain undealt, and removes the monitor room. The job fails on health/protocol errors or when health latency exceeds 30 seconds.

Run the same check locally or against another deployment:

```bash
MONITOR_URL=http://localhost:3000 MAX_COLD_START_MS=1000 npm run monitor
```

Configure GitHub Actions failure notifications in the repository/account settings so a failed scheduled run reaches the maintainers.

## Notes

- No account or database is required.
- Online rooms use a ready lobby; both players must be connected and ready before the host starts.
- Share links use `?room=ABC123`; reconnect identity stays private in local storage.
- This is an original game and does not include Agent Avenue branding or assets.
