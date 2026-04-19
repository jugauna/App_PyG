# Contexto de build: raíz del repositorio (source_dir: . en app.yaml).
# Incluye data/parquet para la imagen; alternativa en runtime: WELLS_PARQUET absoluto.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend/main.py /app/backend/main.py
COPY data/parquet/wells_master.parquet /app/data/parquet/wells_master.parquet

WORKDIR /app/backend
EXPOSE 8000

ENV WELLS_PARQUET=/app/data/parquet/wells_master.parquet

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
