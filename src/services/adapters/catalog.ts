import type { Category, Gender, InventoryItem, Product } from '../../lib/domain'
import type { DataProvider } from '../contracts'
import { localWrites } from './local'
import {
  previousRange,
  type ReportRange,
  type ReportSource,
} from '../../features/reports/model'
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
/**
 * Existencias de muestra. La vista local las trae contadas para que el inicio,
 * el inventario y los reportes cuenten la misma historia: sin conteo no hay
 * inventario valorado, ni rotación, ni facturación que probar.
 */
const items: InventoryItem[] = catalogProducts.map((product, index) => ({
  product,
  quantities: { warehouse: 4 + ((index * 5) % 23), store: 3 + (index % 7) },
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
  async getReportSource(range: ReportRange): Promise<ReportSource> {
    // La importación es diferida: las ventas de muestra no viajan en el paquete
    // principal, sólo se generan si alguien abre los reportes locales.
    const { syntheticSales } = await import('./catalogSales')
    const sales = syntheticSales()
    const window = { from: previousRange(range).from, to: range.to }
    const inRange = (value: string) => {
      const day = value.slice(0, 10)
      return day >= window.from && day <= window.to
    }
    const documents = sales.documents.filter((document) =>
      inRange(document.createdAt),
    )
    const visible = new Set(documents.map((document) => document.id))
    return {
      documents,
      customers: sales.customers,
      movements: sales.movements.filter((movement) =>
        inRange(movement.createdAt),
      ),
      inventory: structuredClone(items),
      window,
      truncated: false,
      // Igual que la consulta real: sólo el tramo pedido, y los costos de venta
      // sólo de las facturas que viajan con él.
      accounting: {
        ...sales.accounting,
        purchases: sales.accounting.purchases.filter((row) =>
          inRange(row.incurredOn),
        ),
        expenses: sales.accounting.expenses.filter((row) =>
          inRange(row.incurredOn),
        ),
        saleCosts: sales.accounting.saleCosts.filter((row) =>
          visible.has(row.documentId),
        ),
        movementCosts: sales.accounting.movementCosts?.filter((row) =>
          inRange(row.createdAt),
        ),
      },
    }
  },
  async getTodaySummary() {
    return { count: 0, totals: { NIO: 0, USD: 0 } }
  },
  ...localWrites,
  async listProducts() {
    return structuredClone(catalogProducts)
  },
}
