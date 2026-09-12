import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ScanLine, ArrowLeft, ArrowRight } from 'lucide-react'
import {
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Select,
} from '../../components/ui'
import { PriceControls } from '../../components/PriceControls'
import { ProductImage } from '../../components/ProductImage'
import { ProductBarcode } from '../../components/ProductBarcode'
import { inventoryService } from '../../services'
import { useQuery } from '../../lib/useQuery'
import {
  labels,
  type Product,
  type Currency,
  type PriceTier,
  type Category,
  type Gender,
} from '../../lib/domain'
import { formatCurrency } from '../../lib/format'
import { productPrice } from '../../lib/pricing'
import {
  emptyFilters,
  filterInventory,
  totalStock,
  type InventoryFilters,
  type StockFilter,
} from './model'
import { ProductCard, ProductIdentity, StockBadge } from './ProductCard'
import { useAccess } from '../../app/AccessContext'
import { MovementDrafts } from './MovementDrafts'
export function InventoryPage({ catalog = false }: { catalog?: boolean }) {
  const { data, loading, error, retry } = useQuery(
    inventoryService.getInventory,
  )
  const [filters, setFilters] = useState<InventoryFilters>(emptyFilters)
  const [currency, setCurrency] = useState<Currency>('NIO')
  const [tier, setTier] = useState<PriceTier>('emprendedor')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Product | null>(null)
  const { base } = useAccess()
  const items = filterInventory(data ?? [], filters)
  const perPage = 24
  const pages = Math.max(1, Math.ceil(items.length / perPage))
  const currentPage = Math.min(page, pages)
  const shown = items.slice((currentPage - 1) * perPage, currentPage * perPage)
  function change(next: Partial<InventoryFilters>) {
    setFilters({ ...filters, ...next })
    setPage(1)
  }
  const brands = [...new Set(data?.map((item) => item.product.brand))].sort(
    (a, b) => a.localeCompare(b, 'es'),
  )
  const sizes = [
    ...new Set(
      data?.map(({ product: p }) =>
        p.size === null ? 'unknown' : `${p.size} ${p.unit}`,
      ),
    ),
  ].sort(
    (a, b) =>
      (a === 'unknown' ? Infinity : parseFloat(a)) -
      (b === 'unknown' ? Infinity : parseFloat(b)),
  )
  function price(product: Product) {
    const value = productPrice(product, tier, currency)
    return value === null ? 'Precio pendiente' : formatCurrency(value, currency)
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{catalog ? 'Catálogo' : 'Inventario'}</h1>
          <p className="muted">
            {catalog
              ? 'Perfumes, presentaciones y listas de mayor.'
              : 'Existencias por ubicación y movimientos pendientes.'}
          </p>
        </div>
        <Link className="button button-primary" to={`${base}/scanner`}>
          <ScanLine size={18} />
          Escanear producto
        </Link>
      </div>
      {!catalog && <MovementDrafts items={data ?? []} />}
      <Card>
        <div className="inventory-toolbar">
          <div className="catalog-toolbar-heading">
            <h2>{data?.length ?? '—'} referencias</h2>
            <PriceControls
              currency={currency}
              tier={tier}
              onCurrency={setCurrency}
              onTier={setTier}
            />
          </div>
          <div className="filter-grid">
            <Input
              label="Buscar producto"
              type="search"
              placeholder="Nombre, marca o código…"
              value={filters.search}
              onChange={(e) => change({ search: e.target.value })}
            />
            <Select
              label="Categoría"
              value={filters.category}
              onChange={(e) =>
                change({ category: e.target.value as Category | '' })
              }
            >
              <option value="">Todas</option>
              {Object.entries(labels.category).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              label="Marca"
              value={filters.brand}
              onChange={(e) => change({ brand: e.target.value })}
            >
              <option value="">Todas las marcas</option>
              {brands.map((brand) => (
                <option key={brand}>{brand}</option>
              ))}
            </Select>
            <Select
              label="Género"
              value={filters.gender}
              onChange={(e) =>
                change({ gender: e.target.value as Gender | '' })
              }
            >
              <option value="">Todos</option>
              {Object.entries(labels.gender).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              label="Tamaño"
              value={filters.size}
              onChange={(e) => change({ size: e.target.value })}
            >
              <option value="">Todos</option>
              {sizes.map((size) => (
                <option value={size} key={size}>
                  {size === 'unknown' ? 'Por confirmar' : size}
                </option>
              ))}
            </Select>
            {!catalog && (
              <Select
                label="Existencias"
                value={filters.stock}
                onChange={(e) =>
                  change({ stock: e.target.value as StockFilter })
                }
              >
                <option value="">Todas</option>
                <option value="unknown">Sin conteo</option>
                <option value="available">Con existencias</option>
                <option value="low">Bajo el mínimo</option>
                <option value="out">Sin existencias</option>
              </Select>
            )}
          </div>
          <div className="filter-note">
            <span>
              {catalog
                ? 'Precios de las listas recibidas. Géneros y tamaños pendientes se indican en cada ficha.'
                : '— indica que el conteo aún no está registrado. «Agotado en lista» no equivale a un conteo de inventario.'}
            </span>
            <Button
              variant="ghost"
              onClick={() => {
                setFilters(emptyFilters)
                setPage(1)
              }}
            >
              Limpiar filtros
            </Button>
          </div>
        </div>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} retry={retry} />
        ) : !items.length ? (
          <EmptyState />
        ) : catalog ? (
          <div className="catalog-grid">
            {shown.map(({ product: p }) => (
              <article className="catalog-product" key={p.id}>
                <button
                  className="product-photo-button"
                  onClick={() => setSelected(p)}
                  aria-label={`Ver ${p.name}`}
                >
                  <ProductImage product={p} large />
                </button>
                <div className="catalog-product-body">
                  <span className="product-brand">{p.brand}</span>
                  <button
                    className="product-title"
                    onClick={() => setSelected(p)}
                  >
                    {p.name}
                  </button>
                  <p>
                    {p.size === null
                      ? 'Tamaño por confirmar'
                      : `${p.size} ${p.unit}`}{' '}
                    · {labels.category[p.category]}
                  </p>
                  <strong className="catalog-price">{price(p)}</strong>
                  <small>{p.availabilityNote}</small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <>
            <div className="inventory-table">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Bodega</th>
                    <th>Tienda</th>
                    <th>Total</th>
                    <th>Precio</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((item) => (
                    <tr key={item.product.id}>
                      <td>
                        <button
                          className="identity-button"
                          onClick={() => setSelected(item.product)}
                        >
                          <ProductIdentity item={item} />
                        </button>
                        <span className="barcode-label">
                          Interno: {item.product.barcode}
                        </span>
                      </td>
                      <td>{item.quantities.warehouse ?? '—'}</td>
                      <td>{item.quantities.store ?? '—'}</td>
                      <td>{totalStock(item) ?? '—'}</td>
                      <td>{price(item.product)}</td>
                      <td>
                        <StockBadge item={item} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="inventory-cards">
              {shown.map((item) => (
                <div key={item.product.id}>
                  <ProductCard item={item} currency={currency} tier={tier} />
                  <Button
                    variant="ghost"
                    onClick={() => setSelected(item.product)}
                  >
                    Ver ficha y código
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="table-footer">
          <span>
            {items.length} de {data?.length ?? 0} productos
          </span>
          <div className="pagination">
            <Button
              variant="ghost"
              aria-label="Página anterior"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ArrowLeft size={16} />
            </Button>
            <span>
              {currentPage} / {pages}
            </span>
            <Button
              variant="ghost"
              aria-label="Página siguiente"
              disabled={currentPage === pages}
              onClick={() => setPage(currentPage + 1)}
            >
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </Card>
      {selected && (
        <Dialog open title={selected.name} onClose={() => setSelected(null)}>
          <div className="product-detail">
            <ProductImage key={selected.id} product={selected} large />
            <div>
              <p>{selected.brand}</p>
              <h3>{price(selected)}</h3>
              <p>
                {selected.size === null
                  ? 'Tamaño por confirmar'
                  : `${selected.size} ${selected.unit}`}{' '}
                · {labels.gender[selected.gender]}
              </p>
              <p>
                {labels.category[selected.category]} ·{' '}
                {selected.availabilityNote}
              </p>
              {selected.imageSource && (
                <a
                  className="text-link"
                  href={selected.imageSource}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir foto original
                </a>
              )}
              <p className="workspace-disclaimer">
                Código de fabricante:{' '}
                {selected.manufacturerBarcode ?? 'pendiente de registrar'}
              </p>
            </div>
          </div>
          <ProductBarcode code={selected.barcode} />
        </Dialog>
      )}
    </>
  )
}
