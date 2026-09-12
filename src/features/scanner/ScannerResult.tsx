import { useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  TriangleAlert,
  Check,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  Dialog,
  ErrorState,
  LoadingState,
} from '../../components/ui'
import type { Product } from '../../lib/domain'
import { labels } from '../../lib/domain'
import { can, type Capability } from '../../lib/permissions'
import { formatCurrency } from '../../lib/format'
import { useAccess } from '../../app/AccessContext'
import { inventoryService } from '../../services'
import { useQuery } from '../../lib/useQuery'
import { ProductCard } from '../inventory/ProductCard'
const actions: {
  title: string
  capability: Capability
  icon: typeof ArrowDownLeft
}[] = [
  {
    title: 'Entrada',
    capability: 'inventory.create_entry',
    icon: ArrowDownLeft,
  },
  { title: 'Salida', capability: 'inventory.create_exit', icon: ArrowUpRight },
  {
    title: 'Dañado',
    capability: 'inventory.create_damage',
    icon: TriangleAlert,
  },
  { title: 'Ajuste', capability: 'inventory.adjust', icon: SlidersHorizontal },
]
export function ScannerResult({ product }: { product: Product }) {
  const { role } = useAccess()
  const { data, loading, error, retry } = useQuery(
    inventoryService.getInventory,
  )
  const [action, setAction] = useState('')
  const item = data?.find((item) => item.product.id === product.id)
  return (
    <Card className="scan-result">
      <Badge tone="success">
        <Check size={13} /> Producto encontrado
      </Badge>
      <h2>{product.name}</h2>
      <p className="muted">
        {product.brand} · {product.size} {product.unit} ·{' '}
        {labels.category[product.category]}
      </p>
      <code>{product.barcode}</code>
      <strong className="scan-price">
        {formatCurrency(product.price, product.currency)}
      </strong>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} retry={retry} />
      ) : item ? (
        <ProductCard item={item} />
      ) : (
        <p>No se encontraron existencias para este producto.</p>
      )}
      <h3>Continuar con una acción</h3>
      <p className="muted">
        Vista previa del flujo. No modifica el inventario.
      </p>
      <div className="scan-actions">
        {actions
          .filter((action) => can(role, action.capability))
          .map(({ title, icon: Icon }) => (
            <Button
              key={title}
              variant="secondary"
              onClick={() => setAction(title)}
            >
              <Icon size={19} />
              {title}
            </Button>
          ))}
      </div>
      {role === 'operator' && (
        <small>
          Los movimientos preparados quedan pendientes de registrar.
        </small>
      )}
      <Dialog
        open={!!action}
        title={`${action} de inventario`}
        onClose={() => setAction('')}
      >
        <p>
          <strong>{product.name}</strong> · {product.barcode}
        </p>
        <p>
          Puedes preparar este movimiento desde Inventario. Se guardará como
          pendiente, sin cambiar las existencias.
        </p>
        <Button onClick={() => setAction('')}>Entendido</Button>
      </Dialog>
    </Card>
  )
}
export function UnknownProduct({ code }: { code: string }) {
  const { role, base } = useAccess()
  return (
    <Card className="scan-result">
      <Badge tone="warning">Código no registrado</Badge>
      <h2>No encontramos este producto.</h2>
      <code>{code}</code>
      <p className="muted">
        {can(role, 'product.manage')
          ? 'Puedes preparar el alta con este código. El código del fabricante se verificará al registrar el producto.'
          : 'Solicita al administrador que registre o verifique este código.'}
      </p>
      {can(role, 'product.manage') && (
        <Link
          className="button button-secondary"
          to={`${base}/products/new?barcode=${encodeURIComponent(code)}`}
        >
          Preparar alta del producto
        </Link>
      )}
    </Card>
  )
}
