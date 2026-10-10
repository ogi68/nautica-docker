# Nautica - Docker / VPS

Versi ini mempertahankan endpoint dan logika utama Nautica, dengan adapter:
- `cloudflare:sockets` -> Node.js `net`
- `WebSocketPair` -> `ws`
- Cloudflare Worker entrypoint -> HTTP + WebSocket server Node.js

## Port

Default: **8080**

Server juga menghormati environment `PORT`.

Contoh:
```bash
docker build -t nautica .
docker run -d --name nautica -p 8080:8080 nautica
```

Jika provider memberi port tertentu:
```bash
docker run -d --name nautica -p 3000:3000 -e PORT=3000 nautica
```

## Environment

- `PORT` — default `8080`
- `HOST` — default `0.0.0.0`
- `PRX_BANK_URL` — opsional, default mengikuti nilai bawaan kode
- `REVERSE_PRX_TARGET` — default `example.com`

## Docker Compose

```yaml
services:
  nautica:
    build: .
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      PORT: "8080"
      HOST: "0.0.0.0"
```

Catatan: jika deployment berada di platform yang menyediakan reverse proxy/HTTPS, expose port internal yang ditentukan platform dan set `PORT` ke nilai tersebut.
