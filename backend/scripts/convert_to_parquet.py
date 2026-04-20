"""
CSV en Documentos/2025 y Documentos/2026 → Parquet anual con granularidad mensual.

Una fila por pozo por mes (prod_pet / prod_gas / prod_agua sin agregar entre meses).

Uso desde la raíz del proyecto (recomendado, con venv del backend):
  backend\\.venv\\Scripts\\python backend\\scripts\\convert_to_parquet.py
"""

from __future__ import annotations

import json
import sys
import unicodedata
from pathlib import Path

import pandas as pd

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent

DOC_2025 = PROJECT_ROOT / "Documentos" / "2025"
DOC_2026 = PROJECT_ROOT / "Documentos" / "2026"
OUT_DIR = PROJECT_ROOT / "data" / "parquet"

MASTER_COLUMN_ORDER: tuple[str, ...] = (
    "sigla",
    "anio",
    "mes",
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


def _read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, encoding="utf-8", low_memory=False)


def _coords_from_geojson_cell(val: object) -> tuple[float | None, float | None]:
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
    cap = cap.copy()
    rename: dict[str, str] = {}
    if "profundidad" in cap.columns and "profundidad_medida" not in cap.columns:
        rename["profundidad"] = "profundidad_medida"
    if "operador" in cap.columns and "empresa" not in cap.columns:
        rename["operador"] = "empresa"
    if "area" in cap.columns and "yacimiento" not in cap.columns:
        rename["area"] = "yacimiento"
    if "tipo_recurso" in cap.columns and "tipo_de_recurso" not in cap.columns:
        rename["tipo_recurso"] = "tipo_de_recurso"
    if "adjiv_fecha_inicio_perf" in cap.columns:
        rename["adjiv_fecha_inicio_perf"] = "fecha_inicio_perf"
    if "adjiv_fecha_fin_perf" in cap.columns:
        rename["adjiv_fecha_fin_perf"] = "fecha_fin_perf"
    return cap.rename(columns=rename)


def _is_production_csv(path: Path) -> bool:
    n = path.name.lower()
    if "capitulo" in n or "listado" in n:
        return False
    return "producc" in n


def _all_production_csv_paths() -> list[Path]:
    paths: list[Path] = []
    for base in (DOC_2025, DOC_2026):
        if not base.is_dir():
            continue
        for p in sorted(base.glob("*.csv")):
            if _is_production_csv(p):
                paths.append(p)
    return paths


def _load_production_rows_for_year(target_year: int) -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    for path in _all_production_csv_paths():
        df = _normalize_columns(_read_csv(path))
        if "anio" not in df.columns:
            continue
        df["anio"] = pd.to_numeric(df["anio"], errors="coerce")
        df = df[df["anio"] == target_year]
        if df.empty:
            continue
        frames.append(df)
    if not frames:
        return pd.DataFrame()
    return pd.concat(frames, ignore_index=True)


def _prepare_monthly_production(df: pd.DataFrame) -> pd.DataFrame:
    """Una fila por (sigla, anio, mes). Si el mismo mes viene en varios CSV, suma producción."""
    if df.empty:
        return df
    out = df.copy()
    out["sigla"] = out["sigla"].astype(str).str.strip()
    out = out[out["sigla"] != ""]
    if "mes" not in out.columns:
        raise ValueError("Los CSV de producción deben incluir columna 'mes'.")
    out["mes"] = pd.to_numeric(out["mes"], errors="coerce")
    out = out[out["mes"].between(1, 12)]
    out["anio"] = pd.to_numeric(out["anio"], errors="coerce")
    sum_cols = [c for c in ("prod_pet", "prod_gas", "prod_agua") if c in out.columns]
    first_cols = [
        c
        for c in (
            "empresa",
            "cuenca",
            "provincia",
            "tipo_de_recurso",
            "tipoextraccion",
            "tipoestado",
            "yacimiento",
            "idpozo",
        )
        if c in out.columns
    ]
    agg_map: dict[str, str] = {c: "sum" for c in sum_cols}
    for c in first_cols:
        agg_map[c] = "first"
    grouped = out.groupby(["sigla", "anio", "mes"], as_index=False).agg(agg_map)
    for c in ("prod_pet", "prod_gas", "prod_agua"):
        if c not in grouped.columns:
            grouped[c] = pd.NA
    return grouped


