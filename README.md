# Dashboard de Iniciativas — Grupo Ramos

Dashboard estático para GitHub Pages. Incluye seguimiento de compras, presupuesto vs. real, flujo de caja y comparativo de iniciativas.

## Publicación en GitHub Pages

1. Crea un repositorio en GitHub (preferiblemente **privado** si el proyecto pertenece a la empresa; confirma las políticas internas antes de publicarlo).
2. Sube **el contenido de esta carpeta** a la raíz del repositorio: `index.html`, `assets/` y `js/`. No necesitas subir los Excel.
3. En GitHub, abre **Settings → Pages → Build and deployment**, elige **Deploy from a branch**, `main` y `/ (root)`.
4. Espera a que GitHub muestre la URL de Pages y ábrela. La app necesita acceso a internet para cargar la biblioteca externa SheetJS, utilizada para leer Excel.
5. Pulsa **Cargar Excel**, selecciona uno o varios libros `.xlsx`/`.xls` y usa el selector de proyectos.

> **IMPORTANTE (privacidad):** GitHub Pages publica los archivos que despliegues. No subas al repositorio información financiera confidencial, ni libros de Excel con datos internos. La app lee Excel en el navegador y guarda las importaciones en **IndexedDB local** (mismo navegador, mismo dispositivo y misma dirección web); no las manda a un servidor. Si abres Pages en otra PC o navegador, tendrás que volver a cargar los Excel. Borrar datos del navegador elimina los proyectos guardados. Incluso un repositorio privado puede no equivaler a un portal de acceso corporativo: consulta los controles de tu organización.

## Hojas reconocidas

- `BD Plan Detallado`: la columna **G** determina el estado; `Stock` = stock/completado, `Pendiente de compra` = pendiente, números de OC = colocada, vacíos = sin información y casos no concluyentes = revisar.
- `Presupuesto Vs Real`: **columna G = presupuesto (Plan)** y **columna H = Real**, tanto para el total general como para cada partida. Partidas principales (`1.00`, `2.00`...) expandibles; subpartidas (`1.01`, `2.01`...) en detalle; diferencia = presupuestado menos real. Se usa el `TOTAL GENERAL ESTIMADO` de origen, cuando está disponible, para el total del proyecto, evitando duplicar subtotales.
- `Flujo de Caja`: encabezados `P1`, `P2`... y partidas jerárquicas. El gran total suma una sola vez el detalle; se ignoran controles, tipo de cambio, totales y conversiones. Cuando existe un subtotal sin ningún detalle, se usa ese subtotal como dato único de su grupo; cuando un subtotal difiere de su detalle, aparece una advertencia.

Se pueden cargar libros con una o más hojas reconocidas. El tablero informa cuáles faltan o no fueron reconocidas. Los importes de presupuesto vs. real están etiquetados como **USD**, y el flujo de caja como **DOP**, de acuerdo con las capturas de estructura facilitadas. Confirma siempre las monedas y el contenido en el Excel original.

## Funciones

- Selector de un proyecto o todas las iniciativas.
- Subida múltiple de Excel; actualización del mismo archivo por nombre; administración para renombrar, eliminar o fijar el año inicial del flujo.
- Resumen ejecutivo con indicadores financieros, clasificaciones de compra y curva del flujo.
- Matrices desplegables con subtotales sin doble conteo y diferencia financiera.
- **Comparativo de partidas entre proyectos, lado a lado:** cada proyecto tiene Plan, Real y Diferencia; agrupa por código de partida, permite desplegar subpartidas y exportar CSV. Disponible al seleccionar «Todos los proyectos» en «Presupuesto vs. Real» y dentro de «Comparativo de proyectos».
- Búsqueda de partidas, ítems, OC y proveedores; filtro de estado; exportación de detalles a CSV.
- **Exportar PDF**: abre la impresión del navegador; escoge «Guardar como PDF». Funciona mejor con las secciones y tamaños por defecto.

## Desarrollo y pruebas

Este proyecto no necesita un servidor de backend. Para probarlo localmente, sirve el directorio por HTTP (por ejemplo, con `python -m http.server 8000` desde esta carpeta y abre `http://localhost:8000`). Abrir `index.html` directamente con `file://` puede impedir los módulos JavaScript o IndexedDB.

Ejecuta `npm test` para comprobar la lógica de clasificación, jerarquías y exclusión de subtotales (se necesita Node.js 18+). No hay compilación ni instalación de dependencias para desplegar.

## Límites y reglas contables

Este dashboard está adaptado a **las estructuras visibles en las capturas** de las tres hojas. Si tu libro real desplaza las columnas, contiene fórmulas sin resultados calculados, cambia los encabezados o utiliza otro formato, puede necesitar ajustes de lectura. Verifica siempre los indicadores contra los valores del archivo real antes de tomar decisiones de compras o presupuesto.

El campo `Real` refleja el valor de la hoja **Presupuesto Vs Real**, sin asumir que es facturado, pagado o comprometido. Los montos de la BD Plan Detallado se muestran como información por ítem y no se suman como presupuesto, dado que pueden estar repetidos por línea. El porcentaje de compras gestionadas se calcula sobre registros reconocidos como colocada, stock o pendiente; las filas vacías y de revisión se reportan aparte.

## Actualización a columnas G/H

Si cargaste proyectos con una versión anterior del dashboard, **vuelve a importar los archivos Excel** para recalcular los valores: las filas ya importadas no guardan las celdas originales del libro. Se mostrará una advertencia cuando se detecten proyectos importados con la versión anterior.


## Paleta visual (Grupo Ramos)

La interfaz usa la combinación turquesa/celeste de la plantilla de presupuesto facilitada: **#31869B** (principal), **#4BACC6** (secundario), **#DAEEF3** (superficies y tablas) y **#03A1DD** (acento inspirado en el isotipo visible). Esta es una aproximación tomada de las capturas, no un manual oficial de marca. Cambiar la paleta no modifica la lectura de datos, la clasificación de compras ni la exclusión de subtotales.
