# DB Schema (Parquet)

Esquema real de los datasets `wells_2025.parquet` y `wells_2026.parquet`, extraido con DuckDB (`DESCRIBE SELECT * FROM read_parquet(...)`).

## Archivos

- `data/parquet/wells_2025.parquet`
- `data/parquet/wells_2026.parquet`

## Columnas y tipos

| Columna | Tipo DuckDB | Nullable |
|---|---|---|
| `sigla` | `VARCHAR` | YES |
| `anio` | `BIGINT` | YES |
| `mes` | `DOUBLE` | YES |
| `idpozo` | `DOUBLE` | YES |
| `empresa` | `VARCHAR` | YES |
| `yacimiento` | `VARCHAR` | YES |
| `provincia` | `VARCHAR` | YES |
| `cuenca` | `VARCHAR` | YES |
| `latitud` | `DOUBLE` | YES |
| `longitud` | `DOUBLE` | YES |
| `prod_pet` | `DOUBLE` | YES |
| `prod_gas` | `DOUBLE` | YES |
| `prod_agua` | `DOUBLE` | YES |
| `tipo_de_recurso` | `VARCHAR` | YES |
| `profundidad_medida` | `DOUBLE` | YES |
| `fecha_inicio_perf` | `VARCHAR` | YES |
| `fecha_fin_perf` | `VARCHAR` | YES |
| `tipoestado` | `VARCHAR` | YES |
| `tipoextraccion` | `VARCHAR` | YES |

## Nota operativa

Los dos Parquet anuales (`2025` y `2026`) comparten exactamente el mismo orden de columnas y tipos.
