# ---- Stage 1: Build third-party and frontend ----
FROM node:20-slim AS builder

WORKDIR /app

# Copy root package.json (needed for metadata generation via tsx)
COPY package.json .
RUN npm install

# Copy metadata generation script
COPY scripts/ scripts/

# Copy and build avr8js
COPY third-party/avr8js/ third-party/avr8js/
WORKDIR /app/third-party/avr8js
RUN npm install && npm run build

# Copy and build wokwi-elements
COPY third-party/wokwi-elements/ third-party/wokwi-elements/
WORKDIR /app/third-party/wokwi-elements
RUN npm install && npm run build

# Copy frontend source and install dependencies
WORKDIR /app
COPY frontend/ frontend/
WORKDIR /app/frontend
RUN npm install

# Generate component metadata and build frontend for production
RUN npm run build

# ---- Stage 2: Serve with nginx ----
FROM nginx:alpine

# Copy custom nginx config
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built frontend assets
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
