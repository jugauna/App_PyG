"""
API PyG — lectura de pozos desde Parquet vía DuckDB (Fase 1).

Ejecución (desde carpeta backend):
    ..\\.venv\\Scripts\\python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import logging
import math
import os
import threading
from contextlib import asynccontextmanager
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Annotated, Any

import duckdb
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, TypeAdapter
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

load_dotenv()


def _configure_app_logging() -> None:
    """Formato uniforme; nivel por defecto INFO. En desarrollo: LOG_LEVEL=DEBUG."""
    raw = os.getenv("LOG_LEVEL", "INFO").strip().upper()
    level = getattr(logging, raw, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


_configure_app_logging()
logger = logging.getLogger(__name__)


def _cors_extra_origins() -> list[str]:
    """Orígenes adicionales (p. ej. producción). Lista separada por comas en CORS_ALLOW_ORIGINS."""
    raw = os.getenv("CORS_ALLOW_ORIGINS", "").strip()
    return [x.strip() for x in raw.split(",") if x.strip()]


_LOCALHOST_ORIGIN_REGEX = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
STATIC_ROOT = (BACKEND_DIR / "static").resolve()
DEFAULT_PARQUET_DIR = PROJECT_ROOT / "data" / "parquet"
DEFAULT_WELL_YEAR = 2026
ALLOWED_WELL_YEARS: frozenset[int] = frozenset({2025, 2026})
DEFAULT_MAP_POINTS_LIMIT = 5_000
MAX_MAP_POINTS_LIMIT = 500_000


def _parquet_path_for_year(anio: int) -> Path:
    """Parquet anual `wells_{anio}.parquet` bajo `data/parquet/`.

    `WELLS_PARQUET` puede ser:
    - Ruta a un archivo `.parquet` (modo legacy: mismo fichero para cualquier `anio`).
    - Ruta a un directorio (p. ej. `data/parquet`): se usa `{dir}/wells_{anio}.parquet`.
    Sin variable: `PROJECT_ROOT/data/parquet/wells_{anio}.parquet`.
    """
    raw = os.getenv("WELLS_PARQUET", "").strip()
    if not raw:
        return (DEFAULT_PARQUET_DIR / f"wells_{anio}.parquet").resolve()
    p = Path(raw)
    if not p.is_absolute():
        p = (PROJECT_ROOT / p).resolve()
    if p.is_file() and p.suffix.lower() == ".parquet":
        return p
    return (p / f"wells_{anio}.parquet").resolve()


AnioQuery = Annotated[
    int,
    Query(ge=2025, le=2026, description="Año del dataset (Parquet particionado)"),
]


def _sql_string_literal(s: str) -> str:
    """Literal comillas simples para SQL (DuckDB no admite ? en read_parquet dentro de CREATE VIEW)."""
    return "'" + s.replace("'", "''") + "'"


# Una sola conexión + vista (recrear por cada request era muy lento). DuckDB no es thread-safe: lock en lecturas.
_db_lock = threading.Lock()
_db_con: duckdb.DuckDBPyConnection | None = None
_db_parquet_key: str | None = None


def _close_shared_db() -> None:
    global _db_con, _db_parquet_key
    with _db_lock:
        if _db_con is not None:
            try:
                _db_con.close()
            except Exception:
                pass
            _db_con = None
            _db_parquet_key = None


def _get_connection(anio: int = DEFAULT_WELL_YEAR) -> duckdb.DuckDBPyConnection:
    global _db_con, _db_parquet_key
    path = _parquet_path_for_year(anio)
    if not path.is_file():
        raise HTTPException(
            status_code=503,
            detail=f"Parquet no disponible: {path}. Ejecutá convert_to_parquet.py.",
        )
    key = f"{anio}:{path.resolve()}"
    with _db_lock:
        if _db_con is not None and _db_parquet_key == key:
            return _db_con
        if _db_con is not None:
            try:
                _db_con.close()
            except Exception:
                pass
            _db_con = None
        con = duckdb.connect(database=":memory:")
        path_sql = _sql_string_literal(path.resolve().as_posix())
        con.execute(
            f"""
            CREATE OR REPLACE VIEW wells AS
            SELECT * FROM read_parquet({path_sql})
            """
        )
        _db_con = con
        _db_parquet_key = key
        return _db_con


@asynccontextmanager
async def _lifespan(app: FastAPI):
    logger.info("PyG API — arranque (lifespan)")
    try:
        default_path = _parquet_path_for_year(DEFAULT_WELL_YEAR)
        if default_path.is_file():
            _get_connection(DEFAULT_WELL_YEAR)
            logger.info(
                "DuckDB listo para año por defecto %s (%s)",
                DEFAULT_WELL_YEAR,
                default_path,
            )
        else:
            logger.info(
                "Parquet no presente para %s: %s — endpoints pueden responder 503 hasta el ETL",
                DEFAULT_WELL_YEAR,
                default_path,
            )
    except HTTPException as e:
        logger.info("Calentamiento inicial omitido: %s", e.detail)
    yield
    logger.info("PyG API — cierre: liberando conexión DuckDB compartida")
    _close_shared_db()


app = FastAPI(title="PyG API", version="0.1.0", lifespan=_lifespan)


class AllowPrivateNetworkMiddleware(BaseHTTPMiddleware):
    """Chrome: preflight con Access-Control-Request-Private-Network necesita esta cabecera."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["Access-Control-Allow-Private-Network"] = "true"
        return response


