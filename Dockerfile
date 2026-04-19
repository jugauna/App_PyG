# App PyG — monolito (Vite + FastAPI) para DigitalOcean App Platform.
# Contexto de build: raíz del repositorio.

FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

ENV VITE_API_BASE=/api
RUN npm run build

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app/backend

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r ./requirements.txt

COPY backend/ ./
COPY data/ /app/data/
COPY --from=frontend-build /app/frontend/dist ./static

ENV WELLS_PARQUET=/app/data/parquet/wells_master.parquet

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
