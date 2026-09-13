import { useRef, useState, type FormEvent } from 'react'
import { ArrowDownLeft, ArrowUpRight, SlidersHorizontal, TriangleAlert, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Dialog, ErrorState, LoadingState, Input, Select } from '../../components/ui'
import type { Product, MovementInput } from '../../lib/domain'
import { labels } from '../../lib/domain'
import { can, type Capability } from '../../lib/permissions'
import { formatCurrency } from '../../lib/format'
import { errorMessage } from '../../lib/errors'
import { useAccess } from '../../app/AccessContext'
import { useServices } from '../../services/useServices'
import { useQuery } from '../../lib/useQuery'
import { ProductCard } from '../inventory/ProductCard'
const actions: {title:string;capability:Capability;icon:typeof Check;type:MovementInput['type']}[]=[
 {title:'Entrada',capability:'inventory.create_entry',icon:ArrowDownLeft,type:'ENTRY'},
 {title:'Salida',capability:'inventory.create_exit',icon:ArrowUpRight,type:'EXIT'},
 {title:'Dañado',capability:'inventory.create_damage',icon:TriangleAlert,type:'DAMAGED'},
 {title:'Ajuste',capability:'inventory.adjust',icon:SlidersHorizontal,type:'ADJUSTMENT'},
]
export function ScannerResult({product}:{product:Product}) {
 const {role,demo}=useAccess()
 const {inventoryService}=useServices()
 const query=useQuery(inventoryService.getInventory)
 const [action,setAction]=useState<(typeof actions)[number] | null>(null)
 const [quantity,setQuantity]=useState(1)
 const [location,setLocation]=useState<MovementInput['location']>('store')
 const [note,setNote]=useState('')
 const [reference,setReference]=useState('')
 const [error,setError]=useState('')
 const [success,setSuccess]=useState('')
 const [busy,setBusy]=useState(false)
 const request=useRef(crypto.randomUUID())
 const submitting=useRef(false)
 const item=query.data?.find(i=>i.product.id===product.id)
 async function submit(e:FormEvent) {
  e.preventDefault()
  if(!action || submitting.current || demo) return
  submitting.current=true;setBusy(true);setError('')
  try {
   await inventoryService.createInventoryMovement({requestId:request.current,productId:product.id,location,type:action.type,quantity,reference:reference||null,note})
   setSuccess(action.title+' registrada.');setAction(null);query.retry()
  } catch(err) {setError(errorMessage(err))}
  finally {setBusy(false);submitting.current=false}
 }
 return <Card className="scan-result">
  <Badge tone="success"><Check size={13}/>Producto encontrado</Badge><h2>{product.name}</h2>
  <p className="muted">{product.brand} · {product.size===null ? 'Tamaño por confirmar' : product.size+' '+product.unit} · {labels.category[product.category]}</p>
  <code>{product.barcode}</code><strong className="scan-price">{formatCurrency(product.price,product.currency)}</strong>
  {query.loading ? <LoadingState/> : query.error ? <ErrorState message={query.error} retry={query.retry}/> : item ? <ProductCard item={item}/> : <p>Sin información de existencias.</p>}
  <h3>Continuar con una acción</h3><div className="scan-actions">{actions.filter(a=>can(role,a.capability)).map(a=><Button key={a.type} variant="secondary" onClick={()=>{setAction(a);setQuantity(a.type==='ADJUSTMENT'?0:1);setNote('');setReference('');setError('');setSuccess('');request.current=crypto.randomUUID()}}><a.icon size={19}/>{a.title}</Button>)}</div>
  {success && <p role="status">{success}</p>}
  <Dialog open={!!action} title={(action?.title ?? '')+' de inventario'} onClose={()=>{if(!busy)setAction(null)}}>
   {demo ? <><p>Los movimientos reales requieren una cuenta de la tienda. Esta vista permite consultar los datos de ejemplo.</p><Button onClick={()=>setAction(null)}>Entendido</Button></> : <form onSubmit={submit} className="movement-form">
    <p>{product.name}</p>
    {action?.type==='ADJUSTMENT' && <p>Ingresa la cantidad total contada en la ubicación. Este ajuste permite registrar el conteo inicial.</p>}
    <Select label="Ubicación" value={location} onChange={e=>setLocation(e.target.value as typeof location)} disabled={busy}><option value="store">Tienda</option><option value="warehouse">Bodega</option></Select>
    <Input label={action?.type==='ADJUSTMENT'?'Cantidad contada':'Cantidad'} type="number" min={action?.type==='ADJUSTMENT'?0:1} max={1000000} step={1} required value={quantity} onChange={e=>setQuantity(Number(e.target.value))} disabled={busy}/>
    <Input label="Motivo" value={note} onChange={e=>setNote(e.target.value)} required maxLength={2000} disabled={busy}/>
    <Input label="Referencia (opcional)" value={reference} onChange={e=>setReference(e.target.value)} maxLength={160} disabled={busy}/>
    {error && <p role="alert" className="inline-error">{error}</p>}
    <Button type="submit" disabled={busy}>{busy?'Guardando…':'Confirmar '+action?.title}</Button>
   </form>}
  </Dialog>
 </Card>
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
