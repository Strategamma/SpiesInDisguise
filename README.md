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

## Notes

- No account or database is required.
- Share links use `?room=ABC123`; reconnect identity stays private in local storage.
- This is an original game and does not include Agent Avenue branding or assets.
