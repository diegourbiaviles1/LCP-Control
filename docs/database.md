# Base de datos del negocio

Proyecto activo: **LCP-Control**, `xkpujpoocsbkychstrne`, el que configura `.env.local`. Es el que usa la aplicación; el identificador `vqicpwbwuatlyfdzpfne` que aparecía aquí antes no correspondía a este proyecto. **Las trece migraciones de `supabase/migrations` están aplicadas**, incluidas la contabilidad de costos y la tasa del dólar. Las de endurecimiento toleran que un proyecto nuevo no tenga la función histórica `rls_auto_enable`.

Antes de dar por buena una actualización del código, comprobar que la base va a la par. Ya pasó dos veces que no lo estaba: primero cuatro migraciones aplicadas a otro proyecto, y después un primer intento de costos escrito directamente en la base y nunca guardado como archivo. La comprobación rápida:

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

Debe listar las trece migraciones de `supabase/migrations`. La columna `version` guarda la hora en que se aplicó cada una, no el número del archivo; el nombre es el que cuadra con el repositorio.

## El intento de costos que se retiró

El proyecto llegó a tener una primera versión de costos aplicada a mano: una tabla `product_costs` con promedio por moneda y `units_costed`, columnas `unit_cost` y `cost_currency` en `document_items` e `inventory_movements`, y `create_document` y `record_inventory_movement` reescritas para llenarlas. Nunca se usó desde la aplicación —el cliente no envía `unitCost` en un movimiento— y las tres tablas estaban vacías. Su registro además se había reescrito a mano: cuatro filas borradas y una fila inventada, `20260914120000 product_costs`, sin sentencias y ordenada después de todo lo demás.

`20260914051000_reset_abandoned_cost_draft.sql` devuelve las dos funciones a la versión del repositorio y retira la tabla y las columnas; `20260914070000_retire_abandoned_cost_ledger_rows.sql` quita las dos filas huérfanas del registro. Ninguna de las dos toca datos: todo lo retirado estaba vacío y el catálogo, los precios y los saldos quedaron intactos.

## Datos cargados y trazabilidad

- 260 productos, 38 marcas, 3 listas y 1,560 precios independientes NIO/USD. La comparación con los valores originales dio cero diferencias.
- 780 filas de origen, sus tres archivos, hojas y hashes SHA-256 en `private.import_sources/import_rows`. La identidad de unión es marca + nombre + presentación.
- 520 saldos por Bodega/Tienda sin contar (`NULL`); no se deducen existencias de las listas de precios.
- Fotos: **pendientes en este proyecto**. 258 productos conservan su enlace de origen en `image_reference`, pero el bucket `product-images` está vacío y ningún producto tiene `image_path`, así que el catálogo muestra «Foto pendiente». La conversión descrita (WebP, lado mayor 1,000 píxeles, calidad 80, 256 archivos y 8,212,792 bytes) se hizo contra el proyecto anterior. Para repetirla aquí se usa `scripts/import_product_images.mjs` con los originales locales. Comprobación: `select count(*) from storage.objects where bucket_id='product-images';`
- Sin imagen de origen: LCP-0209 (Phantom Parfum con desodorante) y LCP-0210 (One Million EDT con gel). Se pueden añadir desde el editor.
- Clientes, proveedores, documentos y movimientos comienzan vacíos, por decisión del usuario. No se trasladaron operaciones del proyecto anterior.

Para preparar una importación revisable, sin ejecutar escrituras remotas:

```sh
python scripts/prepare_database_catalog.py CARPETA_CON_LOS_TRES_EXCEL
```

La salida en `private-data/database-import` está excluida de Git. No incorporar los Excel, precios privados, fotos originales ni credenciales al repositorio. Los SKU LCP son internos; `products.barcode` sigue reservado para EAN/UPC comprobados.

## Persistencia del programa

