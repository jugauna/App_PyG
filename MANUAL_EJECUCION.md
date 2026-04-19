# Manual de ejecución — App PyG

Guía para preparar el entorno y ejecutar la **Plataforma de Inteligencia Petrolera** (stack **FastAPI + React/Vite + DuckDB** sobre Parquet).

## Punto de entrada único (Windows)

Desde la **raíz del proyecto** (carpeta que contiene `backend/`, `frontend/`, `Documentos/`, `data/`):

1. **Requisitos previos**
   - **Python 3.11+** con entorno virtual en **`backend/.venv`** (no se usa un venv en la raíz para la app).
   - **Node.js + npm** (frontend).
   - Parquet maestro: `data/parquet/wells_master.parquet` (generado con el importador; ver más abajo).

2. **Un solo clic**  
   Ejecutá **`run_app.bat`** en la raíz. El script:
   - Intenta liberar los puertos **8000** y **5173** si hay procesos escuchando.
   - Si no existe **`frontend/node_modules`**, ejecuta **`npm install`** en `frontend/`.
   - Abre una ventana con **uvicorn** (`backend/`, puerto 8000).
   - Abre otra con **`npm run dev`** (`frontend/`, puerto 5173).
   - Tras unos segundos abre el navegador en **http://localhost:5173**.

3. **URLs**
   - Frontend: http://localhost:5173  
   - API (FastAPI): http://127.0.0.1:8000 — documentación: http://127.0.0.1:8000/docs  

Si algo falla, revisá que exista `backend\.venv` con dependencias instaladas (`pip install -r backend\requirements.txt`).

---

## Importador a Parquet (datos para la API)

Los Excel esperados en **`Documentos/`**:

- `capitulo4-pozos.xlsx`
- `Produccion-pozos-2026.xlsx`

Desde la raíz (con el venv del backend):

```powershell
backend\.venv\Scripts\python backend\scripts\convert_to_parquet.py
```

Salida: `data/parquet/wells_master.parquet`. La API consulta ese archivo con **DuckDB** (variable opcional `WELLS_PARQUET` para otra ruta).

---

## Arranque manual (sin el .bat)

**Terminal 1 — backend**

```powershell
cd "c:\Desarrollo\Proyectos\App PyG\backend"
.\.venv\Scripts\activate
python -m uvicorn main:app --reload --port 8000
```

**Terminal 2 — frontend**

```powershell
cd "c:\Desarrollo\Proyectos\App PyG\frontend"
npm install
npm run dev
```

Abrir http://localhost:5173.

---

## Archivos de datos (`Documentos/`)

- **Capítulo IV:** `capitulo4-pozos.xlsx` (recomendado) **o** `capitulo-iv-pozos.csv` — columna `geojson` como texto JSON tipo Point (`coordinates`: longitud, latitud).
- **Producción:** `Produccion-pozos-2026.xlsx` **o** `produccion-de-pozos-de-gas-y-pet.csv`

Los `.xlsx` se leen con **openpyxl** en el script de conversión.

---

## Resolución de problemas breve

| Síntoma | Acción |
|--------|--------|
| Puerto 8000 o 5173 en uso | Volvé a ejecutar `run_app.bat` (intenta liberar puertos) o cerrá el proceso a mano. |
| Frontend sin datos / error API | Verificá que FastAPI esté en marcha y que exista `data/parquet/wells_master.parquet`. |
| `No existe backend\.venv` | En `backend/`: `python -m venv .venv` y `pip install -r requirements.txt`. |
| API 503 “Parquet no disponible” | Ejecutá `convert_to_parquet.py` y confirmá la ruta (`WELLS_PARQUET` si usás otro archivo). |

## Referencia técnica

- Esquema de campos: `drilling_schema.md`
- Especificación funcional: `docs/ESPECIFICACION_FUNCIONAL.md`
- Convenciones del proyecto: `.cursorrules`
