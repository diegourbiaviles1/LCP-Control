import { Link } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import { Card } from '../../components/ui'
import { useAccess } from '../../app/AccessContext'
export function SalesPage() {
  const { base } = useAccess()
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PUNTO DE VENTA</span>
          <h1>Nueva venta</h1>
          <p className="muted">El siguiente paso de tu operación.</p>
        </div>
      </div>
      <Card className="coming-soon">
        <span className="round-icon">
          <ShoppingBag size={30} />
        </span>
        <h2>Estamos preparando tu punto de venta.</h2>
        <p>
          El registro de ventas estará disponible cuando el backend pueda
          guardar la venta y descontar el inventario en una sola transacción.
        </p>
        <span className="badge badge-neutral">
          Próximo incremento · Sin operaciones habilitadas
        </span>
        <Link className="button button-primary" to={`${base}/inventory`}>
          Consultar inventario
        </Link>
      </Card>
    </>
  )
}
