"""
Excel (Documentos/) → Parquet maestro con merge por sigla y columnas alineadas a drilling_schema.md.

Uso desde la raíz del proyecto (recomendado, con venv del backend):
 backend\\.venv\\Scripts\\python backend\\scripts\\convert_to_parquet.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

# Raíz del repo (App PyG): backend/scripts → ..
BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent

DOC_DIR = PROJECT_ROOT / "Documentos"
CAP_XLSX = DOC_DIR / "capitulo4-pozos.xlsx"
PROD_XLSX = DOC_DIR / "Produccion-pozos-2026.xlsx"
OUT_DIR = PROJECT_ROOT / "data" / "parquet"
OUT_FILE = OUT_DIR / "wells_master.parquet"

# Orden canónico según drilling_schema.md + modelo Wells existente
MASTER_COLUMN_ORDER: tuple[str, ...] = (
    "sigla",
    "idpozo",
    "empresa",
    "yacimiento",
    "provincia",
    "cuenca",
    "latitud",
    "longitud",
    "prod_pet",
    "prod_gas",
    "prod_agua",
    "tipo_de_recurso",
    "profundidad_medida",
    "fecha_inicio_perf",
    "fecha_fin_perf",
    "tipoestado",
    "tipoextraccion",
)


def _norm_col(s: str) -> str:
    return str(s).strip().lower().replace(" ", "_")


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [_norm_col(c) for c in df.columns]
    return df


def _read_excel(path: Path) -> pd.DataFrame:
    df = pd.read_excel(path, engine="openpyxl")
    df.columns = df.columns.astype(str).str.strip()
    return df


def _coords_from_geojson_cell(val: object) -> tuple[float | None, float | None]:
    """GeoJSON Point: coordinates [longitud, latitud]. Acepta string (p. ej. desde Excel)."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None, None
    s = str(val).strip()
    if not s:
        return None, None
    try:
        obj = json.loads(s)
    except json.JSONDecodeError:
        return None, None
    coords = obj.get("coordinates")
    if not coords or len(coords) < 2:
        return None, None
    try:
        lon = float(coords[0])
        lat = float(coords[1])
    except (TypeError, ValueError):
        return None, None
    return lat, lon


def _apply_drilling_schema_aliases(cap: pd.DataFrame) -> pd.DataFrame:
    """Renombres alineados a drilling_schema.md (operador→empresa, etc.)."""
    cap = cap.copy()
    rename: dict[str, str] = {}
    if "profundidad" in cap.columns and "profundidad_medida" not in cap.columns:
        rename["profundidad"] = "profundidad_medida"
    if "operador" in cap.columns and "empresa" not in cap.columns:
        rename["operador"] = "empresa"
    if "area" in cap.columns and "yacimiento" not in cap.columns:
        rename["area"] = "yacimiento"
    return cap.rename(columns=rename)


def build_master_dataframe() -> pd.DataFrame:
    if not CAP_XLSX.is_file():
        raise FileNotFoundError(f"No existe {CAP_XLSX}")
    if not PROD_XLSX.is_file():
        raise FileNotFoundError(f"No existe {PROD_XLSX}")

    cap = _apply_drilling_schema_aliases(_normalize_columns(_read_excel(CAP_XLSX)))
    prod = _normalize_columns(_read_excel(PROD_XLSX))

    if "sigla" not in cap.columns:
        raise ValueError(f"{CAP_XLSX.name} debe tener columna 'sigla' tras normalizar.")
    if "sigla" not in prod.columns:
        raise ValueError(f"{PROD_XLSX.name} debe tener columna 'sigla' tras normalizar.")

    cap["sigla"] = cap["sigla"].astype(str).str.strip()
    prod["sigla"] = prod["sigla"].astype(str).str.strip()

    if "geojson" in cap.columns:
        lat_lon = cap["geojson"].apply(_coords_from_geojson_cell)
        cap["latitud"] = [t[0] for t in lat_lon]
        cap["longitud"] = [t[1] for t in lat_lon]
    else:
        cap["latitud"] = pd.NA
        cap["longitud"] = pd.NA

    keep_cap = [
        c
        for c in (
            "sigla",
            "idpozo",
            "empresa",
            "provincia",
            "cuenca",
            "yacimiento",
            "profundidad_medida",
            "fecha_inicio_perf",
            "fecha_fin_perf",
            "tipoestado",
            "tipoextraccion",
            "latitud",
            "longitud",
        )
        if c in cap.columns
    ]
    cap_sub = cap[keep_cap].drop_duplicates(subset=["sigla"], keep="first")

    prod_cols = [
        c
        for c in ("sigla", "prod_pet", "prod_gas", "prod_agua", "tipo_de_recurso")
        if c in prod.columns
    ]
    prod_sub = prod[prod_cols].drop_duplicates(subset=["sigla"], keep="first")

    merged = cap_sub.merge(prod_sub, on="sigla", how="outer")

    for col in ("empresa", "provincia", "cuenca", "yacimiento", "latitud", "longitud", "prod_pet", "prod_gas", "prod_agua", "tipo_de_recurso"):
        if col not in merged.columns:
            merged[col] = pd.NA

    for col in ("latitud", "longitud", "profundidad_medida", "prod_pet", "prod_gas", "prod_agua"):
        if col in merged.columns:
            merged[col] = pd.to_numeric(merged[col], errors="coerce")

    ordered = [c for c in MASTER_COLUMN_ORDER if c in merged.columns]
    extra = [c for c in merged.columns if c not in ordered]
    merged = merged[ordered + extra]

    return merged


def main() -> int:
    df = build_master_dataframe()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUT_FILE, engine="pyarrow", index=False)
    print(f"OK: {len(df):,} filas → {OUT_FILE}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        raise SystemExit(1)