| Registro           | Ubicación y comportamiento                                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catálogo           | `products`, `brands`, `product_prices`; alta, edición, seis precios, imagen, archivo/reactivación y revisiones concurrentes.                                         |
| Imágenes           | Bucket privado `product-images`, máximo 5 MB por archivo, JPEG/PNG/WebP. La aplicación optimiza nuevas fotos y usa enlaces firmados. No solicita miniaturas a Drive. |
| Existencias        | `inventory_balances` y `inventory_movements`; escrituras transaccionales mediante `record_inventory_movement`.                                                       |
| Clientes           | `customers`; nombre, teléfono, correo, RUC, dirección, notas, estado y lista de precios. Edición mediante `save_customer`.                                           |
| Proveedores        | `suppliers`; contacto, teléfono, correo, RUC, dirección, marcas, condiciones y notas. Edición mediante `save_supplier`.                                              |
| Facturas/proformas | `documents` y `document_items`; numeraciones FAC/PRO separadas, datos y precios congelados, RUC del cliente incluido.                                                |
| Borradores         | `user_drafts`; facturas/proformas separadas por usuario, sincronizadas entre equipos y protegidas contra sobreescrituras concurrentes.                               |
| Negocio            | `business_settings`; nombre, dirección y teléfono editables; cambios solo afectan documentos nuevos.                                                                 |
| Costos de compra   | `product_costs` (promedio ponderado vigente), `purchase_records` y `opening_cost_records`. Tabla aparte del catálogo para que la política de acceso deje fuera a Ventas.                       |
| Costos congelados  | `document_item_costs` guarda costo, tipo de cambio, tasa de impuesto y venta neta de cada renglón al emitir; `inventory_movement_costs` hace lo mismo con mermas, salidas y ajustes negativos. |
| Gastos             | `expense_records`; categoría, comprobante, impuesto y parte recuperable. No se borran: se anulan con motivo y quedan en el historial.                                                          |
| Tipo de cambio     | `exchange_rates`, una sola fila con la tasa vigente en córdobas por dólar y quién la cambió. Se edita en **Negocio** con `set_exchange_rate`; sólo propone un valor, nunca reescribe operaciones pasadas. |
| Acceso             | Supabase Auth guarda las credenciales. `staff_members` es la única fuente de permisos. `private.pending_staff` reserva correos y roles antes de activar cuentas.     |

La demostración de desarrollo conserva sus datos sintéticos y borradores/proveedores locales. Preferencias de interfaz y rotación de frases siguen en el navegador; no son registros del negocio.

## Permisos y activación

| Rol           | Acceso                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SuperAdmin    | Administración completa y gestión de otros SuperAdmin.                                                                                                 |
| Administrador | Catálogo, imágenes, clientes, proveedores, documentos, inventario, negocio y personal; no puede conceder ni modificar SuperAdmin.                      |
| Ventas        | Catálogo, existencias, clientes, facturación/proformas, salidas y daños. Solo ve sus documentos y movimientos; no cambia tarifas asignadas a clientes. |
| Inventario    | Catálogo, existencias, proveedores en consulta, entradas, salidas, daños y ajustes; solo ve sus movimientos. Sin clientes, documentos comerciales ni costos.   |
| Solo consulta | Catálogo, fotos y existencias; sin escrituras comerciales.                                                                                             |

Estado verificado en este proyecto: dos cuentas activas, ambas con rol **Administrador**, y ninguna autorización pendiente en `private.pending_staff`. No hay ningún SuperAdmin. Conviene saberlo porque `save_staff_account` sólo deja conceder o retirar ese rol a quien ya lo tiene: mientras nadie lo sea, la pantalla de Usuarios no puede crear el primero. Se asigna una sola vez desde la base:

```sql
update public.staff_members set role = 'superadmin'
where user_id = (select id from auth.users where email = 'CORREO@ejemplo.com');
```

A partir de ahí, las altas y los cambios de rol se hacen desde **Usuarios**. No se asignaron contraseñas compartidas ni se enviaron invitaciones.

1. Un administrador autoriza un correo y su rol en **Usuarios**.
2. La persona abre `/activate`, elige su propia contraseña y confirma su correo.
3. El disparador de Auth crea la fila en `staff_members` y consume la autorización pendiente. Un correo no autorizado no puede registrarse.
4. Para retirar acceso, deshabilitarlo desde Usuarios. Se conserva el historial. No se permite quitarse los propios permisos ni eliminar al último SuperAdmin activo.

