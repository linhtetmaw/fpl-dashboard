# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY server/ ./server/
COPY client/ ./client/

RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY server/package.json ./server/
RUN cd server && npm install --omit=dev

COPY server/ ./server/
COPY --from=builder /app/client/dist ./client/dist

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["node", "server/index.js"]
