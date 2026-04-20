# Esquema Maestro de Datos - App PyG (Upstream)

## 1. Identificación del Pozo (Clave: sigla)
- **sigla**: Identificador único (ej: YPF.Nq.LLL-1566(h)). 
- **idpozo**: ID numérico del sistema nacional.
- **empresa / operador**: Nombre de la compañía que opera el área.
- **yacimiento / area**: Nombre del bloque o campo productivo.

## 2. Ubicación y Geografía
- **provincia**: Provincia donde se ubica (Neuquén, Chubut, etc.).
- **cuenca**: Cuenca sedimentaria (Neuquina, Golfo San Jorge, etc.).
- **geojson / coordenadas**: Datos geográficos para mapeo (Point: Long, Lat).

## 3. Datos de Producción (Mensual/Diario)
- **anio** / **mes**: Período calendario de la fila en el maestro Parquet (granularidad mensual por pozo).
- **prod_pet**: Producción de petróleo (m3).
- **prod_gas**: Producción de gas (miles de m3).
- **prod_agua**: Producción de agua asociada.
- **tipo_de_recurso**: Clasificación (CONVENCIONAL / NO CONVENCIONAL / SHALE).

## 4. Ingeniería y Construcción (DDR / Cap. IV)
- **profundidad_medida**: Profundidad total alcanzada (metros).
- **fecha_inicio_perf**: Fecha de inicio de perforación (Spud date).
- **fecha_fin_perf**: Fecha de terminación o fin de perforación.
- **npt_hours**: Horas No Productivas (Tiempo perdido) - *Solo para PDFs*.

## 5. Estado y Extracción
- **tipoestado**: Estado actual (Extracción Efectiva, En Estudio, Parado, etc.).
- **tipoextraccion**: Método (Bombeo Mecánico, Surgencia Natural, Electrosumergible).