# FeelAtHomeNow frontend — build with Node 20, serve with nginx
FROM node:20-alpine AS builder

WORKDIR /app

# API URL at build time (for CRA env injection)
ARG REACT_APP_BACKEND_URL=http://localhost:8000
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

# Install dependencies (layer caching)
COPY package.json package-lock.json* yarn.lock* ./
RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; else npm ci; fi

# Build production bundle
COPY . .
RUN npm run build

# Production: nginx to serve static build
FROM nginx:alpine

# Default CRA/craco output is build/
COPY --from=builder /app/build /usr/share/nginx/html

# SPA fallback: serve index.html for client-side routes
RUN echo 'server { \
  listen 80; \
  root /usr/share/nginx/html; \
  index index.html; \
  location / { try_files $uri $uri/ /index.html; } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
