# Catálogo de las listas mayoristas

Importación de 260 referencias únicas presentes en los tres archivos: Lista Mayor EMPRENDEDOR 1.xlsx, Lista Mayor VIP 2.xlsx, Lista Mayor PREMIUM 3.xlsx. No se modificaron los originales ni se incluyeron en Git.

Cada referencia conserva marca, nombre y presentación de origen, fila, precios independientes NIO/USD para Emprendedor, VIP y Premium y enlace a la foto. La clave de unión es marca + nombre + tamaño, no el número de fila. Se verificó igualdad de referencias entre listas y ausencia de duplicados de esa clave.

Hay 258 enlaces a fotos. Se presentan desde Google Drive con enlace al original y estado visible si no cargan. No se descargaron ni reemplazaron por fotos de otras presentaciones. 2 referencias no incluyen enlace.

Los códigos LCP son identificadores internos deterministas; no son EAN/UPC del fabricante. manufacturerBarcode queda vacío. La API de UPCitemdb permite buscar productos y devuelve URLs de imágenes, pero requiere validar la coincidencia exacta antes de incorporar un GTIN: https://www.upcitemdb.com/wp/docs/main/development/responses/ . Las variaciones requieren GTIN distintos: https://support.gs1.org/support/solutions/articles/43000734071-how-many-gs1-gtins-do-i-need-for-my-products- .

No hay saldos por Bodega/Tienda ni mínimos. UNDS es un campo vacío para pedidos, y los totales calculados en cero no son inventario. «Agotado» se conserva como nota de la lista, no como saldo cero. No se deduce un tipo de cambio de los precios ni se inventa precio al detalle, impuestos o requisitos para acceder a cada tarifa.

Se conserva oz, sin conversión automática a ml. Género se extrae solo de palabras explícitas del nombre; el resto queda Por confirmar. Categoría es una clasificación inicial por marca para facilitar filtros, revisable por los dueños; no consta como columna de los Excel. Los sets y sprays conservan su nombre íntegro.

## Tamaños por revisar

- Fila 34: Odyssey Dubai Chocolate, tamaño original '46115'; pendiente de confirmar.
- Fila 178: Be edt men, tamaño original '46115'; pendiente de confirmar.
- Fila 219: One Million Lucky, tamaño original '46115'; pendiente de confirmar.
- Fila 227: Le beau paradise garden 4,2oz/125ml, tamaño original '46057'; pendiente de confirmar.
