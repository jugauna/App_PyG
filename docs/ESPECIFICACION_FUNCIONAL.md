# Especificación funcional — App PyG (Inteligencia Petrolera)

Documento de referencia alineado con el código del repositorio (arquitectura **FastAPI + React + DuckDB/Parquet**).

---

## 1. Propósito y contexto

- **Nombre / uso:** aplicación web **PyG — Inteligencia Petrolera** para un **socio no operador** en Argentina (oil & gas).
- **Objetivo funcional:** explorar **pozos** en un **mapa interactivo** (ubicación + filtros) y ver una **ficha de detalle** por pozo, con datos servidos por la **API** desde un archivo **Parquet** consultado con **DuckDB**.
- **Privacidad / despliegue:** pensada para **datos locales** (Parquet en disco); el procesamiento puede mantenerse 100 % local o en nube privada.

---

## 2. Stack técnico

| Capa | Tecnología |
|------|------------|
| API | **FastAPI** (`backend/main.py`), **Uvicorn** |
| Consulta analítica | **DuckDB** sobre `read_parquet` (vista sobre el maestro) |
| Datos tabulares | **Parquet** (`data/parquet/wells_master.parquet`; ruta configurable con `WELLS_PARQUET`) |
| ETL / import | **pandas**, **pyarrow**, **openpyxl** (`backend/scripts/convert_to_parquet.py`) |
| UI | **React** + **Vite** (`frontend/`) |
| Arranque Windows (oficial) | **`run_app.bat`** en la raíz → backend + frontend |

**Requisito previo:** existir el Parquet maestro; si no, la API responde error indicando ejecutar el script de conversión.

---

## 3. Estructura relevante del código

- `backend/main.py` — aplicación FastAPI, CORS, endpoints de pozos/mapa/agregados.
- `backend/scripts/convert_to_parquet.py` — lectura de `Documentos/`, merge, escritura Parquet.
- `frontend/` — SPA: mapa, filtros, consumo de la API.
- `Documentos/` — fuentes esperadas por el importador (ver §4).
- `backend/requirements.txt` — fastapi, uvicorn, duckdb, pandas, pyarrow, python-dotenv, openpyxl.

---

## 4. Datos: fuentes, ETL y modelo lógico

### 4.1 Fuentes (primera que exista en cada par)

**Capítulo IV (metadata + geo):**

- `Documentos/capitulo4-pozos.xlsx` **o**
- `Documentos/capitulo-iv-pozos.csv`

**Producción:**

- `Documentos/Produccion-pozos-2026.xlsx` **o**
- `Documentos/produccion-de-pozos-de-gas-y-pet.csv`

### 4.2 Reglas de ingestión (script de conversión)

- Normalización de nombres de columnas (minúsculas, espacios → `_`).
- **Clave de unión:** `sigla` (string, trim).
- **Geo:** si existe columna `geojson`, se parsea como JSON tipo **Point**; `coordinates` = **[longitud, latitud]**.
- Renombres habituales en capítulo IV: `profundidad` → `profundidad_medida`, `operador` → `empresa`, `area` → `yacimiento`.
- Merge entre capítulo IV y producción por `sigla`.
- Salida: un único **Parquet** maestro (reemplazo completo al regenerar).

### 4.3 Campos usados en la app (referencia)

Incluyen, entre otros: `sigla`, `empresa`, `provincia`, `cuenca`, `yacimiento`, `profundidad_medida`, `prod_pet`, `prod_gas`, `tipo_de_recurso`, `latitud`, `longitud` (los nombres exactos siguen el esquema resultante del ETL y `drilling_schema.md`).

La app **no** lee Excel/CSV en runtime en el servidor de producción típico; la API lee **Parquet** vía DuckDB.

---

## 5. Vistas y flujo de usuario (frontend)

- **Mapa:** filtros multiselect reactivos, centro inicial en Argentina (Cuenca Neuquina), clustering de marcadores según implementación en React/Leaflet o librería usada.
- **Detalle:** ficha por pozo (sigla) con métricas y gráficos según el diseño actual del frontend.
- **Navegación:** rutas o estado de la SPA según `frontend/` (cliente stateless respecto del servidor).

---

## 6. Reglas de negocio (API / datos)

- Filtros y límites de puntos en mapa se implementan en SQL DuckDB o en capa de servicio (ver `backend/main.py` para límites por defecto y máximos).
- Solo se exponen pozos con coordenadas válidas donde el endpoint de mapa lo requiera.

---

## 7. Limitaciones y matices

- Rendimiento con decenas de miles de puntos: usar límites de API y agregación según configuración.
- La ficha de pozo muestra **serie mensual real** según el Parquet (`mes`, producción mensual); el mapa usa **totales anuales agregados** por pozo para ranking y conteos.

---

## 8. Errores / estados vacíos

- Sin Parquet: HTTP 503 con mensaje para ejecutar `convert_to_parquet.py`.
- Dataset vacío o sin coordenadas: respuestas vacías o mensajes en UI según implementación.

---

## 9. Línea evolutiva

- Preparado a futuro para **asistente RAG** (fase 3).
- Referencia de dominio: `drilling_schema.md`.

---

## 10. Preguntas orientadoras para mejoras

- UX: drawer de detalle, deep linking estable por `sigla`.
- Datos: ingest incremental, versionado de Parquet, series temporales reales.
- Mapa: estilos por cuenca/operador, export GeoJSON.
- Arquitectura: tests del ETL y de endpoints; CI.
- Despliegue: HTTPS, variables de entorno, contenedores.
