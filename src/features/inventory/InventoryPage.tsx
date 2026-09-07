import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ScanLine, SlidersHorizontal, ArrowUpRight } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Select,
} from '../../components/ui'
import { inventoryService } from '../../services'
import { useQuery } from '../../lib/useQuery'
import { labels } from '../../lib/domain'
import type { Category, Gender, InventoryLocation } from '../../lib/domain'
import { formatCurrency } from '../../lib/format'
import {
  emptyFilters,
  filterInventory,
  totalStock,
  type InventoryFilters,
  type StockFilter,
} from './model'
import { ProductCard, ProductIdentity, StockBadge } from './ProductCard'
import { useAccess } from '../../app/AccessContext'
export function InventoryPage({ catalog = false }: { catalog?: boolean }) {
  const { data, loading, error, retry } = useQuery(
    inventoryService.getInventory,
  )
  const [filters, setFilters] = useState<InventoryFilters>(emptyFilters)
  const { base } = useAccess()
  const items = filterInventory(data ?? [], filters)
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {catalog ? 'TU CATÁLOGO' : 'CONTROL DE EXISTENCIAS'}
          </span>
          <h1>{catalog ? 'Productos' : 'Inventario'}</h1>
          <p className="muted">
            {catalog
              ? 'La información esencial de cada producto, en un solo lugar.'
              : 'Cada producto, cada ubicación. Todo bajo control.'}
          </p>
        </div>
        <Link className="button button-primary" to={`${base}/scanner`}>
          <ScanLine size={18} />
          Escanear producto
        </Link>
      </div>
      {catalog && (
        <div className="page-feedback">
          Catálogo de consulta. El alta y la edición se habilitarán con permisos
          y validación en el backend.
        </div>
      )}
      <Card>
        <div className="inventory-toolbar">
          <div className="section-heading">
            <h2>
              {catalog ? 'Catálogo de productos' : 'Todos los productos'}{' '}
              <Badge>{data?.length ?? '—'}</Badge>
            </h2>
            <SlidersHorizontal size={18} />
          </div>
          <div className="filter-grid">
            <Input
              label="Buscar producto"
              placeholder="Nombre, marca o código…"
              type="search"
              value={filters.search}
              onChange={(event) =>
                setFilters({ ...filters, search: event.target.value })
              }
            />
            <Select
              label="Categoría"
              value={filters.category}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  category: event.target.value as Category | '',
                })
              }
            >
              <option value="">Todas</option>
              {Object.entries(labels.category).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </Select>
            <Select
              label="Género"
              value={filters.gender}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  gender: event.target.value as Gender | '',
                })
              }
            >
              <option value="">Todos</option>
              {Object.entries(labels.gender).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </Select>
            <Select
              label="Ubicación"
              value={filters.location}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  location: event.target.value as InventoryLocation | '',
                })
              }
            >
              <option value="">Todas</option>
              {Object.entries(labels.location).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </Select>
            <Select
              label="Existencias"
              value={filters.stock}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  stock: event.target.value as StockFilter,
                })
              }
            >
              <option value="">Todas</option>
              <option value="available">Con existencias</option>
              <option value="low">Bajo el mínimo</option>
              <option value="out">Sin existencias</option>
            </Select>
          </div>
          <div className="filter-note">
            <span>
              {filters.location
                ? `Cantidades filtradas por ${labels.location[filters.location]}. Mínimo de referencia global por producto.`
                : 'El stock mínimo se evalúa sobre el total de Bodega + Tienda.'}
            </span>
            <Button variant="ghost" onClick={() => setFilters(emptyFilters)}>
              Limpiar filtros
            </Button>
          </div>
        </div>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} retry={retry} />
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="inventory-table">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Bodega</th>
                    <th>Tienda</th>
                    <th>Total</th>
                    <th>Precio</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.product.id}>
                      <td>
                        <ProductIdentity item={item} />
                        <span className="barcode-label">
                          {item.product.barcode}
                        </span>
                      </td>
                      <td>
                        {labels.category[item.product.category]}
                        <small className="table-secondary">
                          {labels.gender[item.product.gender]}
                        </small>
                      </td>
                      <td>{item.quantities.warehouse}</td>
                      <td>{item.quantities.store}</td>
                      <td>
                        <strong>{totalStock(item)}</strong>
                      </td>
                      <td className="price-cell">
                        {formatCurrency(
                          item.product.price,
                          item.product.currency,
                        )}
                      </td>
                      <td>
                        <StockBadge item={item} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="inventory-cards">
              {items.map((item) => (
                <ProductCard key={item.product.id} item={item} />
              ))}
            </div>
            <div className="table-footer">
              <span>
                {items.length} de {data?.length} productos
              </span>
              <Link to={`${base}/alerts`}>
                Revisar alertas <ArrowUpRight size={14} />
              </Link>
            </div>
          </>
        )}
      </Card>
    </>
  )
}
