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
| Datos | **Parquet** (por año) | `data/parquet/wells_2025.parquet`, `wells_2026.parquet`; **`WELLS_PARQUET`**: directorio con esos archivos, o un `.parquet` único (legacy) |
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

| Ubicación | Contenido |
|-----------|-----------|
| `Documentos/2025/` | CSV de producción del año (trimestres u otros), `capitulo-iv-pozos.csv`, `listado-de-pozos-cargados-por-empresas-operadoras.csv` |
| `Documentos/2026/` | CSV principal de producción 2026, CSV **no convencionales** (filas filtradas por **`anio`** 2025 o 2026), mismos metadatos Cap. IV y listado |

La carpeta **`Documentos/`** no se versiona (privacidad / tamaño); el pipeline asume estos archivos presentes en disco local o entorno de build.

### 3.2 Reglas de transformación (resumen)

- Normalización de nombres de columnas (minúsculas, espacios → `_`).
- **Producción:** unión de todos los CSV de producción bajo `Documentos/2025/` y `Documentos/2026/`; cada fila se asigna al dataset **`wells_{anio}.parquet`** según su columna **`anio`** (incl. no convencional multipráctica).
- **Granularidad:** **una fila Parquet por `sigla` y `mes`** con los valores mensuales de `prod_pet`, `prod_gas`, `prod_agua`; si el mismo mes se repite en varios archivos, se **suma** producción para ese mes.
- **Clave de merge:** **`sigla`** (trim). Merge **outer** con Cap. IV y con listado (coordenadas **`coordenadax` / `coordenaday`** priorizadas sobre **GeoJSON Point** del Cap. IV).
- **Calidad:** `provincia`, `cuenca`, `empresa` → trim y mayúsculas; alias de provincia (p. ej. `NEUQUEN/NQN` → Neuquén, `S. CRUZ` → Santa Cruz, `CHUBUT/CHB` → Chubut).
- Salida: **`data/parquet/wells_2025.parquet`** y **`data/parquet/wells_2026.parquet`**.

### 3.3 Campos canónicos relevantes (no exhaustivo)

`sigla`, `anio`, **`mes`**, `idpozo`, `empresa`, `yacimiento`, `provincia`, `cuenca`, `latitud`, `longitud`, `prod_pet`, `prod_gas`, `prod_agua`, `tipo_de_recurso`, `profundidad_medida`, `fecha_inicio_perf`, `fecha_fin_perf`, `tipoestado`, `tipoextraccion`. **`GET /api/wells/{sigla}`** devuelve un **arreglo** de filas (una por mes con dato), no un único objeto.

### 3.4 Reglas de negocio en API / mapa

- **Dataset:** query **`anio`** en **2025** o **2026** (default **2026**). DuckDB lee **`wells_{anio}.parquet`**.
- **Mapa (`GET /api/wells`):** filas mensuales con **`sigla`**, **`latitud`** y **`longitud`** no nulos; la API **agrupa por pozo** y ordena por **suma anual** `SUM(prod_pet)+SUM(prod_gas)` para el top-N.
- **Detalle (`GET /api/wells/{sigla}`):** sin agregación: lista **mes a mes** ordenada por **`mes`**.
- **Límites:** `limit` entre **0** y **500_000** (`MAX_MAP_POINTS_LIMIT`); por defecto **5_000** (`DEFAULT_MAP_POINTS_LIMIT`).
- **Filtros:** query params repetibles `empresa`, `provincia`, `cuenca` (multiselect en front).
- **Sincronización multianual completa:** el mapa y la búsqueda abren la ficha con **`?anio=`** igual al contexto global. La ficha lee **`anio`** con **`useSearchParams`** (default **2026** si falta), ofrece **selector 2025/2026** en cabecera que actualiza la URL con **`setSearchParams`**, y el **`useEffect`** de carga depende de **`sigla`** y **`anio`** de la URL para refrescar gráficos y metadatos. No hay estado de año “huérfano” entre mapa y ficha.

### 3.5 Ficha y gráfico

- La ficha consume **`GET /api/wells/{sigla}?anio=…`**, que devuelve un **array de filas mensuales** (una por mes con registro en el Parquet), ordenadas por **`mes`**.
- El gráfico **Recharts** representa **solo los meses presentes** en esa respuesta (p. ej. si el año corta en marzo, el eje X termina en **Mar**); no se rellenan meses faltantes con ceros.
- El **CSV exportado** (`downloadWellCsv`, BOM UTF-8) incluye metadatos representativos, totales anuales acumulados (`prod_*_anual_acumulado`) y columnas dinámicas **`petroleo_mes_<Mes>`** / **`gas_mes_<Mes>`** según la serie real.

---

## 4. API REST (FastAPI)

Base local típica: **`http://127.0.0.1:8000`**. Documentación interactiva: **`/docs`**.

| Método y ruta | Función |
|---------------|---------|
| `GET /api/health` | Estado del servicio y rutas de los Parquet por año. |
| `GET /api/wells/filter-options` | Query **`anio`**. JSON: listas `empresas`, `provincias`, `cuencas` (distinct ordenados). |
| `GET /api/wells/count` | Query **`anio`** + filtros. Conteo de pozos con coordenadas. |
| `GET /api/wells` | Query **`anio`** + filtros + `limit`. Lista `{ sigla, latitud, longitud }[]`. |
| `GET /api/wells/search?q=` | Query **`anio`**. Hasta 10 `sigla` con **ILIKE**. |
| `GET /api/wells/{sigla}` | Query **`anio`**. **Array** de registros mensuales del pozo (orden por `mes`). |

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
| `/pozo/:sigla` | `WellDetailPage` | Ficha, gráfico, mini mapa, CSV; **`?anio=`** en URL + selector de año en cabecera (sincronizado con mapa al abrir desde `WellsMap` / `WellSearch`). |
| `*` | Redirección a `/` | SPA. |

- **`Layout`:** cabecera, toggle sidebar, `Link` a `/`.
- **`SidebarFilters`:** selector **Año de datos** (2025 / 2026), `WellSearch`, multiselects, slider “Máximo de pozos en el mapa”, limpiar filtros.
- **`WellsContext`:** **`anio`**, filtros, opciones, pozos en mapa, límites elegibles, errores; efecto único que refetch al cambiar **`anio`**, filtros o límite.
- **Mapa:** clic en marcador → **`window.open(..., '_blank', 'noopener,noreferrer')`** hacia **`/pozo/<sigla>?anio=<anio del contexto>`** (misma lógica en búsqueda rápida).

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
| **`Dockerfile`** (raíz) | Multi-stage: build **Node 20 Alpine** en `/app/frontend` con `ENV VITE_API_BASE=/api`; runtime **Python 3.11 slim**, `WORKDIR /app/backend`, copia `backend/`, `data/` → `/app/data/`, `dist` → `backend/static`, `uvicorn main:app --host 0.0.0.0 --port 8000`. **`WELLS_PARQUET=/app/data/parquet`** (directorio). |
| **`app.yaml`** | Servicio **`web-app`**, `source_dir: .`, `dockerfile_path: Dockerfile`, ruta `/`, dominio de ejemplo documentado en manifiesto, **`WELLS_PARQUET=data/parquet`**, `CORS_ALLOW_ORIGINS` en runtime. |
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
- **Series temporales:** el modelo de datos es **mensual por pozo** en Parquet (`mes`, `prod_pet`, `prod_gas`, `prod_agua`); el mapa y el ranking usan **sumas anuales** por pozo; la ficha y el gráfico usan la **serie mensual real** devuelta por la API.
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