**Pendiente de puesta en marcha:** el proyecto usa el SMTP de prueba de Supabase. Solo permite confirmaciones a miembros del equipo de Supabase, no a cualquier correo autorizado dentro de la aplicación. Para usuarios ajenos al equipo, configurar un proveedor SMTP en Authentication → Emails → SMTP Settings. No desactivar la confirmación de correo ni dar acceso al panel administrativo a empleados para sortear este límite. [Documentación oficial de SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

Site URL ya apunta a `http://127.0.0.1:5173/login`, el programa local, para regresar después de confirmar el correo. Actualizarla al dominio HTTPS definitivo antes de distribuir la aplicación. No se ha probado aún el inicio de sesión de una cuenta personal activada.

## Contabilidad de costos

El costo se registra donde ocurre la compra, no como un campo de la ficha del perfume que alguien deba recordar actualizar. Todo el módulo vive en **Reportes → Costos, margen y gastos**, visible sólo para Administrador y SuperAdmin (`product.edit_cost` y la política `owner_accounting_read`). Los precios del catálogo son precios de venta y nunca se usan como costo.

- **Estado:** aplicado. Las 260 filas de `product_costs` existen con el promedio en blanco; cada perfume adquiere su costo al registrar su costo inicial o su primera compra.
- **Método:** promedio ponderado. Cada compra recibida recalcula `nuevo promedio = (existencias previas × promedio previo + costo puesto en bodega de la compra) ÷ unidades totales`, dentro de la misma transacción que suma las existencias.
- **Costo puesto en bodega:** precio del proveedor + flete + impuestos **no** recuperables. La parte recuperable del impuesto se registra aparte y no infla el costo.
- **Monedas:** cada compra y cada gasto guardan su propio tipo de cambio; la contabilidad se consolida en córdobas con esa tasa histórica, no con una tasa del día. La tasa vigente se configura en **Negocio** y se propone al facturar en dólares y al registrar compras y gastos; el campo sigue siendo editable en cada operación. Vive en `exchange_rates` y no en `business_settings` porque `create_document` congela esa fila entera como emisor del documento.
- **Congelado al vender:** `create_document` deja copiado en cada renglón el costo vigente, la tasa y el impuesto. Un margen de enero no cambia porque en marzo se compre más caro.
- **Nunca se inventa un costo:** una unidad sin costo conocido se muestra como pendiente, jamás como cero. Mientras haya pendientes, la utilidad del período queda en blanco y las cifras conocidas se muestran por separado.
- **Carga inicial:** los 260 perfumes empiezan sin costo. En **Costos y precios → Cargar costos desde lista** se pega la columna de códigos y la de costos desde Excel; cada fila se valida contra el catálogo antes de escribir nada y las que no se pueden registrar se explican una por una. Un producto que ya tiene promedio no se sobrescribe: se actualiza registrando la compra.
- **Qué se obtiene:** utilidad bruta y resultado operativo del período, margen por producto y por lista de precios, ventas por debajo del costo, inventario valorado a costo, rotación anual y días de inventario, gastos por categoría y evolución mes a mes. Todo sale también en el PDF y en el libro de Excel.

Las funciones `record_purchase`, `set_opening_cost`, `record_expense` y `void_expense` exigen rol `admin`, reciben un requestId idempotente y bloquean producto y saldos antes de tocar el promedio. Un movimiento de entrada registrado por la vía genérica de inventario invalida el promedio del producto a propósito: sólo una compra con su costo puede volver a establecerlo.

La vista local (`/demo`) trae un libro contable inventado —costos, compras, gastos y márgenes— para poder recorrer el módulo antes de aplicar la migración. No permite registrar nada.

## Operación y comprobaciones

Las escrituras del negocio pasan por funciones con comprobaciones de rol, validaciones y límites de uso. Las tablas no conceden escritura directa a usuarios del navegador. Las lecturas aplican RLS, y el almacenamiento sigue siendo privado. Deshabilitar una cuenta corta el acceso en la base aunque su token no haya expirado.

`create_document` y `record_inventory_movement` reciben un requestId idempotente. Facturar bloquea y descuenta saldos; proformar no toca inventario. Una factura requiere conteo inicial mediante **Inventario → Ajuste**. Ninguna cantidad se inventó durante la carga.

El historial de documentos permite consultar las últimas 200 facturas o proformas autorizadas y reimprimirlas en carta/PDF; movimientos muestra los últimos 200 registros autorizados. Clientes/proveedores muestran hasta 2,000 registros por pantalla. Para volúmenes mayores, añadir paginación de servidor.

Las pruebas locales incluyen 23 comprobaciones PostgreSQL de permisos, revisiones, persistencia, instantáneas y archivo de productos. En la base real se verificaron escrituras de cliente, proveedor y borrador, lectura de las 256 fotos privadas y aislamiento de solo consulta dentro de una transacción revertida: no quedaron registros de prueba.

El asesor de seguridad informa seis tablas privadas con RLS sin políticas: es intencional, no se consultan directamente desde la API. También advierte sobre diez RPC SECURITY DEFINER accesibles a authenticated —la décima es `set_exchange_rate`—; son las escrituras y consultas autorizadas del programa, con controles internos de rol y search_path vacío. Las cuatro RPC de contabilidad no aparecen en el aviso porque su envoltura pública es SECURITY INVOKER. [Detalle del aviso](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). No se amplió el acceso público para ocultar estas advertencias.

## Configuración local

```env
VITE_SUPABASE_URL=https://xkpujpoocsbkychstrne.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_DATA_MODE=supabase
```

Usar `.env.local`, ignorado por Git. Nunca usar claves secretas o service_role en el navegador. La publicación en HTTPS, el correo SMTP, el conteo físico, las dos fotos faltantes y los datos fiscales definitivos requieren completar la puesta en marcha.
