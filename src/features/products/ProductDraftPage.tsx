import { Link, useSearchParams } from 'react-router-dom'
import { Card, ErrorState, Input } from '../../components/ui'
import { useAccess } from '../../app/AccessContext'
import { can } from '../../lib/permissions'
export function ProductDraftPage() {
  const [params] = useSearchParams()
  const { role, base } = useAccess()
  if (!can(role, 'product.manage'))
    return (
      <ErrorState message="Necesitas autorización administrativa para preparar un producto." />
    )
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">NUEVO PRODUCTO</span>
          <h1>Preparar alta</h1>
          <p className="muted">Código recuperado del escáner.</p>
        </div>
      </div>
      <Card className="draft-card">
        <Input
          label="Código del producto"
          value={(params.get('barcode') ?? '').slice(0, 128)}
          readOnly
        />
        <p>
          El formulario completo y el guardado se habilitarán junto con el
          backend de productos. No se ha creado ningún producto.
        </p>
        <Link className="button button-secondary" to={`${base}/scanner`}>
          Volver al escáner
        </Link>
      </Card>
    </>
  )
}
