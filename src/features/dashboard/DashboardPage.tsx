import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Package,
  ScanLine,
  ReceiptText,
  Truck,
  Warehouse,
} from 'lucide-react'
import { Card, ErrorState, LoadingState } from '../../components/ui'
import { Brand } from '../../components/Brand'
import { inventoryService } from '../../services'
import { useQuery } from '../../lib/useQuery'
import { formatDate } from '../../lib/format'
import { useAccess } from '../../app/AccessContext'
import { Reflection } from './Reflection'
const actions = [
  ['/products', 'Catálogo', 'Consultar perfumes, fotos y precios.', Package],
  [
    '/sales',
    'Facturación',
    'Preparar un borrador en córdobas o dólares.',
    ReceiptText,
  ],
  [
    '/inventory',
    'Inventario',
    'Preparar entradas, salidas y daños.',
    Warehouse,
  ],
  [
    '/suppliers',
    'Proveedores',
    'Guardar contactos y datos comerciales.',
    Truck,
  ],
] as const
export function DashboardPage() {
  const { data, loading, error, retry } = useQuery(
    inventoryService.getInventory,
  )
  const { base } = useAccess()
  if (loading) return <LoadingState />
  if (error || !data)
    return (
      <ErrorState
        message={error ?? 'No hay datos disponibles.'}
        retry={retry}
      />
    )
  const brands = new Set(data.map((item) => item.product.brand)).size
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Inicio</h1>
          <p className="muted">{formatDate(new Date())}</p>
        </div>
      </div>
      <section className="welcome-panel">
        <Brand wordmark />
        <Reflection />
      </section>
      <div className="stats-grid">
        {[
          ['Referencias', data.length, 'Catálogo mayorista'],
          ['Marcas', brands, 'En las listas recibidas'],
          ['Listas de precios', 3, 'Emprendedor, VIP y Premium'],
          ['Existencias', '—', 'Pendientes de registrar'],
        ].map(([title, value, detail]) => (
          <Card className="stat-card" key={title}>
            <div>
              {title}
              <Package size={18} />
            </div>
            <strong>{value}</strong>
            <small>{detail}</small>
          </Card>
        ))}
      </div>
      <div className="home-actions">
        {actions.map(([path, title, description, Icon]) => (
          <Link className="home-action card" key={path} to={`${base}${path}`}>
            <Icon size={22} />
            <h2>{title}</h2>
            <p>{description}</p>
            <ArrowRight size={18} />
          </Link>
        ))}
      </div>
      <Link className="scan-shortcut" to={`${base}/scanner`}>
        <ScanLine size={28} />
        <div>
          <h2>Buscar por código</h2>
          <p>
            Escanea una etiqueta interna o introduce el código del producto.
          </p>
        </div>
        <ArrowRight size={20} />
      </Link>
      <p className="workspace-disclaimer">
        Los precios provienen de las listas de mayor. Las existencias aún no
        están cargadas.
      </p>
    </>
  )
}
