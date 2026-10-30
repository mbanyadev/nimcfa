# Generic container (e.g. Hugging Face Spaces, Docker SDK). Node + file store; the disk may be wiped on restart.
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY tsconfig.json ./
ENV PORT=7860 STORE=file DATA_FILE=/tmp/nimcfa/orders.json NODE_ENV=production
EXPOSE 7860
CMD ["npx", "tsx", "src/index.ts"]
