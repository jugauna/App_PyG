# Características técnicas y funcionales — App PyG

Documento de **especificación técnica y funcional** de **PyG — Inteligencia Petrolera**, alineado con el código del repositorio. Complementa `PROJECT_MANIFEST.md`, `docs/ESPECIFICACION_FUNCIONAL.md`, `drilling_schema.md` y `manual_de_usuario.md`.

---

## 1. Propósito y alcance funcional

| Aspecto | Descripción |
|---------|-------------|
| **Dominio** | Exploración de **pozos** oil & gas (contexto **socio no operador**, Argentina). |
| **Objetivo** | Mapa interactivo con **filtros multiselección**, **límite de densidad** de puntos, **búsqueda por sigla**, **ficha de detalle** por pozo y **exportación CSV**. |
| **Fuente de verdad en runtime** | Archivo **Apache Parquet** maestro consultado vía **DuckDB** en el backend. No se leen Excel/CSV en cada petición de producción típica. |
| **Privacidad** | Procesamiento y datos orientados a **entorno local** o **nube privada**; sin obligación de exponer datos a terceros. |

---

## 2. Stack tecnológico

| Capa | Tecnología | Ubicación / notas |
|------|------------|-------------------|
| API | **FastAPI**, **Uvicorn** | `backend/main.py` |
| Consultas | **DuckDB** (`:memory:`, vista `wells` sobre `read_parquet`) | Conexión compartida + `threading.Lock` en lecturas |
| Datos | **Parquet** | `data/parquet/wells_master.parquet`; variable **`WELLS_PARQUET`** (absoluta o relativa a `PROJECT_ROOT` = padre de `backend/`) |
| ETL | **pandas**, **pyarrow**, **openpyxl** | `backend/scripts/convert_to_parquet.py` |
| Frontend | **React 19**, **Vite 8**, **TypeScript**, **react-router-dom** | `frontend/` |
| Estilos | **Tailwind CSS 4** | `@tailwindcss/vite` |
| Mapa | **Leaflet 1.9**, **react-leaflet 5**, **react-leaflet-cluster** | `WellsMap.tsx`, `basemapConfig.ts` |
| Gráficos | **Recharts** | Ficha de pozo |
| HTTP cliente | **Axios** | Build Docker: `VITE_API_BASE=/api` y rutas relativas `wells/...`; desarrollo: `http://localhost:8000` y rutas `/api/...` |
| Arranque local Windows | **`run_app.bat`** | Puerto **8000** (API), **5173** (Vite); `backend/start_api.bat`, `scripts/wait_api.ps1` |

---

## 3. Datos: ingestión, modelo y reglas

### 3.1 Fuentes esperadas (ETL)

El script toma la **primera fuente disponible** de cada par:

| Rol | Archivos (orden de preferencia) |
|-----|----------------------------------|
| Capítulo IV (metadata + geo) | `Documentos/capitulo4-pozos.xlsx` o `Documentos/capitulo-iv-pozos.csv` |
| Producción | `Documentos/Produccion-pozos-2026.xlsx` o `Documentos/produccion-de-pozos-de-gas-y-pet.csv` |

### 3.2 Reglas de transformación (resumen)

- Normalización de nombres de columnas (minúsculas, espacios → `_`).
- **Clave de merge:** **`sigla`** (trim).
- **GeoJSON:** columna `geojson` como string JSON tipo **Point** → **`coordinates` [lon, lat]** → columnas **`latitud`**, **`longitud`**.
- Renombres frecuentes: p. ej. `profundidad` → `profundidad_medida`, `operador` → `empresa`, `area` → `yacimiento`.
- Merge **outer** entre capítulo IV y producción por `sigla`.
- Salida: **`data/parquet/wells_master.parquet`** (reemplazo completo al regenerar).

### 3.3 Campos canónicos relevantes (no exhaustivo)

`sigla`, `idpozo`, `empresa`, `yacimiento`, `provincia`, `cuenca`, `latitud`, `longitud`, `prod_pet`, `prod_gas`, `prod_agua`, `tipo_de_recurso`, `profundidad_medida`, `fecha_inicio_perf`, `fecha_fin_perf`, `tipoestado`, `tipoextraccion`. Columnas adicionales del Parquet se exponen en **`GET /api/wells/{sigla}`** tal cual (valores normalizados a JSON seguro).

### 3.4 Reglas de negocio en API / mapa

- **Mapa (`GET /api/wells`):** solo pozos con **`sigla`**, **`latitud`** y **`longitud`** no nulos en la consulta filtrada.
- **Orden:** `ORDER BY (COALESCE(prod_pet,0) + COALESCE(prod_gas,0)) DESC` — índice de prioridad para **top-N** (unidades mixtas; uso operacional, no equivalencia física petróleo/gas).
- **Límites:** `limit` entre **0** y **500_000** (`MAX_MAP_POINTS_LIMIT`); por defecto **5_000** (`DEFAULT_MAP_POINTS_LIMIT`).
- **Filtros:** query params repetibles `empresa`, `provincia`, `cuenca` (multiselect en front).

### 3.5 Ficha y gráfico

- La ficha consume **`GET /api/wells/{sigla}`** (objeto completo).
- El gráfico mensual en UI usa una **serie sintética 12 meses** con declinación mensual configurable (**`CHART_SYNTHETIC_DECLINE_FRAC`** en `wellDetailUtils.ts`, p. ej. 5 %); coherente con columnas `petroleo_mes_*` / `gas_mes_*` del **CSV exportado** (`downloadWellCsv`, BOM UTF-8).

