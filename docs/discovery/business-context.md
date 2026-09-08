# Descubrimiento del negocio

Observaciones preliminares realizadas el 7 de septiembre de 2026. Este documento registra contexto para diseñar el dominio; no define todavía el esquema de PostgreSQL ni autoriza una importación.

## Fuentes revisadas

- [Instagram de La Casa del Perfume](https://www.instagram.com/lacasadelperfume.nic/)
- [Catálogo diciembre 2025](https://heyzine.com/flip-book/571df545a4.html)

## Identidad visual

La marca usa vino profundo, dorado cálido, crema y blanco. La aplicación adopta el vino para acciones principales y estados activos, y el dorado como acento. Las pantallas operativas conservan fondos claros y evitan la decoración estacional del catálogo.

## Información observada en el catálogo

Las fichas visibles incluyen, según el producto:

- nombre comercial;
- concentración o tipo, como Eau de Parfum o Eau de Toilette;
- público o género;
- volumen en mililitros;
- precio expresado en NIO y USD;
- imagen;
- agrupación por perfume árabe o de diseñador y por género;
- disponibilidad comercial, incluyendo productos marcados como agotados;
- comparaciones de fragancias o referencias de tipo dupe/clone.

El perfil y el catálogo anuncian ventas al detalle y al por mayor. Esto indica una posible necesidad de listas o niveles de precios, pero el material revisado no demuestra cómo se calcula el precio mayorista.

## Uso como fuente de dominio

El catálogo puede orientar los atributos y ayudar a preparar productos reales. No debe considerarse una fuente de existencias, movimientos, costos o ventas. “Agotado” es una presentación comercial y debe reconciliarse contra el registro operativo.

Los importes NIO y USD parecen corresponder al mismo producto, pero no se asumirá una tasa de cambio ni se derivará un importe del otro. Antes de persistirlos se confirmará si ambos precios son valores administrados independientemente.

Las imágenes, nombres y marcas reales no se copiarán a datos seed. Una futura carga del catálogo será un proceso explícito, revisado y separado de los datos genéricos de demostración.

## Usuarios y roles

Los dos dueños actuales pueden tener cuentas individuales con rol `admin`. Los futuros empleados pueden comenzar con rol `operator`. Los roles representan capacidades, no cantidad de personas. No se añadirá un rol `owner` hasta identificar una operación que deba pertenecer exclusivamente a los propietarios.

Cada operación futura conservará el usuario responsable aunque varias personas compartan el mismo rol.

## Preguntas para los dueños

1. ¿El precio en NIO y el precio en USD se configuran por separado?
2. ¿Existe un precio mayorista distinto? ¿Depende de cantidad, cliente o producto?
3. ¿Un perfume puede venderse en varias concentraciones o tamaños con códigos diferentes?
4. ¿Los productos ya tienen código de barras del fabricante o usan un código interno?
5. ¿“Agotado” proviene del inventario o se actualiza manualmente en el catálogo?
6. ¿Las comparaciones de fragancias deben buscarse dentro del sistema o son solo contenido publicitario?
7. ¿Las imágenes del catálogo serán reutilizadas en la aplicación?
8. ¿Qué operaciones podrá realizar un futuro operador sin autorización adicional?

Estas respuestas, junto con el Excel operativo, deben preceder al diseño definitivo de productos, variantes, precios e inventario.
