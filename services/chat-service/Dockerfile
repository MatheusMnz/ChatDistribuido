# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 5000

# A conexão com Mongo e Redis possui retry interno (db/mongo.ts e index.ts),
# então o serviço tolera Mongo/Redis subindo logo após o container.
CMD ["node", "dist/index.js"]