# Primero el outer: añade cabecera PNA a todas las respuestas (incl. OPTIONS de CORS).
app.add_middleware(AllowPrivateNetworkMiddleware)
# Sin credenciales: localhost (regex) + orígenes explícitos vía CORS_ALLOW_ORIGINS (DigitalOcean, etc.).
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_extra_origins(),
    allow_origin_regex=_LOCALHOST_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1024)


class WellMapPoint(BaseModel):
    """Solo coordenadas + sigla para el mapa (payload mínimo)."""

    sigla: str | None = None
    latitud: float | None = None
    longitud: float | None = None


_WELL_MAP_POINTS_ADAPTER = TypeAdapter(list[WellMapPoint])


class WellFilterOptions(BaseModel):
    empresas: list[str]
    provincias: list[str]
    cuencas: list[str]


class WellMapCount(BaseModel):
    count: int


def _cell_json(v: Any) -> str | float | int | bool | None:
    """Convierte celdas DuckDB/Parquet a tipos JSON seguros (sin NaN/Inf; sin pd.NA)."""
    if v is None:
        return None
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    if isinstance(v, bool):
        return v
    if isinstance(v, int):
        return v
    if isinstance(v, str):
        return v
    if isinstance(v, bytes):
        return v.decode("utf-8", errors="replace")
    if isinstance(v, Decimal):
        x = float(v)
        return None if math.isnan(x) or math.isinf(x) else x
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if hasattr(v, "item"):
        try:
            return _cell_json(v.item())
        except (ValueError, TypeError):
            return str(v)
    try:
        import pandas as pd

        if pd.isna(v):
            return None
    except (ImportError, TypeError, ValueError):
        pass
    return str(v)


@app.get("/api/health")
def health() -> dict[str, str | dict[str, str]]:
    rows: dict[str, str] = {}
    ok = True
    for y in sorted(ALLOWED_WELL_YEARS):
        p = _parquet_path_for_year(y)
        rows[str(y)] = str(p.resolve()) if p.is_file() else f"(ausente) {p.resolve()}"
        ok = ok and p.is_file()
    return {
        "status": "ok" if ok else "no_parquet",
        "default_anio": str(DEFAULT_WELL_YEAR),
        "parquet_por_anio": rows,
    }


def _clean_in_values(values: list[str] | None) -> list[str] | None:
    if not values:
        return None
    clean = [v.strip() for v in values if v and v.strip()]
    return clean or None


