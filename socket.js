import net from "node:net";

export function connect({ hostname, port }) {
  const socket = net.createConnection({ host: hostname, port: Number(port) });
  let settled = false;
  let resolveClosed;
  let rejectClosed;
  const closed = new Promise((resolve, reject) => {
    resolveClosed = resolve;
    rejectClosed = reject;
  });

  const readable = new ReadableStream({
    start(controller) {
      socket.on("data", (chunk) => {
        controller.enqueue(new Uint8Array(chunk));
      });
      socket.once("end", () => controller.close());
      socket.once("close", () => {
        if (!settled) {
          settled = true;
          resolveClosed();
        }
        try { controller.close(); } catch {}
      });
      socket.once("error", (err) => {
        if (!settled) {
          settled = true;
          rejectClosed(err);
        }
        try { controller.error(err); } catch {}
      });
    },
    cancel() {
      socket.destroy();
    },
  });

  const writable = new WritableStream({
    start() {
      socket.once("connect", () => {});
    },
    write(chunk) {
      return new Promise((resolve, reject) => {
        const buffer = Buffer.from(
          chunk instanceof ArrayBuffer
            ? new Uint8Array(chunk)
            : ArrayBuffer.isView(chunk)
              ? new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)
              : chunk
        );
        if (!socket.write(buffer, (err) => err ? reject(err) : resolve())) {
          socket.once("drain", resolve);
        }
      });
    },
    close() {
      socket.end();
    },
    abort() {
      socket.destroy();
    },
  });

  return { readable, writable, closed };
}
