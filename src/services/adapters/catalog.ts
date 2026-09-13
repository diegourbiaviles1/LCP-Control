import type {
  Category,
  Gender,
  InventoryItem,
  Product,
} from '../../lib/domain'
import type { DataProvider } from '../contracts'
import { localWrites } from './local'
// Catálogo sintético de la vista local y de las pruebas: marcas, nombres, códigos
// y precios inventados. Las listas reales viven sólo en Supabase, detrás de RLS;
// nunca se empaquetan para el navegador ni se versionan.
const brands: [string, Category][] = [
  ['Aurora Norte', 'arabian'],
  ['Brisa Serena', 'designer'],
  ['Casa Ámbar', 'arabian'],
  ['Estudio Nácar', 'designer'],
  ['Taller Índigo', 'niche'],
  ['Marca sin clasificar', 'unspecified'],
]
const lines: [string, Gender, number | null][] = [
  ['Cedro', 'male', 3.4],
  ['Jazmín', 'female', 3.4],
  ['Vainilla', 'unisex', 2.7],
  ['Cítrico', 'unspecified', 1],
  ['Nocturno', 'male', null],
]
export const catalogProducts: Product[] = brands.flatMap(
  ([brand, category], brandIndex) =>
    lines.map(([line, gender, size], lineIndex) => {
      const number = brandIndex * lines.length + lineIndex + 1
      const code = `DEMO-${String(number).padStart(4, '0')}`
      const nio = 975 + number * 25
      const usd = 24 + number
      return {
        id: code.toLowerCase(),
        barcode: code,
        barcodeKind: 'internal',
        manufacturerBarcode: null,
        name: `${line} ${String(number).padStart(2, '0')}`,
        brand,
        category,
        gender,
        size,
        unit: 'oz',
        price: nio,
        currency: 'NIO',
        prices: {
          emprendedor: { NIO: nio, USD: usd },
          vip: { NIO: nio - 50, USD: usd - 1 },
          premium: { NIO: nio - 100, USD: usd - 3 },
        },
        minimumStock: null,
        active: true,
        availabilityNote: size === null ? 'Agotado en lista' : 'Por confirmar',
        // Un data: URL que el navegador no puede decodificar muestra «Foto no
        // disponible» sin salir a la red; el resto queda en «Foto pendiente».
        imageUrl: brandIndex % 2 === 0 ? 'data:,sin-foto' : null,
        imageSource: null,
      } satisfies Product
    }),
)
const items: InventoryItem[] = catalogProducts.map((product) => ({
  product,
  quantities: { warehouse: null, store: null },
}))
export const catalogAdapter: DataProvider = {
  mode: 'demo',
  async getInventory() {
    return structuredClone(items)
  },
  async findByBarcode(code) {
    return structuredClone(
      catalogProducts.find(
        (product) =>
          product.barcode === code || product.manufacturerBarcode === code,
      ) ?? null,
    )
  },
  async getTodaySummary() {
    return { count: 0, totals: { NIO: 0, USD: 0 } }
  },
  ...localWrites,
}
