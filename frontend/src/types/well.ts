/** Punto para el mapa (GET /api/wells). */
export type WellMapPoint = {
  sigla: string | null
  latitud: number | null
  longitud: number | null
}

/** Ficha / fila del Parquet (GET /api/wells/{sigla}). */
export type Well = {
  sigla: string | null
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
