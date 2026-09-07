import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  Package,
  ScanLine,
  ShoppingBag,
  TriangleAlert,
  Warehouse,
  Store,
} from 'lucide-react'
import { Card, EmptyState, ErrorState, LoadingState } from '../../components/ui'
import { inventoryService, salesService } from '../../services'
import { useQuery } from '../../lib/useQuery'
import { formatCurrency, formatDate } from '../../lib/format'
import { totalStock } from '../inventory/model'
import { ProductIdentity, StockBadge } from '../inventory/ProductCard'
import { useAccess } from '../../app/AccessContext'
import { can } from '../../lib/permissions'
async function loadDashboard() {
  const [items, sales] = await Promise.all([
    inventoryService.getInventory(),
    salesService.getTodaySummary(),
  ])
  return { items, sales }
}
export function DashboardPage() {
  const { data, loading, error, retry } = useQuery(loadDashboard)
  const { base, role } = useAccess()
  if (loading) return <LoadingState />
  if (error || !data)
    return (
      <ErrorState
        message={error ?? 'No hay datos disponibles.'}
        retry={retry}
      />
    )
  const low = data.items.filter(
    (item) => totalStock(item) < item.product.minimumStock,
  )
  const warehouse = data.items.reduce(
    (sum, item) => sum + item.quantities.warehouse,
    0,
  )
  const store = data.items.reduce((sum, item) => sum + item.quantities.store, 0)
  const stats = [
    {
      title: 'Productos en catálogo',
      value: data.items.length,
      detail: 'Productos activos',
      icon: Package,
    },
    {
      title: 'Unidades disponibles',
      value: warehouse + store,
      detail: 'En bodega y tienda',
      icon: Box,
    },
    {
      title: 'Productos con stock bajo',
      value: low.length,
      detail: 'Requieren tu atención',
      icon: TriangleAlert,
      warning: true,
    },
    {
      title: 'Ventas del día',
      value: data.sales.count,
      detail: 'Registros de demostración',
      icon: ShoppingBag,
    },
  ]
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">UNA VISTA CLARA DE TU NEGOCIO</span>
          <h1>Todo en orden.</h1>
          <p className="muted">Esto es lo que sucede en tu perfumería hoy.</p>
        </div>
        <span className="date-chip">{formatDate(new Date())}</span>
      </div>
      <div className="stats-grid">
        {stats.map(({ title, value, detail, icon: Icon, warning }) => (
          <Card
            key={title}
            className={`stat-card ${warning ? 'stat-warning' : ''}`}
          >
            <div>
              <span>{title}</span>
              <Icon size={18} strokeWidth={1.6} />
            </div>
            <strong>{value.toString().padStart(2, '0')}</strong>
            <small>
              {warning && <span className="status-dot" />}
              {detail}
            </small>
          </Card>
        ))}
      </div>
      <div className="quick-grid">
        <Link to={`${base}/scanner`} className="scan-promo">
          <div>
            <span className="eyebrow">TU PRÓXIMA ACCIÓN, MÁS SIMPLE</span>
            <h2>
              Escanea y encuentra
              <br />
              lo que necesitas.
            </h2>
            <p>
              Consulta existencias y accede a cada producto
              <br className="desktop-break" /> con la cámara de tu teléfono.
            </p>
            <span className="promo-button">
              Escanear producto <ArrowRight size={17} />
            </span>
          </div>
          <div className="scan-art" aria-hidden="true">
            <ScanLine size={102} strokeWidth={0.85} />
            <span>QR & CÓDIGO DE BARRAS</span>
          </div>
        </Link>
        <Card className="sale-promo">
          <span className="round-icon">
            <ShoppingBag size={22} strokeWidth={1.4} />
          </span>
          <h2>Cada venta cuenta.</h2>
          <p>
            Un espacio simple para el próximo
            <br className="desktop-break" /> paso de tu operación.
          </p>
          <Link className="text-link" to={`${base}/sales`}>
            Nueva venta <ArrowUpRight size={17} />
          </Link>
          <small>Disponible en el siguiente incremento</small>
        </Card>
      </div>
      <div className="dashboard-lower">
        <Card className="alerts-card">
          <div className="section-heading">
            <div>
              <h2>Necesitan tu atención</h2>
              <p className="muted">Productos por debajo del stock mínimo.</p>
            </div>
            <Link to={`${base}/alerts`}>
              Ver todas <ArrowUpRight size={15} />
            </Link>
          </div>
          {low.length ? (
            low.map((item) => (
              <div className="alert-row" key={item.product.id}>
                <ProductIdentity item={item} />
                <div className="alert-quantity">
                  <strong>
                    {totalStock(item)} <span>uds.</span>
                  </strong>
                  <small>Mínimo: {item.product.minimumStock}</small>
                </div>
                <StockBadge item={item} />
              </div>
            ))
          ) : (
            <EmptyState
              title="Todo al día"
              description="No hay productos por debajo del mínimo."
            />
          )}
        </Card>
        <Card className="locations-card">
          <div className="section-heading">
            <h2>Tu inventario, ubicado</h2>
          </div>
          <p className="muted">Una visión de tus existencias.</p>
          <div className="location-summary">
            <span className="round-icon">
              <Warehouse size={20} />
            </span>
            <div>
              <strong>Bodega</strong>
              <small>Almacenamiento</small>
            </div>
            <b>
              {warehouse}
              <small>unidades</small>
            </b>
          </div>
          <div className="location-bar">
            <span
              style={{
                width: `${warehouse + store ? (warehouse / (warehouse + store)) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="location-summary">
            <span className="round-icon light">
              <Store size={20} />
            </span>
            <div>
              <strong>Tienda</strong>
              <small>Punto de venta</small>
            </div>
            <b>
              {store}
              <small>unidades</small>
            </b>
          </div>
          <div className="location-bar light">
            <span
              style={{
                width: `${warehouse + store ? (store / (warehouse + store)) * 100 : 0}%`,
              }}
            />
          </div>
          <Link className="text-link" to={`${base}/inventory`}>
            Explorar inventario <ArrowRight size={15} />
          </Link>
        </Card>
      </div>
      {can(role, 'finance.read') && (
        <div className="page-feedback">
          Ventas de demostración: {formatCurrency(data.sales.totals.NIO, 'NIO')}{' '}
          · {formatCurrency(data.sales.totals.USD, 'USD')}. Los totales se
          mantienen separados por moneda.
        </div>
      )}
    </>
  )
}
