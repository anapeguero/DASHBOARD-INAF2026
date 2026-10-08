# Dashboard de Iniciativas — Grupo Ramos

Sitio web estático preparado para **GitHub Pages**. Diseño basado en la vista de referencia «Iniciativas de Inversión» con menú azul petróleo, tarjetas de gestión, matrices desplegables y gráfico de flujo mensual.

## Publicar en GitHub

1. Descomprime el ZIP.
2. Copia **el contenido** de esta carpeta (especialmente `index.html`, `assets/` y `js/`) a la **raíz** de tu repositorio de GitHub. No copies únicamente el ZIP.
3. Confirma los cambios en la rama `main`.
4. En GitHub entra a **Settings → Pages → Build and deployment → Deploy from a branch**.
5. Elige `main` y `/(root)` y guarda. Abre la URL que te proporcione GitHub Pages.

## Cargar iniciativas

- Usa **+ Cargar Excel** (permite varios archivos `.xlsx` o `.xls`). Cada archivo representa un proyecto independiente.
- La pantalla empieza con una **VISTA DEMOSTRATIVA** identificada. Esa información no es tu base de datos real: al importar uno o más Excel, se reemplaza por los datos de los proyectos.
- Selecciona proyectos en el filtro **Proyecto**, o `Todos los proyectos` para el portafolio.
- En **Gestionar proyectos** puedes cambiar nombre, formato (Sirena / Aprezio), tipo (Nueva / Remodelación) y año inicial del flujo. Si el año no consta, no se inventa.
- Puedes volver a cargar un archivo con el mismo nombre para **actualizar** su proyecto.
- Puedes filtrar por formato/tipo; año/trimestre aplican a los pagos programados (gráfico y matriz de flujo), **no** reescriben el presupuesto financiero total.

## Hojas y lectura

| Hoja | Datos esperados | Reglas |
| --- | --- | --- |
| `BD Plan Detallado` | Columna G: Orden de compra | Número de orden = Colocada; `Stock` = Stock/Completado; `Pendiente de compra` = Pendiente; vacía = Sin información; texto ambiguo = Revisar. |
| `Presupuesto Vs Real` | **G**: Plan, **H**: Real | Diferencia = Plan − Real. Subpartidas `1.01`, `2.01`, etc. desplegables bajo `1.00`, `2.00`. Se utiliza el total oficial «TOTAL GENERAL ESTIMADO» si existe; **no se suman subtotales más detalles**. |
| `Flujo de Caja` | P1, P2, P3… por mes | Se suman valores del detalle y no se añaden los subtotales de partida; se excluyen `Total - DOP`, `Control`, `Tasa USD`, `Flujo - USD` del gran total. Si existe tasa USD válida, el gráfico mensual puede mostrar una conversión a USD, pero la matriz y sus valores de origen siguen en DOP. |

## Secciones

- **Resumen Ejecutivo:** tarjetas, presupuesto por partida, distribución, matriz jerárquica, compras y flujo mensual.
- **Seguimiento de Compras:** estados, progreso, tabla filtrable y exportación CSV.
- **Presupuesto vs. Real:** presupuesto, real, diferencia, % desviación; subpartidas desplegables.
- **Flujo de Caja:** gráfico mensual y matriz desplegable con años/meses.
- **Comparativo Proyectos:** cada partida alineada con columnas **Plan, Real y Diferencia** de cada proyecto una al lado de la otra.
- **Data General:** comparación tabular de proyectos y trazabilidad de hojas.

## Exportar PDF

Pulsa **Descargar PDF** y, en el cuadro de impresión del navegador, escoge **Guardar como PDF**. La impresión utiliza diseño horizontal para que los datos entren con mayor facilidad. También hay botones CSV donde corresponde.

## Privacidad, almacenamiento y limitaciones

- **NO subas los Excel con información confidencial al repositorio público.** Solo debes publicar los archivos del dashboard (`index.html`, `assets`, `js`, etc.).
- Los Excel se leen directamente en el navegador, sin enviarlos a un servidor. Los resultados procesados se conservan en **IndexedDB del navegador** actual; **no se sincronizan entre equipos ni usuarios**. Si borras datos de ese sitio, tendrás que volver a importar.
- El lector de Excel **SheetJS** se carga desde un CDN público; es necesaria conexión al abrir el dashboard para que el navegador lo descargue si no está en caché. Si tu empresa bloquea esos sitios, deberá permitirse la librería o alojarse una copia autorizada localmente.
- Las fórmulas de Excel deben estar calculadas y **guardadas con valores** en el archivo original; el lector no recalcula fórmulas.
- No se dispone de Excel original para verificar formatos no visibles en las capturas. Comprueba las advertencias de reconocimiento/conciliación antes de difundir cifras.
- Esta versión no contiene backend, autenticación ni permisos de usuarios: es una herramienta local de análisis con publicación estática.
- Se incorporó el logo aportado por el usuario en `assets/logo-grupo-ramos.png` (barra lateral y encabezado), además de un favicon derivado de su símbolo en `assets/favicon-ramos.png`. La combinación principal se mantiene fiel a la imagen original.

## Pruebas

En un entorno con Node.js:

```bash
npm test
```

Contiene pruebas de clasificación de compra, lectura por G/H, totalización de partidas, flujo sin duplicaciones, tasa USD y comparación interproyectos.

## Actualización visual del logo

- Logo oficial aportado: `assets/logo-grupo-ramos.png`, mostrado en un recuadro blanco del menú y en el encabezado.
- Favicon: `assets/favicon-ramos.png`, derivado del símbolo azul del logo suministrado.
- Colores del logo: azul `#02A1E2` y gris `#53616C`.
- **Al actualizar GitHub**, sube también las dos imágenes nuevas y reemplaza `index.html` y `assets/style.css`. No basta con subir solo `index.html`.
- Si no ves el cambio, recarga la página con Ctrl+F5 o abre una ventana privada para evitar el caché.
