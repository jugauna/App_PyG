# Manifiesto técnico — App PyG (Inteligencia Petrolera)

Documento de referencia para **congelar la arquitectura vigente** y alinear desarrollo, revisiones y asistentes de código. Fecha de alineación: código del repositorio en su rama actual.

---

## 1. Stack tecnológico

| Capa | Tecnología | Notas |
|------|------------|--------|
| Backend | **FastAPI** (Python 3.11+) | API REST, CORS hacia Vite, GZip, cabecera PNA para Chrome. |
| Runtime API | **Uvicorn** | Local: `backend/start_api.bat` (invocado por `run_app.bat`). Contenedor: ver §6.1. |
| Datos analíticos | **DuckDB** (in-memory) | Conexión compartida + `threading.Lock` en lecturas. |
| Maestro | **Apache Parquet** | Archivo `data/parquet/wells_master.parquet` (ruta alternativa: env `WELLS_PARQUET`). |
| Frontend | **React 19**, **Vite 8**, **TypeScript** | SPA, enrutado `react-router-dom`. |
| Estilos | **Tailwind CSS 4** | Vía `@tailwindcss/vite`, `index.css` con `@import 'tailwindcss'`. |
| Mapa | **Leaflet 1.9**, **react-leaflet 5**, **react-leaflet-cluster** | Marcadores agrupados, controles de capa y escala. |
| Gráficos | **Recharts** | Dashboard de ficha de pozo (doble eje petróleo / gas). |
| HTTP cliente | **Axios** | Build Docker: `VITE_API_BASE=/api` y rutas `wells/...`. Dev: sin env → `http://localhost:8000` y rutas `/api/...`. |

**No forman parte del producto:** Streamlit, SQLite legacy, carpeta `app/` eliminada.

---

## 2. Arquitectura de datos

### 2.1 Origen y ETL

- Fuentes esperadas en `Documentos/`: principalmente `capitulo4-pozos.xlsx` y `Produccion-pozos-2026.xlsx` (alternativas CSV documentadas en `MANUAL_EJECUCION.md` y `drilling_schema.md`).
- Script: `backend/scripts/convert_to_parquet.py` — normaliza columnas, merge **outer por `sigla`**, GeoJSON Point → `latitud` / `longitud`, orden canónico de columnas.
- Salida: `data/parquet/wells_master.parquet`.

### 2.2 Esquema lógico del Parquet (`wells_master.parquet`)

Orden canónico definido en el script (alineado a `drilling_schema.md`):

| Columna | Rol |
|---------|-----|
| `sigla` | Clave de negocio / URL |
| `idpozo` | Identificador numérico |
| `empresa` | Operadora |
| `yacimiento` | Campo / bloque |
| `provincia`, `cuenca` | Geografía administraria / sedimentaria |
| `latitud`, `longitud` | Coordenadas WGS84 |
| `prod_pet`, `prod_gas`, `prod_agua` | Producción reportada |
| `tipo_de_recurso` | Clasificación recurso |
| `profundidad_medida` | MD |
| `fecha_inicio_perf`, `fecha_fin_perf` | Fechas perforación |
| `tipoestado`, `tipoextraccion` | Estado y método |

Columnas adicionales presentes en el Parquet se exponen tal cual en `GET /api/wells/{sigla}`.

### 2.3 Vista DuckDB

En `backend/main.py`, al obtener conexión:

```sql
CREATE OR REPLACE VIEW wells AS
SELECT * FROM read_parquet('<ruta_absoluta_normalizada_posix>')
```

- Una sola vista apunta al fichero actual; si cambia `WELLS_PARQUET` o el path resuelto, se recrea la conexión.
- Consultas de mapa filtran pozos con `sigla`, `latitud` y `longitud` no nulos.

### 2.4 Regla de ranking en mapa (límite de puntos)

`GET /api/wells` ordena por **`COALESCE(prod_pet,0) + COALESCE(prod_gas,0) DESC`** y aplica `LIMIT`. Es un índice de prioridad (unidades mixtas m³ vs dam³); sirve para el **top-N** bajo filtros. El slider del front acota ese `limit` hasta el máximo permitido por la API y los elegibles con coordenadas.

