# Base de datos del negocio

Proyecto activo: **La Casa del Perfume**, `xkpujpoocsbkychstrne`. El proyecto anterior no se modificó. Todas las migraciones hasta `20260914012000_document_customer_details.sql` están aplicadas en este proyecto; las migraciones de endurecimiento toleran que un proyecto nuevo no tenga la función histórica `rls_auto_enable`.

## Datos cargados y trazabilidad

- 260 productos, 38 marcas, 3 listas y 1,560 precios independientes NIO/USD. La comparación con los valores originales dio cero diferencias.
- 780 filas de origen, sus tres archivos, hojas y hashes SHA-256 en `private.import_sources/import_rows`. La identidad de unión es marca + nombre + presentación.
- 520 saldos por Bodega/Tienda sin contar (`NULL`); no se deducen existencias de las listas de precios.
- 256 fotos WebP privadas, 8,212,792 bytes en total, asociadas a 258 productos. Los originales ocupaban 102,641,788 bytes y se conservaron localmente. Se limitó el lado mayor a 1,000 píxeles sin ampliar, calidad 80.
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
| Acceso             | Supabase Auth guarda las credenciales. `staff_members` es la única fuente de permisos. `private.pending_staff` reserva correos y roles antes de activar cuentas.     |

La demostración de desarrollo conserva sus datos sintéticos y borradores/proveedores locales. Preferencias de interfaz y rotación de frases siguen en el navegador; no son registros del negocio.

## Permisos y activación

| Rol           | Acceso                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SuperAdmin    | Administración completa y gestión de otros SuperAdmin.                                                                                                 |
| Administrador | Catálogo, imágenes, clientes, proveedores, documentos, inventario, negocio y personal; no puede conceder ni modificar SuperAdmin.                      |
| Ventas        | Catálogo, existencias, clientes, facturación/proformas, salidas y daños. Solo ve sus documentos y movimientos; no cambia tarifas asignadas a clientes. |
| Inventario    | Catálogo, existencias, proveedores en consulta, entradas, salidas, daños y ajustes; solo ve sus movimientos. Sin clientes ni documentos comerciales.   |
| Solo consulta | Catálogo, fotos y existencias; sin escrituras comerciales.                                                                                             |

Los tres correos indicados por el usuario se autorizaron directamente en el proyecto, sin incluirlos en migraciones públicas. El correo de la empresa tiene SuperAdmin pendiente; los dos desarrolladores, Administrador pendiente. No se asignaron contraseñas compartidas ni se enviaron invitaciones.

1. Un administrador autoriza un correo y su rol en **Usuarios**.
2. La persona abre `/activate`, elige su propia contraseña y confirma su correo.
3. El disparador de Auth crea la fila en `staff_members` y consume la autorización pendiente. Un correo no autorizado no puede registrarse.
4. Para retirar acceso, deshabilitarlo desde Usuarios. Se conserva el historial. No se permite quitarse los propios permisos ni eliminar al último SuperAdmin activo.

**Pendiente de puesta en marcha:** el proyecto usa el SMTP de prueba de Supabase. Solo permite confirmaciones a miembros del equipo de Supabase, no a cualquier correo autorizado dentro de la aplicación. Para usuarios ajenos al equipo, configurar un proveedor SMTP en Authentication → Emails → SMTP Settings. No desactivar la confirmación de correo ni dar acceso al panel administrativo a empleados para sortear este límite. [Documentación oficial de SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

Site URL ya apunta a `http://127.0.0.1:5173/login`, el programa local, para regresar después de confirmar el correo. Actualizarla al dominio HTTPS definitivo antes de distribuir la aplicación. No se ha probado aún el inicio de sesión de una cuenta personal activada.

## Operación y comprobaciones

Las escrituras del negocio pasan por funciones con comprobaciones de rol, validaciones y límites de uso. Las tablas no conceden escritura directa a usuarios del navegador. Las lecturas aplican RLS, y el almacenamiento sigue siendo privado. Deshabilitar una cuenta corta el acceso en la base aunque su token no haya expirado.

`create_document` y `record_inventory_movement` reciben un requestId idempotente. Facturar bloquea y descuenta saldos; proformar no toca inventario. Una factura requiere conteo inicial mediante **Inventario → Ajuste**. Ninguna cantidad se inventó durante la carga.

El historial de documentos permite consultar las últimas 200 facturas o proformas autorizadas y reimprimirlas en carta/PDF; movimientos muestra los últimos 200 registros autorizados. Clientes/proveedores muestran hasta 2,000 registros por pantalla. Para volúmenes mayores, añadir paginación de servidor.

Las pruebas locales incluyen 23 comprobaciones PostgreSQL de permisos, revisiones, persistencia, instantáneas y archivo de productos. En la base real se verificaron escrituras de cliente, proveedor y borrador, lectura de las 256 fotos privadas y aislamiento de solo consulta dentro de una transacción revertida: no quedaron registros de prueba.

El asesor de seguridad informa seis tablas privadas con RLS sin políticas: es intencional, no se consultan directamente desde la API. También advierte sobre nueve RPC SECURITY DEFINER accesibles a authenticated; son las escrituras y consultas autorizadas del programa, con controles internos de rol y search_path vacío. [Detalle del aviso](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). No se amplió el acceso público para ocultar estas advertencias.

## Configuración local

```env
VITE_SUPABASE_URL=https://xkpujpoocsbkychstrne.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_DATA_MODE=supabase
```

Usar `.env.local`, ignorado por Git. Nunca usar claves secretas o service_role en el navegador. La publicación en HTTPS, el correo SMTP, el conteo físico, las dos fotos faltantes y los datos fiscales definitivos requieren completar la puesta en marcha.
