# LubeLog PWA

A lightweight Progressive Web App for quick fuel and service logging against a self-hosted [LubeLogger](https://lubelogger.com) instance.

## Features

- Log fuel fill-ups and service records from your phone
- Set a default vehicle for one-tap logging
- View recent fuel and service history
- Installable to home screen (Add to Home Screen on iOS/Android)
- Dark theme, mobile-first design
- No backend — pure static files, talks directly to your LubeLogger API

## Setup

1. In your LubeLogger instance, go to **Settings > API Keys** and generate an Editor-scoped key
2. Open this app and enter your LubeLogger URL + API key
3. Pick a default vehicle
4. Start logging

## Hosting

### GitHub Pages (recommended)

1. Push this repo to GitHub
2. Go to **Settings > Pages** and set source to `main` branch, root `/`
3. Access via `https://yourusername.github.io/lubelogger-pwa/`

### Self-hosted (behind reverse proxy)

Copy the files to your server and add to your nginx/Caddy config:

```nginx
location /app/ {
    alias /path/to/lubelogger-pwa/;
    try_files $uri $uri/ /app/index.html;
}
```

## Authentication

This app uses LubeLogger API keys (`x-api-key` header). No credentials are stored in the app files — the API key is saved only in your browser's localStorage after you enter it during setup.