---

## 3. Identidad UI/UX — “Industrial Dark”

- **Entorno:** fondos `slate-900` / `slate-950`, bordes discretos, sombras y anillos (`ring-slate-*`).
- **Acento petróleo:** `#3b82f6` (sky/blue corporativo en KPIs, enlaces, acentos).
- **Acento gas:** `#10b981` (emerald en íconos y serie de gas en Recharts).
- **Tipografía técnica:** `font-mono` en siglas, coordenadas, tablas y CSV.
- **Mapa — soberanía y nomenclatura:** debe mantenerse **capa de etiquetas del IGN Argentina** (`mapabase_hibrido` TMS) sobre las bases raster elegidas, para toponimia oficial (p. ej. Islas Malvinas). Las bases de calle pueden ser Esri World Street y/o Carto Voyager sin etiquetas; satélite: Esri World Imagery + mismo overlay IGN. Ver `frontend/src/map/basemapConfig.ts` y `WellsMap.tsx`.
- **Cabecera mapa (`MapPage`):** título “Mapa de pozos” y **coordenadas bajo cursor** (Lat/Lon a 5 decimales) alineadas en `flex` `items-baseline`; al salir del mapa se conserva el último valor hasta desmontar la página.
- **Ficha pozo (`WellDetailPage`):** dashboard con KPIs, gráfico Recharts, metadatos tabulares, mini mapa, export CSV.

---

## 4. Funcionalidades implementadas (snapshot)

| Área | Descripción |
|------|-------------|
| Búsqueda global | `WellSearch` → `GET /api/wells/search?q=` — coincidencia **ILIKE** sobre `sigla`, hasta 10 resultados. |
| Filtros | Multiselect empresa / provincia / cuenca; opciones desde `GET /api/wells/filter-options`. |
| Densidad en mapa | Slider “Máximo de pozos en el mapa”: rango **0 – elegibles** (con coordenadas bajo filtro); copy indica **top por petróleo + gas**. Techo de API: **500_000** (`MAX_MAP_POINTS_LIMIT`); valor por defecto de API **5_000**. |
| Mapa | Clusters, tooltips, clic abre ficha en **nueva pestaña** (`window.open` a `/pozo/:sigla`). |
| Brújula | `MapCrosshairCardinal` activa con zoom ≥ 10, sigue al cursor (rAF + DOM). |
| Coordenadas | `MapPointerReporter` alimenta estado en `MapPage` (no en el overlay del mapa). |
| Ficha / Dashboard | `GET /api/wells/{sigla}`; gráfico **Recharts** con serie **sintética 12 meses**, declinación mensual **5%** (`CHART_SYNTHETIC_DECLINE_FRAC` en `wellDetailUtils.ts`), coherente con el CSV exportado. |
| Export CSV | `downloadWellCsv`: **BOM UTF-8** (`\uFEFF`), filas con metadatos + columnas `petroleo_mes_*` y `gas_mes_*` sintéticas. |
| Salud | `GET /api/health` — estado y ruta del Parquet. |

---

## 5. Endpoints clave (FastAPI)

Base típica: `http://localhost:8000`. Documentación interactiva: `/docs`.

| Método y ruta | Propósito |
|---------------|-----------|
| `GET /api/health` | Estado del servicio y presencia del Parquet. |
| `GET /api/wells/filter-options` | Listas `empresas`, `provincias`, `cuencas` (distinct ordenados). |
| `GET /api/wells/count` | Query: `empresa`, `provincia`, `cuenca` (repetibles). Cuenta pozos con coordenadas que cumplen filtros. |
| `GET /api/wells` | Mismos filtros + `limit` (0…500_000). Devuelve `{ sigla, latitud, longitud }[]` ordenados por **prod_pet + prod_gas** descendente. |
| `GET /api/wells/search` | Query `q`: hasta 10 `sigla` con ILIKE. |
| `GET /api/wells/{sigla}` | Objeto completo del pozo (todas las columnas del Parquet normalizadas a JSON). |

