# Iniciativas AF2026 | Grupo Ramos

# Dashboard de Iniciativas — Grupo Ramos (versión corregida para GitHub Pages)

## Corrección principal
Este paquete tiene una sola página `index.html` con **estilos CSS, JavaScript y el logo oficial integrados**. La interfaz no depende de las carpetas `assets` o `js` y no debe verse como texto plano aun si faltaran archivos externos.

## Cómo publicar
1. Entra a tu repositorio `DASHBOARD-INAF2026` en GitHub.
2. Abre el archivo `index.html`, pulsa el icono de lápiz (Edit this file) y reemplaza todo su contenido por el contenido del `index.html` de este paquete. Guarda con `Commit changes`. También puedes subir `index.html` por `Add file > Upload files` y sobrescribir el anterior.
3. Verifica `Settings > Pages > Deploy from a branch > main > /(root)`.
4. Abre https://anapeguero.github.io/DASHBOARD-INAF2026/ tras la publicación y pulsa Ctrl+F5 si muestra caché vieja.

## Datos
- `BD Plan Detallado`: columna G determina estado de compra; C y F identifican partida e ítem.
- `Presupuesto Vs Real`: presupuesto en G, real en H y diferencia G-H.
- `Flujo de Caja`: A código, B descripción, C presupuesto DOP, D+ períodos identificados por encabezado P1/P2...
- Comparativo de proyectos y matrices jerárquicas se preservan. Los subtotales del flujo no se vuelven a sumar en el total.
- Excel se procesa en tu navegador, no se sube al sitio. **La primera lectura de un Excel necesita internet**, porque el lector SheetJS se carga desde un proveedor externo con respaldo alternativo.
- Para evitar exposición, no subas Excel confidenciales al repositorio público.

## Archivos
- `index.html` — único archivo indispensable para el dashboard.
- `.nojekyll` — evita tratamiento de Jekyll, opcional.
