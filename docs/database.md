# Base de datos del negocio

Proyecto Supabase `LCP-Control` (`vqicpwbwuatlyfdzpfne`, región `us-east-2`, PostgreSQL 17). El esquema completo está versionado en [`supabase/migrations`](../supabase/migrations); ese directorio es la fuente de verdad y reproduce la base desde cero.

## Qué guarda

| Tabla                 | Contenido                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `business_settings`   | Nombre, dirección y teléfono del negocio. Una sola fila; se copia dentro de cada documento emitido.                                                           |
| `brands`              | 38 marcas del catálogo.                                                                                                                                       |
| `products`            | 260 referencias: SKU interno `LCP-…`, nombre, marca, presentación, categoría, género, foto y mínimo de inventario.                                            |
| `price_tiers`         | Emprendedor, VIP y Premium.                                                                                                                                   |
| `product_prices`      | 1 560 precios: cada producto × cada lista × cada moneda (NIO y USD), tomados de los tres Excel. Ningún importe se deriva de otro ni se aplica tipo de cambio. |
| `inventory_balances`  | Saldo por producto y ubicación (Bodega / Tienda). `NULL` significa «nunca contado», que no es lo mismo que cero.                                              |
| `inventory_movements` | Bitácora de entradas, salidas, daños, ajustes y ventas, con saldo antes y después y el usuario responsable.                                                   |
| `customers`           | Clientes con teléfono único y la lista de precios que les corresponde.                                                                                        |
| `documents`           | Facturas y proformas emitidas, con su número, cliente, lista, moneda, total y notas.                                                                          |
| `document_items`      | Renglones de cada documento, con la descripción congelada al momento de emitir.                                                                               |
| `staff_members`       | Cuentas del personal y su rol (`admin` / `operator`).                                                                                                         |

El esquema `private` guarda los contadores de numeración y la trazabilidad de la importación de los Excel. No está expuesto por la API.

## Facturas y proformas

Ambas viven en `documents` y se distinguen por la columna `kind`:

- `invoice` — numeración `FAC-000001`, exige ubicación y forma de pago, descuenta existencias y deja un movimiento `SALE` por renglón.
- `proforma` — numeración `PRO-000001`, exige fecha de vigencia, no toca el inventario y no registra pago.

Una restricción de la tabla impide mezclarlos: una factura no puede llevar vigencia y una proforma no puede llevar ubicación ni forma de pago. La aplicación tampoco los mezcla: son dos pantallas con almacenamientos de borradores distintos.

## Cómo se escribe

Las tablas sólo conceden `select` a usuarios autenticados, y sus políticas exigen una fila activa en `staff_members`. Toda escritura pasa por dos funciones:

- `create_document(p_payload jsonb)` — valida tipo, lista, moneda, cantidades y existencias; bloquea las filas en un orden fijo para que dos ventas simultáneas no vendan de más; y devuelve el documento con sus renglones.
- `record_inventory_movement(p_payload jsonb)` — registra entrada, salida, daño o ajuste, y actualiza el saldo. Sólo un `admin` puede registrar entradas y ajustes.

Ambas reciben un `requestId` y son idempotentes: repetir la misma llamada devuelve el documento o movimiento ya creado en vez de duplicarlo. Si los datos cambiaron, fallan en lugar de sobrescribir.

## Dar de alta al personal

El rol vive en un solo lugar: la tabla `staff_members`. Tanto la aplicación como las políticas de PostgreSQL lo leen de ahí, así que dar de alta a alguien es un solo paso y no hay nada que sincronizar a mano. El rol que venga en el token se ignora.

Por cada dueño o empleado:

1. En el panel de Supabase, **Authentication → Users → Add user → Create new user**, con su correo y contraseña. Marcar **Auto Confirm User** para que pueda entrar sin confirmar por correo.
2. Copiar el `User UID` que aparece en la lista y ejecutar en el **SQL Editor**:

```sql
insert into public.staff_members (user_id, display_name, role)
values ('UUID-DEL-USUARIO', 'Nombre visible', 'admin');
```

Los dueños usan `admin`; los empleados, `operator`. Un `operator` puede facturar, cotizar, registrar salidas y daños; no puede registrar entradas ni ajustes de inventario, ni cambiar la lista de precios asignada a un cliente.

Sin fila en `staff_members`, la cuenta inicia sesión pero la aplicación le muestra que su acceso no está habilitado, y la base no le entrega ningún dato.

Para retirar el acceso de alguien sin borrar su historial:

```sql
update public.staff_members set active = false where user_id = 'UUID-DEL-USUARIO';
```

Las facturas y movimientos que registró siguen apuntando a su cuenta; sólo deja de entrar.

## Códigos internos

`products.sku` es el código interno que se imprime en la etiqueta y reconoce el escáner. `products.barcode` queda reservado para el EAN/UPC del fabricante, que también permite buscar el producto cuando se registra. La vista local `/demo` trabaja con 30 productos inventados y códigos `DEMO-0001` a `DEMO-0030`; no se usan para operar en la base.

`products.image_reference` guarda el enlace de Google Drive tal como venía en el Excel; la aplicación extrae de ahí el identificador para mostrar la miniatura.

## Conteo inicial de inventario

Los 520 saldos están en `NULL` porque los Excel no traen existencias. Una factura no se puede emitir contra un producto sin conteo: primero hay que registrar un **Ajuste** desde Inventario, que fija la cantidad real de esa ubicación.

## Conectar la aplicación

En `.env.local` (ignorado por Git):

```env
VITE_SUPABASE_URL=https://vqicpwbwuatlyfdzpfne.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_DATA_MODE=supabase
```

La clave publicable está en **Project Settings → API Keys**. Nunca usar `service_role` ni claves secretas en el navegador. La ruta `/demo` usa únicamente datos sintéticos y existe solo en desarrollo. Las rutas privadas requieren `VITE_DATA_MODE=supabase` y la configuración correspondiente; sin ella no acceden a datos reales ni sirven un catálogo de reemplazo.