---

## 4. API REST (FastAPI)

Base local típica: **`http://127.0.0.1:8000`**. Documentación interactiva: **`/docs`**.

| Método y ruta | Función |
|---------------|---------|
| `GET /api/health` | Estado del servicio y ruta efectiva del Parquet. |
| `GET /api/wells/filter-options` | JSON: listas `empresas`, `provincias`, `cuencas` (distinct ordenados). |
| `GET /api/wells/count` | Conteo de pozos con coordenadas bajo filtros. |
| `GET /api/wells` | Lista `{ sigla, latitud, longitud }[]` con filtros + `limit`. |
| `GET /api/wells/search?q=` | Hasta 10 `sigla` con **ILIKE**. |
| `GET /api/wells/{sigla}` | Registro completo del pozo. |

**Errores:** sin archivo Parquet válido → **503** con mensaje orientativo. Pozo inexistente → **404**.

### 4.1 CORS y cabeceras

- **`CORS_ALLOW_ORIGINS`:** lista separada por comas (p. ej. dominio público en producción).
- **`allow_origin_regex`** para `http(s)://localhost` y `127.0.0.1` con cualquier puerto (desarrollo).
- Middleware **PNA** (`Access-Control-Allow-Private-Network`) para preflight en Chrome.
- **GZip** para respuestas grandes (umbral configurable en código).

---

## 5. Frontend: rutas y componentes clave

| Ruta | Componente | Función |
|------|------------|---------|
| `/` | `MapPage` | Mapa + cabecera con coordenadas del puntero y textos de estado. |
| `/pozo/:sigla` | `WellDetailPage` | Ficha, gráfico, mini mapa, CSV. |
| `*` | Redirección a `/` | SPA. |

- **`Layout`:** cabecera, toggle sidebar, `Link` a `/`.
- **`SidebarFilters`:** `WellSearch`, multiselects, slider “Máximo de pozos en el mapa”, limpiar filtros.
- **`WellsContext`:** estado de filtros, opciones, pozos en mapa, límites elegibles, errores.
- **Mapa:** clic en marcador → **`window.open(..., '_blank', 'noopener,noreferrer')`** hacia `/pozo/<sigla>` (misma lógica en búsqueda).

---

## 6. Servicio de archivos estáticos y SPA (monolito)

En **`backend/main.py`**, tras todas las rutas `/api` y la documentación OpenAPI:

- **`GET /`** → `FileResponse` de `static/index.html`.
- **`GET /{rest_of_path:path}`** → si existe archivo bajo `backend/static/` (p. ej. assets de Vite), se sirve ese archivo; si no, **`index.html`** (fallback para React Router). Comprobación de ruta bajo **`STATIC_ROOT`** para evitar **path traversal**.

En **desarrollo** con solo Vite, la carpeta `backend/static` puede contener solo `.gitkeep`; conviene construir el front o usar el puerto 5173 para la UI completa.

---

## 7. Despliegue (Docker / DigitalOcean)

| Artefacto | Descripción |
|-----------|-------------|
| **`Dockerfile`** (raíz) | Multi-stage: build **Node 20 Alpine** en `/app/frontend` con `ENV VITE_API_BASE=/api`; runtime **Python 3.11 slim**, `WORKDIR /app/backend`, copia `backend/`, `data/` → `/app/data/`, `dist` → `backend/static`, `uvicorn main:app --host 0.0.0.0 --port 8000`. |
| **`app.yaml`** | Servicio **`web-app`**, `source_dir: .`, `dockerfile_path: Dockerfile`, ruta `/`, dominio de ejemplo documentado en manifiesto, `WELLS_PARQUET` y `CORS_ALLOW_ORIGINS` en runtime. |
| **`.dockerignore`** | Incluye `.git`, `node_modules`, `.venv`, `__pycache__`, artefactos `.pyc`, `Documentos/`; no excluye Parquet bajo `data/parquet/`. |

---

## 8. Requisitos no funcionales

| Tema | Enfoque actual |
|------|----------------|
| Rendimiento mapa | Límite de puntos + clusters; techo alto de API para casos puntuales con hardware adecuado. |
| Concurrencia lectura DuckDB | Un solo proceso de conexión compartida + **lock** en lecturas. |
| Localización UI | Números y formatos vía **`es-AR`** donde aplica. |
| Accesibilidad | Roles ARIA en listas de filtros; `aria-live` en coordenadas del mapa. |

---

## 9. Limitaciones conocidas

- El **ranking petróleo + gas** mezcla unidades según dataset; sirve para priorización visual, no como medida física única.
- Series del gráfico / CSV pueden ser **sintéticas** si el maestro no trae serie mensual real aún modelada en front.
- Volúmenes muy grandes de puntos sin filtro pueden degradar la experiencia; usar filtros y el slider.

---

## 10. Evolución prevista

- Fase futura: **asistente RAG** sobre documentación y datos autorizados.
- Mejoras posibles: tests ETL/API, CI, ingest incremental, series reales, export GeoJSON.

---

## 11. Referencias en el repositorio

| Documento | Uso |
|-----------|-----|
| `PROJECT_MANIFEST.md` | Arquitectura congelada, endpoints, Docker, UI. |
| `docs/ESPECIFICACION_FUNCIONAL.md` | Especificación funcional alineada al stack. |
| `drilling_schema.md` | Definiciones de dominio y columnas. |
| `manual_de_usuario.md` | Guía de uso para personas usuarias. |
| `MANUAL_EJECUCION.md` | Instalación, venv, Parquet, `run_app.bat`. |
