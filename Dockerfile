FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY worker.js socket.js server.js ./
COPY proxyList.txt rawProxyList.txt kvProxyList.json ./

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

EXPOSE 8080

CMD ["node", "server.js"]