def _wells_map_base_sql_params(
    empresa: list[str] | None,
    provincia: list[str] | None,
    cuenca: list[str] | None,
) -> tuple[str, list[object]]:
    """`FROM wells WHERE ...` sobre filas mensuales: coords válidas + filtros IN."""
    sql = """
        FROM wells
        WHERE sigla IS NOT NULL
          AND trim(CAST(sigla AS VARCHAR)) != ''
          AND latitud IS NOT NULL
          AND longitud IS NOT NULL
    """
    params: list[object] = []

    def add_in(column: str, values: list[str] | None) -> None:
        nonlocal sql, params
        clean = _clean_in_values(values)
        if not clean:
            return
        placeholders = ",".join(["?" for _ in clean])
        sql += f" AND {column} IN ({placeholders})"
        params.extend(clean)

    add_in("empresa", empresa)
    add_in("provincia", provincia)
    add_in("cuenca", cuenca)
    return sql, params


@app.get("/api/wells/filter-options", response_model=WellFilterOptions)
def well_filter_options(anio: AnioQuery = DEFAULT_WELL_YEAR) -> WellFilterOptions:
    """Valores distintos para multiselect del front (sin traer todos los pozos)."""
    con = _get_connection(anio)
    try:
        with _db_lock:
            emp = [
                r[0]
                for r in con.execute(
                    "SELECT DISTINCT empresa FROM wells WHERE empresa IS NOT NULL AND trim(CAST(empresa AS VARCHAR)) != '' ORDER BY 1"
                ).fetchall()
            ]
            # Data Cleaning Phase: filtros de provincia/cuenca deshabilitados temporalmente.
            prov: list[str] = []
            cue: list[str] = []
        return WellFilterOptions(
            empresas=[str(_cell_json(e) or "") for e in emp],
            provincias=[str(_cell_json(p) or "") for p in prov],
            cuencas=[str(_cell_json(c) or "") for c in cue],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("well_filter_options failed")
        raise HTTPException(
            status_code=500,
            detail=f"Error consultando filtros: {e!s}",
        ) from e


@app.get("/api/wells/count", response_model=WellMapCount)
def wells_map_count(
    empresa: list[str] | None = Query(None),
    provincia: list[str] | None = Query(None),
    cuenca: list[str] | None = Query(None),
    anio: AnioQuery = DEFAULT_WELL_YEAR,
) -> WellMapCount:
    """Cantidad de pozos con coordenadas que cumplen los filtros (para el slider del mapa)."""
    con = _get_connection(anio)
    try:
        base_sql, params = _wells_map_base_sql_params(empresa, provincia, cuenca)
        with _db_lock:
            row = con.execute(
                f"SELECT COUNT(*) FROM (SELECT sigla {base_sql} GROUP BY sigla) AS _w",
                params,
            ).fetchone()
        n = int(row[0]) if row and row[0] is not None else 0
        return WellMapCount(count=n)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("wells_map_count failed")
        raise HTTPException(
            status_code=500,
            detail=f"Error contando pozos: {e!s}",
        ) from e


@app.get("/api/wells", response_model=list[WellMapPoint])
def list_wells(
    empresa: list[str] | None = Query(None, description="Filtrar por empresa (repetir param o un valor)"),
    provincia: list[str] | None = Query(None),
    cuenca: list[str] | None = Query(None),
    anio: AnioQuery = DEFAULT_WELL_YEAR,
    limit: int = Query(
        DEFAULT_MAP_POINTS_LIMIT,
        ge=0,
        le=MAX_MAP_POINTS_LIMIT,
        description="Máximo de pozos a devolver (orden: mayor petróleo+gas)",
    ),
) -> list[WellMapPoint]:
    """Puntos para el mapa: sigla + lat + lon. Orden: producción combinada descendente."""
    con = _get_connection(anio)
    try:
        if limit == 0:
            return []
        base_sql, params = _wells_map_base_sql_params(empresa, provincia, cuenca)
        sql = f"""
            SELECT sigla,
                   max(latitud) AS latitud,
                   max(longitud) AS longitud
            {base_sql}
            GROUP BY sigla
            ORDER BY SUM(COALESCE(prod_pet, 0)) + SUM(COALESCE(prod_gas, 0)) DESC
            LIMIT ?
        """
        qparams = [*params, limit]
        with _db_lock:
            rows = con.execute(sql, qparams).fetchall()
        cols = ["sigla", "latitud", "longitud"]
        raw = [{c: _cell_json(v) for c, v in zip(cols, r, strict=True)} for r in rows]
        return _WELL_MAP_POINTS_ADAPTER.validate_python(raw)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("list_wells failed")
        raise HTTPException(
            status_code=500,
            detail=f"Error consultando datos: {e!s}",
        ) from e


@app.get("/api/wells/search", response_model=list[str])
def search_wells(
    q: str = Query("", max_length=120, description="Fragmento de sigla (ILIKE, sin distinguir mayúsculas)"),
    anio: AnioQuery = DEFAULT_WELL_YEAR,
) -> list[str]:
    """Hasta 10 siglas que contienen el texto buscado."""
    needle = q.strip()
    if not needle:
        return []
    con = _get_connection(anio)
    try:
        pattern = f"%{needle}%"
        with _db_lock:
            rows = con.execute(
                """
                SELECT sigla
                FROM (
                    SELECT DISTINCT sigla
                    FROM wells
                    WHERE sigla IS NOT NULL
                      AND trim(CAST(sigla AS VARCHAR)) != ''
                      AND sigla ILIKE ?
                ) AS _s
                ORDER BY sigla
                LIMIT 10
                """,
                [pattern],
            ).fetchall()
        out: list[str] = []
        for r in rows:
            if r[0] is None:
                continue
            s = str(_cell_json(r[0]) or "").strip()
            if s:
                out.append(s)
        return out
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("search_wells failed")
        raise HTTPException(
            status_code=500,
            detail=f"Error en búsqueda: {e!s}",
        ) from e


@app.get("/api/wells/{sigla}")
def get_well(
    sigla: str,
    anio: AnioQuery = DEFAULT_WELL_YEAR,
) -> list[dict[str, Any]]:
    """Filas mensuales del pozo para el año (orden cronológico por `mes`)."""
    logger.debug("Cargando detalle de %s para el año %s", sigla, anio)
    con = _get_connection(anio)
    try:
        with _db_lock:
            rel = con.execute(
                """
                SELECT * FROM wells
                WHERE sigla = ?
                ORDER BY mes NULLS LAST
                """,
                [sigla],
            )
            rows = rel.fetchall()
            if not rows:
                raise HTTPException(status_code=404, detail="Pozo no encontrado")
            col_names = [d[0] for d in rel.description]
        return [
            {c: _cell_json(v) for c, v in zip(col_names, row, strict=True)}
            for row in rows
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("get_well failed")
        raise HTTPException(
            status_code=500,
            detail=f"Error consultando pozo: {e!s}",
        ) from e


def _file_under_static(rest_of_path: str) -> Path | None:
    """Ruta a archivo bajo `static/` o None si sale del directorio (path traversal)."""
    if not rest_of_path or rest_of_path.strip() == "":
        return STATIC_ROOT / "index.html"
    candidate = (STATIC_ROOT / rest_of_path).resolve()
    try:
        candidate.relative_to(STATIC_ROOT)
    except ValueError:
        return None
    return candidate if candidate.is_file() else None


@app.get("/")
async def serve_spa_root() -> FileResponse:
    """Raíz: siempre la SPA (React Router en el cliente)."""
    return FileResponse(STATIC_ROOT / "index.html")


@app.get("/{rest_of_path:path}")
async def serve_spa(rest_of_path: str) -> FileResponse:
    """Archivos estáticos (p. ej. /assets/…) o `index.html` para refrescos / pestañas en rutas del client."""
    physical = _file_under_static(rest_of_path)
    if physical is not None:
        return FileResponse(physical)
    return FileResponse(STATIC_ROOT / "index.html")
