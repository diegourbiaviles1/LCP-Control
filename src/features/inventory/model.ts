import type {
  InventoryItem,
  Category,
  Gender,
  InventoryLocation,
} from '../../lib/domain'
export type StockFilter = '' | 'low' | 'out' | 'available'
export interface InventoryFilters {
  search: string
  category: Category | ''
  gender: Gender | ''
  location: InventoryLocation | ''
  stock: StockFilter
}
export const emptyFilters: InventoryFilters = {
  search: '',
  category: '',
  gender: '',
  location: '',
  stock: '',
}
export function totalStock(item: InventoryItem) {
  return item.quantities.store + item.quantities.warehouse
}
export function stockStatus(item: InventoryItem) {
  const total = totalStock(item)
  return total === 0
    ? 'out'
    : total < item.product.minimumStock
      ? 'low'
      : 'available'
}
export function filterInventory(
  items: InventoryItem[],
  filters: InventoryFilters,
) {
  const query = filters.search.toLocaleLowerCase('es').trim()
  return items.filter((item) => {
    const product = item.product
    const quantity = filters.location
      ? item.quantities[filters.location]
      : totalStock(item)
    return (
      `${product.name} ${product.brand} ${product.barcode}`
        .toLocaleLowerCase('es')
        .includes(query) &&
      (!filters.category || product.category === filters.category) &&
      (!filters.gender || product.gender === filters.gender) &&
      (filters.stock !== 'out' || quantity === 0) &&
      (filters.stock !== 'low' || quantity < product.minimumStock) &&
      (filters.stock !== 'available' || quantity > 0)
    )
  })
}
