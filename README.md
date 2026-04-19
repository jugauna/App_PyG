# PyG — Inteligencia Petrolera

**Plataforma de Inteligencia Petrolera fullstack (FastAPI + React + DuckDB)** para exploración de pozos (socio no operador, Argentina). El backend expone una API REST que lee un dataset maestro en **Parquet** vía **DuckDB**; el frontend (**React + Vite**) ofrece mapa, filtros y detalle.

## Inicio rápido (Windows)

1. Crear venv e instalar dependencias del backend: ver `MANUAL_EJECUCION.md`.
2. Generar `data/parquet/wells_master.parquet` con `backend/scripts/convert_to_parquet.py`.
3. Desde la raíz del repo: **`run_app.bat`** (único lanzador oficial).

- **Web:** http://localhost:5173  
- **API docs:** http://127.0.0.1:8000/docs  

## Estructura principal

| Ruta | Rol |
|------|-----|
| `backend/` | FastAPI, DuckDB, scripts de datos |
| `frontend/` | React (UI) |
| `Documentos/` | Fuentes Excel/CSV para el importador |
| `data/parquet/` | `wells_master.parquet` (generado) |

Documentación detallada: **`MANUAL_EJECUCION.md`**.
