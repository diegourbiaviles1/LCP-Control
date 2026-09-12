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
import type { Product, InventoryMovement } from '../../lib/domain'
import { labels } from '../../lib/domain'
import { can, type Capability } from '../../lib/permissions'
import { formatCurrency } from '../../lib/format'
import { useAccess } from '../../app/AccessContext'
import { inventoryService } from '../../services'
import { useQuery } from '../../lib/useQuery'
import { ProductCard } from '../inventory/ProductCard'
import { toast } from 'sonner'

const actions: {
  title: string
  capability: Capability
  icon: typeof ArrowDownLeft
  type: InventoryMovement['type']
}[] = [
  {
    title: 'Entrada',
    capability: 'inventory.create_entry',
    icon: ArrowDownLeft,
    type: 'ENTRY'
  },
  { 
    title: 'Salida', 
    capability: 'inventory.create_exit', 
    icon: ArrowUpRight, 
    type: 'EXIT' 
  },
  {
    title: 'Dañado',
    capability: 'inventory.create_damage',
    icon: TriangleAlert,
    type: 'DAMAGED'
  },
  { 
    title: 'Ajuste', 
    capability: 'inventory.adjust', 
    icon: SlidersHorizontal, 
    type: 'ADJUSTMENT' 
  },
]

export function ScannerResult({ product }: { product: Product }) {
  const { role } = useAccess()
  const { data, loading, error, retry } = useQuery(
    inventoryService.getInventory,
  )
  const [action, setAction] = useState<string | null>(null)
  const [quantity, setQuantity] = useState<number>(1)
  const [reference, setReference] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const item = data?.find((item) => item.product.id === product.id)
  
  const handleActionClick = (actionTitle: string) => {
    setAction(actionTitle)
    // Reset form fields when opening new action
    setQuantity(1)
    setReference('')
    setNote('')
  }

  const handleSubmitMovement = async () => {
    if (!action) return
    
    try {
      const selectedAction = actions.find(a => a.title === action)
      
      if (!selectedAction) {
        toast.error('Error al procesar la acción')
        return
      }
      
      // Create inventory movement object
      const movement: Omit<InventoryMovement, 'id' | 'createdAt'> = {
        productId: product.id,
        type: selectedAction.type,
        quantity,
        reference: reference || undefined,
        note: note || undefined,
        location: 'store', // Default to store for now - can be extended based on requirements
      }
      
      // Call the service to create inventory movement
      await inventoryService.createInventoryMovement(movement)
      
      toast.success(`${action} registrada exitosamente`)
      setAction(null)
    } catch (error) {
      console.error('Error creating inventory movement:', error)
      toast.error('Error al registrar la acción en el inventario')
      setAction(null)
    }
  }

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
        Realiza una operación sobre el inventario
      </p>
      <div className="scan-actions">
        {actions
          .filter((action) => can(role, action.capability))
          .map(({ title, icon: Icon, type }) => (
            <Button
              key={title}
              variant="secondary"
              onClick={() => handleActionClick(title)}
            >
              <Icon size={19} />
              {title}
            </Button>
          ))}
      </div>
      {role === 'operator' && (
        <small>
          Entradas y ajustes requieren autorización administrativa; política
          pendiente de definición.
        </small>
      )}
      
      {/* Action Dialog */}
      <Dialog
        open={!!action}
        title={`${action} de inventario`}
        onClose={() => setAction(null)}
      >
        {action && (
          <>
            <p>
              <strong>{product.name}</strong> · {product.barcode}
            </p>
            
            {/* Quantity Input */}
            <div className="mb-4">
              <label htmlFor="quantity" className="block text-sm font-medium mb-1">
                Cantidad
              </label>
              <input
                type="number"
                id="quantity"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full p-2 border rounded"
              />
            </div>
            
            {/* Reference Input */}
            <div className="mb-4">
              <label htmlFor="reference" className="block text-sm font-medium mb-1">
                Referencia (opcional)
              </label>
              <input
                type="text"
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Número de factura, orden de compra, etc."
              />
            </div>
            
            {/* Note Input */}
            <div className="mb-4">
              <label htmlFor="note" className="block text-sm font-medium mb-1">
                Nota (opcional)
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Observaciones adicionales"
                rows={3}
              />
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setAction(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmitMovement}>
                Confirmar {action}
              </Button>
            </div>
          </>
        )}
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
          ? 'Puedes preparar el alta con este código. El guardado estará disponible con el backend de productos.'
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