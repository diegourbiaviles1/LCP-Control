# Catálogo de las listas mayoristas

Importación de 260 referencias únicas presentes en los tres archivos: Lista Mayor EMPRENDEDOR 1.xlsx, Lista Mayor VIP 2.xlsx, Lista Mayor PREMIUM 3.xlsx. No se modificaron los originales ni se incluyeron en Git.

Cada referencia conserva marca, nombre y presentación de origen, fila, precios independientes NIO/USD para Emprendedor, VIP y Premium y enlace a la foto. La clave de unión es marca + nombre + tamaño, no el número de fila. Se verificó igualdad de referencias entre listas y ausencia de duplicados de esa clave.

Hay 258 enlaces a fotos. Sus 256 archivos distintos ya están guardados en Storage privado, reducidos a WebP (7.8 MiB en total), sin sustituirlos por fotos de otras presentaciones. Los enlaces y originales se conservaron. Dos referencias no incluyen foto; se pueden completar desde el editor.

Los códigos LCP son identificadores internos deterministas; no son EAN/UPC del fabricante. manufacturerBarcode queda vacío. La API de UPCitemdb permite buscar productos y devuelve URLs de imágenes, pero requiere validar la coincidencia exacta antes de incorporar un GTIN: https://www.upcitemdb.com/wp/docs/main/development/responses/ . Las variaciones requieren GTIN distintos: https://support.gs1.org/support/solutions/articles/43000734071-how-many-gs1-gtins-do-i-need-for-my-products- .

No hay saldos por Bodega/Tienda ni mínimos. UNDS es un campo vacío para pedidos, y los totales calculados en cero no son inventario. «Agotado» se conserva como nota de la lista, no como saldo cero. No se deduce un tipo de cambio de los precios ni se inventa precio al detalle, impuestos o requisitos para acceder a cada tarifa.

Se conserva oz, sin conversión automática a ml. En la base nueva el género queda por confirmar. Categoría solo se asignó inicialmente a marcas árabes reconocidas y Xerjoff como nicho; el resto queda por confirmar. Estas clasificaciones no constan como columnas de los Excel y son editables. Los sets y sprays conservan su nombre íntegro.

## Tamaños por revisar

- Fila 34: Odyssey Dubai Chocolate, tamaño original '46115'; pendiente de confirmar.
- Fila 178: Be edt men, tamaño original '46115'; pendiente de confirmar.
- Fila 219: One Million Lucky, tamaño original '46115'; pendiente de confirmar.
- Fila 227: Le beau paradise garden 4,2oz/125ml, tamaño original '46057'; pendiente de confirmar.
