# Manual de usuario — PyG (Inteligencia Petrolera)

Guía para **usuarios finales** de la aplicación web **PyG**: exploración de pozos en mapa, filtros y ficha de detalle. Para instalación y datos técnicos, ver `MANUAL_EJECUCION.md` y `Caracteristicas_tecnicas_y_funcionales.md`.

---

## 1. Qué es PyG

**PyG — Inteligencia petrolera** es una aplicación pensada para equipos de **oil & gas** (por ejemplo, un socio no operador en Argentina) que necesitan **ubicar pozos en un mapa**, **filtrar** por operadora, provincia o cuenca, y **consultar una ficha** con producción y metadatos. Los datos provienen de un conjunto maestro cargado en el servidor (no editás el mapa desde la web).

---

## 2. Cómo acceder

| Entorno | Dirección típica | Notas |
|--------|-------------------|--------|
| Desarrollo local (Windows) | **http://localhost:5173** | Tras ejecutar `run_app.bat` desde la raíz del proyecto. El mapa y la interfaz se sirven con Vite; la API corre en el puerto 8000 en segundo plano. |
| Producción (ej. nube) | La URL que indique su administrador (por ejemplo **HTTPS** con dominio corporativo) | En despliegue monolítico, la misma URL sirve la interfaz y las rutas `/api/...`. |

Si la página no carga, comprobá conexión de red y que el servicio esté iniciado (en local, que sigan abiertas las ventanas del backend y del frontend que abre `run_app.bat`).

---

## 3. Pantalla general

### 3.1 Cabecera

- **Menú (ícono de tres rayas):** muestra u oculta el **panel de filtros** a la izquierda.
- **PyG (con ícono de mapa):** enlace al **mapa principal** (`/`).
- Subtítulo **Inteligencia petrolera** (en pantallas anchas).

### 3.2 Área principal

- A la **izquierda** (si el panel está visible): filtros y búsqueda.
- A la **derecha**: vista **Mapa de pozos** o, si navegaste, la **ficha de un pozo**.

---

## 4. Mapa de pozos

### 4.1 Qué ves

- **Mapa interactivo** centrado en **Argentina** (énfasis en la Cuenca Neuquina).
- **Marcadores** agrupados en **clusters** (al acercar el zoom se separan).
- **Control de capas** (esquina del mapa): podés alternar bases (calles, satélite, etc.) y una **capa de etiquetas** alineada a nomenclatura argentina (IGN).
- **Escala** cartográfica.

### 4.2 Coordenadas bajo el cursor

En la cabecera de la sección **Mapa de pozos**, a la derecha del título, se muestran **Latitud** y **Longitud** (cinco decimales) mientras el puntero está **sobre el mapa**. Si salís del mapa, se conserva el último valor hasta salir de la página.

### 4.3 Contador y límite de puntos

Debajo del título verás:

- Cuántos **pozos hay en vista** (según filtros y límite del deslizador).
- El **límite actual** de puntos dibujados y cuántos pozos son **elegibles** (con coordenadas válidas bajo el filtro). El mapa prioriza los pozos con **mayor suma aproximada petróleo + gas** dentro de ese tope.

### 4.4 Abrir la ficha de un pozo

- **Clic** en un marcador o en un elemento del cluster cuando ya esté desagregado.
- Se abre la **ficha del pozo en una pestaña nueva** (`window.open` con `noopener` y `noreferrer`), para no perder el mapa en la pestaña actual.
- La dirección tiene la forma **`/pozo/<sigla>`** (la sigla puede codificarse en la URL si lleva caracteres especiales).

---

## 5. Panel lateral — Filtros

### 5.1 Búsqueda por sigla

- Campo de **búsqueda** al inicio del panel: escribí un fragmento de la **sigla** del pozo.
- Aparecen hasta **diez sugerencias**; podés elegir una para abrir su ficha en **nueva pestaña** (mismo criterio que en el mapa).

### 5.2 Filtros por listas

Tres listas con casillas (**multiselección**):

- **Empresa** (operadora).
- **Provincia**.
- **Cuenca**.

Podés marcar **varias opciones** en cada lista. El mapa y los contadores se **actualizan automáticamente** al cambiar la selección. Si una lista no tiene valores, verás el texto **Sin datos**.

### 5.3 Máximo de pozos en el mapa

- **Deslizador** (slider) que fija el número máximo de puntos mostrados, entre **0** y el total **elegible** con los filtros actuales.
- Sirve para **aligerar** el mapa cuando hay muchos pozos. El criterio de prioridad es el **top por producción petróleo + gas** (ver documentación técnica para matices de unidades).

### 5.4 Limpiar filtros

El botón **Limpiar filtros** vacía todas las selecciones de empresa, provincia y cuenca y restablece el contexto de filtrado (el deslizador sigue sujeto al nuevo total elegible).

### 5.5 Colapsar el panel

- **Cruz (X)** en la cabecera del panel de filtros: cierra el panel lateral.
- **Menú** en la barra superior: lo vuelve a mostrar.

---

## 6. Ficha de pozo (detalle)

Se abre en **nueva pestaña** desde el mapa o la búsqueda. La URL es **`/pozo/<sigla>`**.

### 6.1 Contenidos habituales

- **Volver al mapa** (enlace al inicio).
- **Identificación:** sigla, estado, recurso convencional / no convencional (según datos).
- **Indicadores** de producción (petróleo, gas, agua), **profundidad**, **corte de agua** cuando aplica, **coordenadas**.
- **Gráfico** de series mensuales (visualización auxiliar; ver nota en documentación técnica).
- **Mini mapa** con la ubicación del pozo.
- Tabla de **metadatos** adicionales según el dataset.
- **Descargar CSV:** exporta metadatos y columnas coherentes con el gráfico auxiliar, en **UTF-8** con BOM para abrir bien en Excel.

### 6.2 Errores

- Si el pozo **no existe** en el dataset, verás un mensaje de error acorde (por ejemplo HTTP 404).
- Si hay **problemas de red** o el servidor no responde, el mensaje indicará revisar conexión o que el administrador verifique el servicio.

### 6.3 Actualizar o compartir el enlace

Podés **actualizar la página** o **copiar la URL** de la pestaña de la ficha: en producción monolítica, el servidor debe devolver la misma aplicación y la ruta `/pozo/...` la interpreta React en el navegador.

---

## 7. Mensajes y estados frecuentes

| Situación | Qué significa |
|-----------|----------------|
| **Sincronizando con la API…** | Se están pidiendo datos al servidor; esperá unos segundos. |
| **Cargando…** en el panel de filtros | Se están cargando opciones de filtros o conteos. |
| Mensaje sobre **Parquet** o **503** | El servidor no encuentra el archivo de datos maestro. Quien administra el sistema debe regenerar o colocar el Parquet (`MANUAL_EJECUCION.md`). |
| **0 elegibles** | Ningún pozo cumple los filtros con coordenadas válidas; probá limpiar filtros o relajar criterios. |

---

## 8. Privacidad y alcance

- La aplicación está pensada para trabajar con **datos bajo control** de la organización (local o nube privada).
- El manual **no** reemplaza las políticas internas de datos ni de seguridad de su empresa.

---

## 9. Documentación relacionada

- `MANUAL_EJECUCION.md` — entorno Python, Node, generación de Parquet, `run_app.bat`.
- `Caracteristicas_tecnicas_y_funcionales.md` — stack, API, reglas de datos y despliegue.
- `README.md` — resumen del repositorio.
