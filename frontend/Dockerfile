# Contexto de build: raíz del repositorio (source_dir: . en app.yaml).
# VITE_API_BASE se inyecta en build (DigitalOcean env BUILD_TIME → --build-arg).

FROM node:20-alpine AS build
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

ARG VITE_API_BASE=
ENV VITE_API_BASE=$VITE_API_BASE

RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
