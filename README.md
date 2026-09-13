# La Casa del Perfume

Aplicación de inventario, facturación y proformas con React, TypeScript, Vite y Supabase.

## Abrir la aplicación

Requiere Node 22.12 o superior y npm. Desde la carpeta del proyecto:

```sh
npm ci
npm run dev
```

Abrir **http://127.0.0.1:5173/login**. Para trabajar con datos reales, configurar `.env.local` según `.env.example` y disponer de una cuenta activa en `staff_members`. Las instrucciones de la base están en [docs/database.md](docs/database.md).

**http://127.0.0.1:5173/demo** permite explorar 30 productos inventados, con códigos `DEMO-0001` a `DEMO-0030`. Esta vista existe únicamente en desarrollo y pruebas. Siempre usa datos sintéticos, incluso si `.env.local` configura una base real. Permite preparar borradores; no emite documentos ni modifica existencias.

Mantener el servidor encendido mientras se utiliza la aplicación. Usar siempre el mismo origen: `localhost` y `127.0.0.1` tienen sesiones y almacenamiento local independientes. Los servidores de desarrollo y preview escuchan solamente en este equipo.

## Flujos disponibles

- **Catálogo e inventario:** búsqueda y filtros, precios por lista y moneda, fotos y etiquetas CODE128. El código interno procede de `products.sku`; el EAN/UPC del fabricante, si existe, se conserva por separado. Ambos sirven para buscar productos activos.
- **Movimientos reales:** Entrada y Ajuste para administradores; Salida y Dañado también para operadores. Ajuste establece el saldo total de una ubicación y admite cero. Un producto sin contar requiere primero un ajuste. La confirmación llama a la función transaccional de la base y actualiza la vista.
- **Escáner:** búsqueda manual y cámara, con acciones de inventario sobre el producto encontrado. Requiere localhost o HTTPS y permiso de cámara. La cámara se libera al detenerla o salir.
- **Facturación:** emite `FAC-…` con cliente, teléfono, forma de pago y ubicación; descuenta inventario al confirmarse en la base. No es un comprobante fiscal y no calcula impuestos.
- **Proformas:** emite `PRO-…` con vigencia; no cobra ni modifica inventario. Tiene borradores separados de las facturas.
- **Documentos emitidos:** muestran los renglones e importes confirmados por la base, quedan bloqueados para edición y pueden imprimirse o compartirse. Para preparar otro documento se usa Nueva factura/Nueva proforma. El RUC del formulario pertenece solo al borrador: el contrato actual de emisión no lo guarda.
- **WhatsApp y PDF:** comparten un borrador identificado como tal o el documento emitido. WhatsApp abre el mensaje para revisión y envío manual. El PDF usa el menú de compartir cuando el navegador lo permite; en computadora se descarga.
- **Proveedores:** registro local de contactos y condiciones; todavía no se sincroniza con la base. El alta de productos también sigue siendo una pantalla preparatoria, no un registro definitivo.

Los reintentos de emisión y movimientos con los mismos datos conservan el identificador de operación mientras el formulario sigue abierto. Los clics simultáneos comparten una sola solicitud. Si se pierde una respuesta, reintentar desde ese formulario. Cerrar, recargar o empezar otra operación crea una nueva solicitud: ante una emisión dudosa, comprobar el registro en la base antes de repetirla.

## Almacenamiento y datos

Los registros reales viven en Supabase; los precios y existencias se validan allí. Las políticas de acceso exigen una cuenta activa del personal. La aplicación obtiene el rol de `staff_members`, no de metadatos editables del navegador.

Borradores y proveedores locales se guardan por cuenta y por vista (`demo` o usuario). No se sincronizan entre equipos y se pierden al borrar los datos del sitio. Las claves antiguas sin cuenta se conservan sin modificación, pero no se incorporan automáticamente a un usuario: hace falta identificar a quién pertenecen antes de recuperarlas.

El catálogo real no se incluye en `src/data/catalog.json` ni en la compilación. El importador genera un archivo privado:

```sh
python scripts/import_catalog.py RUTA_A_LA_CARPETA_CON_LOS_EXCEL
```

La salida es `private-data/catalog.json`, ignorada por Git. Este script no carga los datos a Supabase por sí solo. El análisis de origen está en [docs/discovery/catalog-import.md](docs/discovery/catalog-import.md). Las fotos externas necesitan permiso de lectura; si no cargan se muestra una alternativa y el enlace original.

## Comprobación y mantenimiento

```sh
npm run check
npm run test:e2e
```

`check` ejecuta lint, pruebas unitarias/integración y compilación. Playwright utiliza Chrome instalado y prueba escritorio y móvil con un servidor propio en el puerto 5174 y credenciales vacías. El puerto debe estar libre. Las pruebas de interfaz no realizan operaciones contra la base real.

Para limpiar salidas generadas, detener antes las pruebas y el servidor de preview:

```sh
npm run clean
```

Elimina únicamente `dist`, `test-results`, `playwright-report`, `coverage` y la antigua caché `tsconfig.tsbuildinfo`. Conserva dependencias, fuentes, configuración, migraciones y datos. La caché actual de TypeScript está en `node_modules/.cache`.

Para reconstruir y revisar la versión compilada:

```sh
npm run build
npm run preview
```

Abrir la dirección indicada por preview. La compilación no incluye `/demo`; necesita configuración y una cuenta autorizada. Mantener `dist` mientras se use preview o se sirva esa carpeta. Para instalar en otra máquina, conservar `package-lock.json` y ejecutar `npm ci`.

La publicación requiere un hosting HTTPS con fallback SPA a `index.html`. Las pruebas locales no sustituyen la aceptación con cuentas reales, conteos físicos ni cámaras de teléfonos. No se han emitido documentos ni alterado inventario real durante esta revisión.