---

## 6. Orquestación y arranque

- **Punto de entrada único para el usuario en Windows:** `run_app.bat` (raíz del repo).
- Libera puertos **8000** y **5173**, instala `frontend/node_modules` si falta, lanza **backend** en ventana nueva vía `backend\start_api.bat`, espera API (`scripts/wait_api.ps1`), lanza **Vite** en **5173**, abre el navegador.
- `backend/start_api.bat` **no** sustituye a `run_app.bat`; es **subordinado** para levantar Uvicorn con el Python del venv del backend.

### 6.1 Docker y DigitalOcean App Platform (monolito)

La aplicación se despliega como **un solo contenedor**: FastAPI en el puerto **8000** sirve la API bajo **`/api`** y la SPA de React bajo **`/`**. El ruteo del **cliente** (`/pozo/:sigla`, etc.) se respeta en refrescos y pestañas nuevas mediante rutas **`GET /`** y **`GET /{rest_of_path:path}`** al final de `main.py`: si existe un archivo bajo `backend/static/` (p. ej. assets de Vite), se responde con **`FileResponse`**; si no, **`index.html`** (fallback SPA), con comprobación de ruta para evitar path traversal.

- **`Dockerfile`** (raíz): **Stage 1** — `node:20-alpine`, `WORKDIR /app/frontend`, `npm ci`, build con **`ENV VITE_API_BASE=/api`** (`npm run build`). **Stage 2** — `python:3.11-slim`, `WORKDIR /app/backend`, instala `backend/requirements.txt`, copia **`backend/`** a `/app/backend/`, copia **`data/`** a **`/app/data/`**, copia el **`dist`** del front a **`/app/backend/static`**, `EXPOSE 8000`, comando **`uvicorn main:app --host 0.0.0.0 --port 8000`**. Imagen por defecto: `WELLS_PARQUET=/app/data/parquet/wells_master.parquet`.
- **`app.yaml`**: servicio único **`web-app`**, `source_dir: .`, `dockerfile_path: Dockerfile`, ruta `/`, dominio **upstream.remasa.com** (PRIMARY). En runtime, **`WELLS_PARQUET`** puede ser relativa al raíz del proyecto en contenedor (p. ej. `data/parquet/wells_master.parquet` → resuelve contra **`PROJECT_ROOT`** = `/app` en la imagen). **`CORS_ALLOW_ORIGINS`** en runtime para el dominio público.
- **`frontend/nginx.conf`**: solo referencia para despliegues con Nginx aparte; el monolito no lo usa.
- **`.dockerignore`** (raíz): excluye **`.git`**, **`node_modules`**, **`.venv`**, **`__pycache__`**, `*.pyc` / `*.pyo`, **`Documentos/`**; **no** excluye `data/parquet/*.parquet`.
- **`.gitignore`**: ignora entornos y artefactos locales; **no** ignora Parquet en `data/parquet/` (comentario explícito en el archivo).

**Producción CORS:** variable de entorno **`CORS_ALLOW_ORIGINS`** (lista separada por comas) en el backend; se mantiene **`allow_origin_regex`** para `localhost` / `127.0.0.1` en cualquier puerto (desarrollo con Vite).

---

## 7. Legado eliminado (verificación)

- Carpeta **`app/`** (Streamlit): **no debe existir** en el árbol del proyecto.
- **`ejecutar_app.bat`** (launcher Streamlit en raíz): **no debe existir**.
- Dependencias Python del front legacy en raíz (`requirements.txt` streamlit): **no deben existir**; el backend usa solo `backend/requirements.txt`.

---

## 8. Documentos relacionados

- `MANUAL_EJECUCION.md` — pasos de entorno e import Parquet.
- `README.md` — resumen ejecutivo.
- `docs/ESPECIFICACION_FUNCIONAL.md` — especificación funcional alineada al stack actual.
- `drilling_schema.md` — definiciones de dominio.
- `.cursorrules` — reglas permanentes para asistentes en Cursor.
