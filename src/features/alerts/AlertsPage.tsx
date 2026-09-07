import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Card, EmptyState, ErrorState, LoadingState } from '../../components/ui'
import { inventoryService } from '../../services'
import { useQuery } from '../../lib/useQuery'
import { ProductCard } from '../inventory/ProductCard'
import { useAccess } from '../../app/AccessContext'
export function AlertsPage() {
  const { data, error, loading, retry } = useQuery(inventoryService.getLowStock)
  const { base } = useAccess()
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A TIEMPO, SIEMPRE</span>
          <h1>Alertas de inventario</h1>
          <p className="muted">
            Productos cuyo total está por debajo del mínimo configurado.
          </p>
        </div>
        <Link className="button button-secondary" to={`${base}/inventory`}>
          Ver inventario <ArrowRight size={17} />
        </Link>
      </div>
      <Card>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} retry={retry} />
        ) : !data?.length ? (
          <EmptyState
            title="Tu inventario está al día"
            description="No hay productos con stock bajo."
          />
        ) : (
          data.map((item) => <ProductCard item={item} key={item.product.id} />)
        )}
      </Card>
    </>
  )
}
