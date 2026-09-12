# La Casa del Perfume

Aplicación local para consultar el catálogo mayorista y preparar el trabajo de la tienda. React, TypeScript y Vite. Esta versión no conecta una base de datos ni registra ventas o movimientos definitivos.

## Abrir la aplicación

Node 22.12 o superior y npm:

```sh
npm ci
npm run dev
```

Abrir **http://localhost:5173/demo**. No requiere cuenta de Supabase. Mantener el servidor encendido mientras se usa la aplicación. `localhost` corresponde al equipo donde se abre el enlace.

## Pantallas disponibles

- **Inicio:** logos originales de la tienda, resumen del catálogo y 48 reflexiones de ánimo y fe. Cada visita elige una nueva, sin repetir hasta recorrer la colección; el historial se conserva en el navegador. Son reflexiones originales, sin atribuciones a santos ni citas bíblicas literales.
- **Catálogo:** 260 referencias y 38 marcas, con búsqueda, filtros por categoría (Árabe, Diseñador, Nicho y Por confirmar), marca, género y tamaño; 24 productos por página. Tres tarifas de mayor: Emprendedor, VIP y Premium. Selector NIO/USD que toma el precio original de cada lista, sin convertir importes.
- **Ficha de producto:** foto enlazada desde Google Drive, enlace original y etiqueta CODE128 descargable. Los códigos `LCP-…` son internos y únicos por referencia. El EAN/UPC del fabricante está pendiente; no aparece en los Excel.
- **Facturación:** agregar productos y cantidades, datos del cliente, forma de pago y notas; cambiar tarifa o moneda, guardar y reabrir borradores e imprimirlos con el logo. Los precios de las tres tarifas se conservan dentro del borrador. No emite una factura fiscal, no calcula impuestos y no modifica existencias.
- **Inventario:** cantidades por Bodega/Tienda pendientes (`—`, no cero); formularios de Entrada, Salida y Dañado que guardan movimientos pendientes. Los movimientos no actualizan saldos. UNDS en los Excel es un campo de pedido, no un inventario inicial.
- **Proveedores:** registro y edición de empresa, contacto, teléfono, correo, RUC, dirección, marcas, condiciones y notas; búsqueda por empresa, persona o marca.
- **Escáner:** cámara y búsqueda manual de códigos internos. Por ejemplo `LCP-B106BB7E6C` corresponde a Rasasi Hawas black. La cámara requiere HTTPS o localhost y permiso del navegador; se libera al detenerla o salir de la pantalla.
- **Alertas:** quedan pendientes hasta contar con cantidades y mínimos reales.

Los borradores y proveedores se guardan con `localStorage`. Pertenecen al navegador y origen utilizados: `localhost` y `127.0.0.1` tienen almacenamientos diferentes. No se sincronizan entre equipos o perfiles ni constituyen un registro operativo. Borrar los datos del sitio también borra estos registros locales. No se envían datos de clientes o proveedores a servicios externos.

## Fuentes y datos pendientes

Las tres listas Excel aportadas contienen el mismo catálogo y tres niveles de precio. Se importaron sin alterar los originales. El resultado está en `src/data/catalog.json`; el análisis y sus decisiones se detallan en [docs/discovery/catalog-import.md](docs/discovery/catalog-import.md).

Hay 258 enlaces a fotos de Google Drive y dos referencias sin enlace. Las fotos necesitan acceso al archivo externo. Si una no carga, la interfaz lo indica y permite abrir el enlace original. No se utiliza una API de pago ni se han descargado fotos de terceros al repositorio.

Cuatro tamaños parecen haberse convertido a fechas en Excel y quedan «Por confirmar». Se conservan las unidades originales en oz. El género se toma únicamente de términos explícitos del nombre; donde falta se indica «Por confirmar». La categoría es una clasificación inicial por marca que deberán revisar los dueños. No se deduce disponibilidad de una celda vacía ni se interpreta «Agotado» como conteo físico.

Para reconstruir la importación con los tres archivos originales en una carpeta, usando Python estándar:

```sh
python scripts/import_catalog.py RUTA_A_LA_CARPETA
```

El script verifica referencias únicas y su coincidencia entre las tres listas. Mantiene cada set y presentación por separado. Los archivos originales, datos de contactos y borradores locales no se versionan.

## Autenticación existente

El acceso privado continúa en `/login`. `/`, `/inventory`, `/scanner`, `/sales`, `/products`, `/alerts` y `/suppliers` requieren sesión y un rol válido. Sus equivalentes bajo `/demo` permiten revisar el catálogo y los formularios locales sin sesión. La vista local no concede permisos sobre datos remotos.

La integración de Auth existente usa estas variables en `.env.local`, ignorado por Git:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_DATA_MODE=demo
```

Solo se admiten claves públicas publishable. No usar `service_role` o claves secretas. Los roles se leen de `app_metadata.role` (`admin` / `operator`), nunca de `user_metadata`. Las futuras escrituras reales necesitarán autorización en PostgreSQL y RLS. Esta versión no crea tablas, migraciones ni cambios en un proyecto Supabase.

## Comprobaciones

```sh
npm run build
npm run lint
npm test
npm run test:e2e
```

Playwright usa Chrome instalado y prueba escritorio y móvil. Las pruebas funcionales cubren importación, moneda/tarifa, importes, rotación de frases, filtros, etiquetas, guardado y reapertura de borradores, edición de proveedores, movimientos pendientes y ciclo de vida de cámara. Los nuevos flujos prueban también la ausencia de fotos sin depender de la red externa. Capturas y trazas quedan en `test-results/` (ignorado).

La aceptación en cámaras físicas Android/iPhone y contra cuentas reales de Supabase sigue pendiente. Para publicar la aplicación en el futuro se necesita un hosting HTTPS con fallback SPA a `index.html`; subir el código a GitHub no ejecuta el servidor ni configura la base de datos.
