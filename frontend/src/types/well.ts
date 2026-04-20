/** Punto para el mapa (GET /api/wells). */
export type WellMapPoint = {
  sigla: string | null
  latitud: number | null
  longitud: number | null
}

/** Campos comunes de ficha / fila Parquet. */
export type Well = {
  sigla: string | null
  anio?: number | null
  mes?: number | null
  idpozo?: string | null
  empresa: string | null
  provincia: string | null
  cuenca: string | null
  yacimiento: string | null
  latitud: number | null
  longitud: number | null
  prod_pet: number | null
  prod_gas: number | null
  prod_agua?: number | null
  tipo_de_recurso: string | null
  profundidad_medida?: number | null
  tipoestado?: string | null
  tipoextraccion?: string | null
  fecha_inicio_perf?: string | null
  fecha_fin_perf?: string | null
}

/** GET /api/wells/{sigla} devuelve una fila por mes con producción declarada. */
export type WellMonthlyRecord = Well
