# ---- Stage 1: build the Vite app ----
FROM node:20-alpine AS build

WORKDIR /app

# VITE_API_URL is a build arg so Vite can inline it at build time.
# Empty (default) => same-origin relative paths through the nginx gateway.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

# Install deps first for better layer caching.
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Stage 2: serve static files with nginx ----
FROM nginx:1.27-alpine AS runtime

# SPA fallback config.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Built assets.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
