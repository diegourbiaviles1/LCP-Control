import { can } from '../../lib/permissions'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAccess } from '../../app/AccessContext'
import {
  Card,
  ErrorState,
  Input,
  LoadingState,
  Select,
} from '../../components/ui'
import { ProductImage } from '../../components/ProductImage'
import { useServices } from '../../services/useServices'
import { useQuery } from '../../lib/useQuery'
export function ProductManagementPage() {
  const { role, demo } = useAccess()
  if (!can(role, 'product.manage') && !demo)
    return (
      <ErrorState message="Solo los administradores pueden editar el catálogo." />
    )
  return <ProductList />
}
function ProductList() {
  const { base } = useAccess()
  const { state } = useLocation()
  const { productService } = useServices()
  const { data, loading, error, retry } = useQuery(productService.listProducts)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const products = (data ?? []).filter(
    (p) =>
      `${p.name} ${p.brand} ${p.barcode}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()) &&
      (status === 'all' || p.active === (status === 'active')),
  )
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Administrar perfumes</h1>
          <p className="muted">Altas, fotos, precios y productos retirados.</p>
        </div>
        <Link className="button button-primary" to={`${base}/products/new`}>
          Nuevo perfume
        </Link>
      </div>
      {state?.message && (
        <p role="status" className="page-feedback">
          {state.message}
        </p>
      )}
      <Card className="form-card">
        <div className="form-grid">
          <Input
            label="Buscar perfume"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            label="Mostrar"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="all">Todos</option>
          </Select>
        </div>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} retry={retry} />
        ) : (
          <div className="product-management-list">
            {products.map((product) => (
              <div className="managed-product" key={product.id}>
                <ProductImage product={product} />
                <div>
                  <strong>
                    {product.brand} · {product.name}
                  </strong>
                  <small>
                    {product.barcode} · {product.active ? 'Activo' : 'Inactivo'}
                  </small>
                </div>
                <Link
                  className="button button-secondary"
                  to={`${base}/products/${product.id}/edit`}
                >
                  Editar
                </Link>
              </div>
            ))}
            {!products.length && <p>No hay perfumes con estos filtros.</p>}
          </div>
        )}
      </Card>
    </>
  )
}
