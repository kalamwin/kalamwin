FROM node:22-alpine

WORKDIR /app
COPY . .

# Content, uploads and credentials all live here — mount it to keep them.
VOLUME ["/app/data"]
ENV PORT=3000 NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "server.js"]
