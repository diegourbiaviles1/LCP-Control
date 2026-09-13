# LCP Control

Aplicación web para administrar el catálogo, inventario y documentos comerciales de La Casa del Perfume Nicaragua. La interfaz separa **Facturación** de **Proformas / cotizaciones** y usa el catálogo de precios Emprendedor, VIP y Premium importado desde los archivos de trabajo del negocio.

## Ejecución local

Requisitos: Node 22.12 o superior, npm y Chrome para las pruebas de navegador.

```sh
npm install
npm run dev
```

Abrir `http://localhost:5173`. `/demo` permite revisar la interfaz con datos aislados. Las rutas privadas usan Supabase y requieren las variables de entorno del proyecto:

```sh
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Copiar `.env.example` a `.env.local`. Las claves secretas y `service_role` nunca deben ir al navegador ni al repositorio.

## Rutas principales

- `/demo/invoices`: facturación de demostración.
- `/demo/proformas`: proformas y cotizaciones de demostración.
- `/invoices` y `/proformas`: operación privada después de iniciar sesión.
- `/inventory`, `/scanner` y `/alerts`: inventario, lectura de códigos y alertas.

Cada documento guarda la lista de precio elegida por el dueño, moneda, cliente y detalle de productos. Una proforma está identificada como **PROFORMA / COTIZACIÓN** y nunca descuenta inventario. Una factura valida existencias y registra el movimiento de salida de forma atómica. El botón de WhatsApp abre un mensaje prellenado en `wa.me`; la persona revisa el contenido y pulsa enviar desde WhatsApp.

## Supabase

La migración `supabase/migrations/20260912233508_business_catalog_documents.sql` crea el catálogo, listas de precio, clientes, inventario por ubicación, documentos, movimientos, auditoría e idempotencia. La migración `20260912234838_restrict_internal_helpers.sql` prepara el cierre de dos advertencias de seguridad para tablas internas; debe aplicarse cuando el proyecto permita ejecutar migraciones nuevamente.

Los tres Excel de precios se analizaron e importaron directamente a Supabase: 260 productos, 38 marcas y 1.560 precios. Los archivos originales y los resultados generados se mantienen fuera de Git porque contienen información operativa del negocio. Las cantidades iniciales de inventario quedan como `NULL` hasta realizar un conteo físico; no se interpretan como cero.

El dueño elige la lista de precio de cada cliente. La creación de cuentas de los dos dueños y sus filas en `staff_members` queda para la siguiente etapa, como se acordó. Después se podrán habilitar operadores adicionales sin cambiar el modelo de datos.

## Validación

```sh
npm run build
npm run lint
npm run test
npm run test:e2e
```

La suite actual valida 41 pruebas unitarias, 12 flujos de navegador en escritorio y móvil, el aislamiento entre factura y proforma, la generación de enlaces de WhatsApp, la idempotencia y la atomicidad de movimientos. También se ejecutó una prueba local de PostgreSQL con PGlite para verificar el esquema, RLS, importación y reglas de negocio.

## Arquitectura

La UI consume contratos de dominio a través de servicios. `demoAdapter` mantiene la demo aislada; `supabaseAdapter` consulta y escribe en Supabase. Las páginas no acceden directamente a fixtures ni a la base de datos. Los permisos de la interfaz son una ayuda visual: RLS y las funciones transaccionales de PostgreSQL son la autoridad final.