def _load_capitulo(year_dir: Path) -> pd.DataFrame:
    path = year_dir / "capitulo-iv-pozos.csv"
    if not path.is_file():
        raise FileNotFoundError(f"No existe {path}")
    cap = _apply_drilling_schema_aliases(_normalize_columns(_read_csv(path)))
    if "sigla" not in cap.columns:
        raise ValueError(f"{path.name} debe tener columna 'sigla'.")
    cap["sigla"] = cap["sigla"].astype(str).str.strip()
    if "geojson" in cap.columns:
        lat_lon = cap["geojson"].apply(_coords_from_geojson_cell)
        cap["_lat_cap"] = [t[0] for t in lat_lon]
        cap["_lon_cap"] = [t[1] for t in lat_lon]
    else:
        cap["_lat_cap"] = pd.NA
        cap["_lon_cap"] = pd.NA
    keep = [
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
            "tipo_de_recurso",
            "_lat_cap",
            "_lon_cap",
        )
        if c in cap.columns
    ]
    return cap[keep].drop_duplicates(subset=["sigla"], keep="first")


def _load_listado_coords(year_dir: Path) -> pd.DataFrame:
    path = year_dir / "listado-de-pozos-cargados-por-empresas-operadoras.csv"
    if not path.is_file():
        return pd.DataFrame(columns=["sigla", "latitud_lst", "longitud_lst"])
    df = _normalize_columns(_read_csv(path))
    if "sigla" not in df.columns:
        return pd.DataFrame(columns=["sigla", "latitud_lst", "longitud_lst"])
    df["sigla"] = df["sigla"].astype(str).str.strip()
    xcol = "coordenadax" if "coordenadax" in df.columns else None
    ycol = "coordenaday" if "coordenaday" in df.columns else None
    if not xcol or not ycol:
        return pd.DataFrame(columns=["sigla", "latitud_lst", "longitud_lst"])
    sub = df[["sigla", xcol, ycol]].copy()
    sub = sub.rename(columns={xcol: "longitud_lst", ycol: "latitud_lst"})
    sub["latitud_lst"] = pd.to_numeric(sub["latitud_lst"], errors="coerce")
    sub["longitud_lst"] = pd.to_numeric(sub["longitud_lst"], errors="coerce")
    sub = sub.dropna(subset=["latitud_lst", "longitud_lst"], how="any")
    return sub.drop_duplicates(subset=["sigla"], keep="first")


