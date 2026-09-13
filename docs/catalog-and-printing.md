# Catálogo editable, fotos propias e impresión

## Activación en Supabase

La actualización requiere `20260913120000_catalog_management_and_images.sql`, después de las cinco migraciones existentes. **En esta sesión no se aplicó a la base remota:** esta copia no dispone de `.env.local` ni de acceso administrativo al proyecto. Las pruebas SQL usan PostgreSQL local desechable (PGlite), con esquemas de plataforma de prueba.

1. Aplicar la migración mediante el flujo de migraciones de Supabase o revisar/ejecutar su contenido en el SQL Editor del proyecto `LCP-Control`. No volver a ejecutar las migraciones antiguas que ya están aplicadas.
2. Completar `.env.local` según `.env.example` con la URL y clave **publicable**. No añadir contraseñas ni claves secretas a variables `VITE_*`.
3. Entrar con una cuenta activa de `staff_members` con rol `admin`.
4. Abrir **Catálogo → Administrar perfumes**. Crear, editar y retirar requieren la migración. Las lecturas de inventario y escáner conservan compatibilidad con el esquema anterior.

## Edición del catálogo

- Datos: nombre, marca (existente o nueva), categoría Árabe/Diseñador/Nicho/Por confirmar, género, tamaño/unidad, EAN/UPC, mínimo, estado y seis precios independientes. Una marca nueva se crea al guardar el producto.
- SKU correlativo `LCP-…` asignado por la base; el EAN/UPC se registra sólo si se conoce. No se deduce a partir del nombre.
- Los dos saldos nuevos quedan sin contar. Editar el catálogo no altera existencias.
- La revisión del producto evita sobrescribir cambios de otra persona: si aparece un conflicto, volver al catálogo y abrir de nuevo el perfume.
- Retirar un perfume sin historial elimina su registro. Con documentos, movimientos o trazabilidad de importación, lo desactiva. Los inactivos se pueden editar y reactivar. Las existencias positivas impiden retirarlo.
- Cada cambio queda en `private.catalog_changes`, con usuario y datos anteriores/posteriores. Los documentos emitidos mantienen su descripción e importes originales.
- Las escrituras requieren rol de administrador y tienen un límite conjunto de 120 cambios por minuto y usuario. Un operador puede actualizar sólo su propio nombre desde Mi cuenta.

## Fotografías

Las fotos viven en el bucket privado `product-images`. El personal activo puede leerlas; sólo administradores pueden subirlas, en una carpeta propia. El navegador reduce las nuevas imágenes a un máximo de 1200 píxeles y las convierte a WebP. Cada reemplazo usa una ruta nueva. La aplicación obtiene enlaces firmados y los reutiliza durante la sesión; no consulta Drive al mostrar una ficha.

Las fotos existentes **no se copian por ejecutar SQL**. El importador realiza esa copia una sola vez, desde los enlaces originales. Ejecutar en una terminal interactiva:

Se adelantó la descarga local de 256 imágenes distintas del catálogo de origen y se verificó que todas se pueden decodificar. Están en `private-data/image-cache/`, fuera de Git. El importador reutiliza esa copia cuando está presente; en otro equipo descarga las fotos desde los enlaces de la base. Algunos productos comparten enlace y dos referencias no traían fotografía. Esta copia local todavía no está en Storage.

```sh
node scripts/import_product_images.mjs
node scripts/import_product_images.mjs --apply
```

El primer comando cuenta las fotos pendientes; el segundo descarga y guarda. Ambos piden una cuenta administradora; la contraseña se introduce oculta y no se guarda en archivos. Usan una sesión normal, no una clave `service_role`. La importación conserva precios y atributos y respeta la revisión del producto, por lo que no sobrescribe cambios concurrentes. Se puede repetir: omite productos que ya tengan foto propia y muestra los SKU que fallen.

Los enlaces sin permiso, fotos inválidas o productos sin enlace quedan pendientes para subir una foto manualmente. Hasta completar la importación se muestra Foto pendiente y se conserva el enlace de origen para abrirlo manualmente. Las fotos antiguas o subidas antes de un fallo de guardado se conservan como archivos sin asociar; se podrán depurar después desde Storage, sin borrar una foto en uso. El bucket rechaza archivos de más de 5 MB y formatos distintos de JPG/PNG/WebP.

## Mi cuenta

Cada persona puede editar su nombre visible y solicitar cambios de correo o contraseña. El nombre se actualiza en `staff_members`; correo y contraseña pasan por Supabase Auth. Los cambios de correo pueden requerir confirmación según la configuración del proyecto. La interfaz no permite modificar el rol ni habilitar personal. No se cambiaron credenciales durante las pruebas.

## Facturas y proformas tamaño carta

En ambas pantallas, **Ver ejemplo en carta** abre un documento independiente con datos inventados y claramente marcado como ejemplo. No emite documentos, no registra clientes y no toca inventario. Impresión y PDF incluyen logo, color propio, datos del cliente, columnas de cantidades/precios/importes, total, observaciones y firmas. Las listas extensas continúan en páginas adicionales; el PDF repite encabezados y numera las páginas.

Los campos fiscales del negocio quedan en blanco. No se inventa un RUC, autorización fiscal ni impuestos. El formato de factura es comercial provisional. Se conserva la lógica existente: facturar descuenta inventario y proformar no lo modifica. El RUC del cliente sigue perteneciendo al borrador; la emisión actual no lo persiste.

Para regenerar los dos PDF de ejemplo con el mismo código de la aplicación:

```sh
node scripts/export_examples.mjs
```

Se escriben en `output/pdf/`, ignorado por Git. Los ejemplos son visibles en `/demo/documents/example/invoice` y `/demo/documents/example/proforma` durante desarrollo, o bajo `/documents/example/…` con sesión. La vista local permite probar los campos del editor y las fotos, pero no guarda productos reales.

## Verificación

```sh
npm run check
npm run test:db
npm run test:e2e
```

Las pruebas de PostgreSQL comprueban permisos, seis precios, saldos sin contar, conflictos de edición, fotos privadas, conservación de documentos, eliminación/desactivación y actualización del perfil. PGlite no sustituye la prueba de aceptación del servicio remoto de Storage y de Supabase Auth tras aplicar la migración.

El conteo inicial, la sincronización de proveedores y el hosting HTTPS siguen siendo tareas independientes. El conteo requiere cantidades físicas; no se deduce de los Excel de precios.
