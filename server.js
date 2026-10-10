import http from "node:http";
import { WebSocketServer } from "ws";
import worker, { websocketHandler } from "./worker.js";

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";

const env = {
  PRX_BANK_URL: process.env.PRX_BANK_URL || "",
  REVERSE_PRX_TARGET: process.env.REVERSE_PRX_TARGET || "example.com",
};

const server = http.createServer(async (req, res) => {
  try {
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host || `localhost:${PORT}`;
    const url = new URL(req.url || "/", `${protocol}://${host}`);

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) headers.set(key, value.join(", "));
      else if (value !== undefined) headers.set(key, value);
    }

    const request = new Request(url, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method || "GET") ? undefined : req,
      duplex: "half",
    });

    const response = await worker.fetch(request, env, {});
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (!response.body) {
      res.end();
      return;
    }

    const reader = response.body.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    } finally {
      res.end();
    }
  } catch (err) {
    console.error("HTTP error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
    }
    res.end(`An error occurred: ${err?.stack || err}`);
  }
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", async (req, socket, head) => {
  try {
    const host = req.headers.host || `localhost:${PORT}`;
    const url = new URL(req.url || "/", `http://${host}`);

    // Only upgrade paths supported by Nautica's proxy protocol.
    const isProxyPath =
      url.pathname.length === 3 ||
      url.pathname.includes(",") ||
      /^\/(.+[:=-]\d+)$/.test(url.pathname);

    if (!isProxyPath) {
      socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, async (ws) => {
      try {
        const protocol = req.headers["x-forwarded-proto"] || "http";
        const request = new Request(url, {
          method: "GET",
          headers: Object.entries(req.headers).reduce((h, [k, v]) => {
            if (Array.isArray(v)) h.set(k, v.join(", "));
            else if (v !== undefined) h.set(k, v);
            return h;
          }, new Headers()),
        });

        await websocketHandler(request, ws);
      } catch (err) {
        console.error("WebSocket error:", err);
        try { ws.close(1011, "Internal server error"); } catch {}
      }
    });
  } catch (err) {
    console.error("Upgrade error:", err);
    socket.destroy();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Nautica Docker server listening on ${HOST}:${PORT}`);
});