def _fold_province_key(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.upper().strip()


def _normalize_place_fields(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for col in ("provincia", "cuenca", "empresa"):
        if col not in df.columns:
            continue
        s = (
            df[col]
            .astype(str)
            .replace({"nan": "", "<na>": ""})
            .str.strip()
            .str.upper()
        )
        df[col] = s.replace("", pd.NA)

    if "provincia" in df.columns:
        prov_map_fold = {
            _fold_province_key("NEUQUEN/NQN"): "Neuquén",
            _fold_province_key("S. CRUZ"): "Santa Cruz",
            _fold_province_key("CHUBUT/CHB"): "Chubut",
        }

        def map_prov(v: object) -> object:
            if pd.isna(v) or v is None:
                return v
            key = _fold_province_key(str(v))
            return prov_map_fold.get(key, v)

        df["provincia"] = df["provincia"].map(map_prov)

    return df


def _year_document_dir(anio: int) -> Path:
    return DOC_2025 if anio == 2025 else DOC_2026


def build_year_dataframe(anio: int) -> pd.DataFrame:
    if anio not in (2025, 2026):
        raise ValueError("Solo se soportan anio 2025 o 2026.")

    raw = _load_production_rows_for_year(anio)
    prod = _prepare_monthly_production(raw)

    year_dir = _year_document_dir(anio)
    cap = _load_capitulo(year_dir)
    lst = _load_listado_coords(year_dir)

    merged = prod.merge(cap, on="sigla", how="left", suffixes=("_prod", "_cap"))

    for base in (
        "idpozo",
        "empresa",
        "provincia",
        "cuenca",
        "yacimiento",
        "tipo_de_recurso",
        "tipoestado",
        "tipoextraccion",
    ):
        prod_c = f"{base}_prod"
        cap_c = f"{base}_cap"
        if prod_c in merged.columns or cap_c in merged.columns:
            if prod_c in merged.columns and cap_c in merged.columns:
                merged[base] = merged[prod_c].where(~merged[prod_c].isna(), merged[cap_c])
                merged.drop(columns=[prod_c, cap_c], inplace=True)
            elif prod_c in merged.columns:
                merged.rename(columns={prod_c: base}, inplace=True)
            elif cap_c in merged.columns:
                merged.rename(columns={cap_c: base}, inplace=True)

    if "profundidad_medida_cap" in merged.columns:
        merged.rename(
            columns={"profundidad_medida_cap": "profundidad_medida"}, inplace=True
        )
    elif "profundidad_medida_prod" in merged.columns:
        merged.rename(
            columns={"profundidad_medida_prod": "profundidad_medida"}, inplace=True
        )

    for c in ("fecha_inicio_perf", "fecha_fin_perf"):
        cap_c = f"{c}_cap"
        if cap_c in merged.columns:
            merged.rename(columns={cap_c: c}, inplace=True)

    merged = merged.merge(lst, on="sigla", how="left")

    lat_cap = merged["_lat_cap"] if "_lat_cap" in merged.columns else pd.Series(
        pd.NA, index=merged.index
    )
    lon_cap = merged["_lon_cap"] if "_lon_cap" in merged.columns else pd.Series(
        pd.NA, index=merged.index
    )
    if "latitud_lst" in merged.columns:
        merged["latitud"] = merged["latitud_lst"].where(
            merged["latitud_lst"].notna(), lat_cap
        )
    else:
        merged["latitud"] = lat_cap

    if "longitud_lst" in merged.columns:
        merged["longitud"] = merged["longitud_lst"].where(
            merged["longitud_lst"].notna(), lon_cap
        )
    else:
        merged["longitud"] = lon_cap

    drop_extra = [
        c
        for c in (
            "latitud_lst",
            "longitud_lst",
            "_lat_cap",
            "_lon_cap",
            "geojson",
        )
        if c in merged.columns
    ]
    merged.drop(columns=drop_extra, inplace=True, errors="ignore")

    merged["anio"] = anio
    merged["mes"] = pd.to_numeric(merged["mes"], errors="coerce")
    merged["sigla"] = merged["sigla"].astype(str).str.strip()

    for col in (
        "latitud",
        "longitud",
        "profundidad_medida",
        "prod_pet",
        "prod_gas",
        "prod_agua",
        "mes",
    ):
        if col in merged.columns:
            merged[col] = pd.to_numeric(merged[col], errors="coerce")

    merged = _normalize_place_fields(merged)

    ordered = [c for c in MASTER_COLUMN_ORDER if c in merged.columns]
    extra = [c for c in merged.columns if c not in ordered]
    merged = merged[ordered + extra]

    return merged


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for anio in (2025, 2026):
        df = build_year_dataframe(anio)
        out = OUT_DIR / f"wells_{anio}.parquet"
        df.to_parquet(out, engine="pyarrow", index=False)
        print(f"OK: {anio}: {len(df):,} filas -> {out}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        raise SystemExit(1)
