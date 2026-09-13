import { useCallback, useRef, useState, type FormEvent } from 'react'
import { NavLink } from 'react-router-dom'
import { FileText, MessageCircle, Plus, Printer, ReceiptText, Trash2 } from 'lucide-react'
import { Badge, Button, Card, Dialog, EmptyState, ErrorState, Input, LoadingState, Select } from '../../components/ui'
import { useAccess } from '../../app/AccessContext'
import { useServices } from '../../services/useServices'
import { useQuery } from '../../lib/useQuery'
import { errorMessage } from '../../lib/errors'
import { formatCurrency } from '../../lib/format'
import { labels, type BusinessDocument, type Currency, type DocumentInput, type DocumentKind, type PriceTier, type Product } from '../../lib/domain'
import { documentLabels, documentText, localDate, normalizePhone, priceFor, tierLabels, validateDocument, whatsappUrl } from './documents'

export function DocumentsPage({ kind }: { kind: DocumentKind }) {
  const { demo, base, role } = useAccess()
  const { inventoryService, documentService } = useServices()
  const load = useCallback(async () => {
    const [inventory, customers, documents] = await Promise.all([
      inventoryService.getInventory(), documentService.getCustomers(), documentService.getDocuments(kind),
    ])
    return { inventory, customers, documents }
  }, [inventoryService, documentService, kind])
  const query = useQuery(load)
  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [tier, setTier] = useState<PriceTier>('emprendedor')
  const [currency, setCurrency] = useState<Currency>('NIO')
  const [location, setLocation] = useState<'store' | 'warehouse'>('store')
  const [payment, setPayment] = useState<DocumentInput['paymentMethod']>('pending')
  const [validUntil, setValidUntil] = useState(() => localDate(new Date(Date.now() + 7 * 86400000)))
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [lines, setLines] = useState<{ product: Product; quantity: number }[]>([])
  const [saved, setSaved] = useState<BusinessDocument | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const request = useRef(crypto.randomUUID())
  const submitting = useRef(false)
  const isInvoice = kind === 'invoice'
  const total = lines.reduce((sum,l) => sum + Math.round((priceFor(l.product,tier,currency) ?? 0)*100)*l.quantity,0)/100
  const searchText = search.toLocaleLowerCase('es').trim()
  const matches = query.data?.inventory.filter(i => `${i.product.name} ${i.product.brand} ${i.product.barcode}`.toLocaleLowerCase('es').includes(searchText)).slice(0,6) ?? []
  function reset() {
    setSaved(null); setLines([]); setNotes(''); setError(''); setSearch(''); request.current=crypto.randomUUID()
  }
  function add(product: Product) {
    setLines(current => {
      const line=current.find(l=>l.product.id===product.id)
      return line ? current.map(l=>l.product.id===product.id ? {...l,quantity:Math.min(l.quantity+1,10000)} : l) : [...current,{product,quantity:1}]
    })
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if(submitting.current) return
    setError('')
    try {
      const input: DocumentInput={requestId:request.current,kind,customerId:customerId || null,customerName,
        customerPhone:customerPhone ? normalizePhone(customerPhone) : '',currency,tier,
        location:isInvoice ? location : null,paymentMethod:isInvoice ? payment : null,validUntil:isInvoice ? null : validUntil,
        notes,items:lines.map(l=>({productId:l.product.id,quantity:l.quantity}))}
      validateDocument(input)
      submitting.current=true; setBusy(true)
      const result=await documentService.createDocument(input)
      setSaved(result); query.retry()
    } catch(err) { setError(errorMessage(err)) }
    finally { submitting.current=false;setBusy(false) }
  }
  return <>
    <div className="page-heading">
      <div><span className="eyebrow">DOCUMENTOS DEL NEGOCIO</span><h1>{isInvoice ? 'Facturación' : 'Proformas'}</h1>
        <p className="muted">{isInvoice ? 'Emite una factura cuando la venta esté confirmada.' : 'Prepara una cotización para que tu cliente decida.'}</p></div>
      <Badge tone={isInvoice ? 'neutral' : 'warning'}>{isInvoice ? 'Factura de venta' : 'Cotización sin cobro'}</Badge>
    </div>
    <nav className="document-tabs" aria-label="Tipo de documento">
      <NavLink to={`${base}/invoices`}><ReceiptText size={18}/>Facturación</NavLink>
      <NavLink to={`${base}/proformas`}><FileText size={18}/>Proformas</NavLink>
    </nav>
    <div className={`document-notice ${isInvoice ? '' : 'quotation-notice'}`}>
      {isInvoice ? 'Al emitir, se registra la factura y se descuentan las unidades de la ubicación elegida.'
        : 'Una proforma no registra una venta, no descuenta inventario y no acredita un pago.'}
      {demo && <small>Simulación con datos ficticios. Los documentos se borran al recargar la demo.</small>}
    </div>
    {saved ? <>
      <div className="section-heading"><h2>{demo ? 'Documento de demostración' : 'Documento guardado'}</h2><Button onClick={reset}><Plus size={17}/> {isInvoice ? 'Nueva factura' : 'Nueva proforma'}</Button></div>
      <DocumentPreview document={saved}/>
    </> : query.loading ? <LoadingState/> : query.error ? <ErrorState message={query.error} retry={query.retry}/> : <form onSubmit={save} className="document-form">
      <fieldset disabled={busy} className="document-fieldset">
      <div className="document-grid">
        <Card className="document-editor">
          <div className="section-heading"><h2>Cliente y condiciones</h2><span className="muted">{documentLabels[kind]}</span></div>
          <Select label="Cliente registrado" value={customerId} onChange={e=>{
            const id=e.target.value; const c=query.data?.customers.find(c=>c.id===id)
            setCustomerId(id);setCustomerName(c?.name ?? '');setCustomerPhone(c?.phone ?? '');setTier(c?.priceTier ?? 'emprendedor')
          }}><option value="">Nuevo cliente</option>{query.data?.customers.map(c=><option key={c.id} value={c.id}>{c.name} · {tierLabels[c.priceTier]}</option>)}</Select>
          <div className="document-fields">
            <Input label="Nombre del cliente" value={customerName} onChange={e=>setCustomerName(e.target.value)} required maxLength={160} readOnly={!!customerId}/>
            <Input label="WhatsApp del cliente (opcional)" type="tel" placeholder="+505 8888 0000" value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} maxLength={25} readOnly={!!customerId}/>
            <Select label="Lista de precios" value={tier} disabled={role!=='admin'} onChange={e=>setTier(e.target.value as PriceTier)}>
              {Object.entries(tierLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}
            </Select>
            <Select label="Moneda del documento" value={currency} onChange={e=>setCurrency(e.target.value as Currency)}><option value="NIO">Córdobas · NIO</option><option value="USD">Dólares · USD</option></Select>
            {isInvoice ? <>
              <Select label="Descontar existencias de" value={location} onChange={e=>setLocation(e.target.value as typeof location)}><option value="store">Tienda</option><option value="warehouse">Bodega</option></Select>
              <Select label="Forma de pago" value={payment ?? 'pending'} onChange={e=>setPayment(e.target.value as typeof payment)}><option value="pending">Pago pendiente</option>{Object.entries(labels.payment).map(([key,label])=><option key={key} value={key}>{label}</option>)}</Select>
            </> : <Input label="Válida hasta" type="date" value={validUntil} onChange={e=>setValidUntil(e.target.value)} min={localDate()} required/>}
          </div>
          <small className="muted">{role==='admin' ? 'La lista elegida quedará asignada a este cliente al guardar.' : 'Un dueño asigna la lista de precios. Los clientes nuevos comienzan en Emprendedor.'}</small>
          <div className="document-products"><h2>Agregar productos</h2>
            <Input label="Buscar en el catálogo" type="search" placeholder="Nombre, marca o código…" value={search} onChange={e=>setSearch(e.target.value)}/>
            <div className="catalog-options">{matches.length ? matches.map(item=><div className="catalog-option" key={item.product.id}>
              <div><strong>{item.product.name}</strong><small>{item.product.brand} · {item.product.size === null ? 'Tamaño por confirmar' : `${item.product.size} ${item.product.unit}`}</small></div>
              <span>{priceFor(item.product,tier,currency) === null ? 'Sin precio' : formatCurrency(priceFor(item.product,tier,currency)!,currency)}</span>
              <Button type="button" variant="secondary" aria-label={`Agregar ${item.product.name}`} disabled={priceFor(item.product,tier,currency)===null || lines.length>=100} onClick={()=>add(item.product)}><Plus size={16}/></Button>
            </div>) : <EmptyState title="Sin productos coincidentes"/>}</div>
          </div>
        </Card>
        <Card className="document-summary">
          <div className="section-heading"><h2>{isInvoice ? 'Detalle de factura' : 'Detalle de proforma'}</h2>{isInvoice ? <ReceiptText size={20}/> : <FileText size={20}/>}</div>
          <Badge>{isInvoice ? 'FAC · Pendiente de emitir' : 'PRO · Pendiente de guardar'}</Badge>
          {lines.length ? <div className="document-lines">{lines.map(line=><div className="document-line" key={line.product.id}>
            <strong>{line.product.name}</strong>
            <div className="document-line-controls"><Input label={`Cantidad de ${line.product.name}`} type="number" min={1} max={10000} step={1} value={line.quantity} required onChange={e=>setLines(lines.map(l=>l.product.id===line.product.id ? {...l,quantity:Number(e.target.value)} : l))}/>
              <span>{priceFor(line.product,tier,currency) === null ? 'Sin precio' : formatCurrency(Math.round(priceFor(line.product,tier,currency)!*100)*line.quantity/100,currency)}</span>
              <Button type="button" variant="ghost" aria-label={`Quitar ${line.product.name}`} onClick={()=>setLines(lines.filter(l=>l.product.id!==line.product.id))}><Trash2 size={16}/></Button>
            </div>
          </div>)}</div> : <p className="document-empty">Agrega productos del catálogo para preparar el documento.</p>}
          <Input label="Observaciones (opcional)" value={notes} onChange={e=>setNotes(e.target.value)} maxLength={2000}/>
          <div className="document-total"><span>Total {currency}</span><strong>{formatCurrency(total,currency)}</strong></div>
          {error && <p role="alert" className="inline-error">{error}</p>}
          <Button type="submit" disabled={busy || !lines.length || lines.some(l=>priceFor(l.product,tier,currency)===null)}>{busy ? 'Guardando…' : isInvoice ? 'Emitir factura' : 'Guardar proforma'}</Button>
          <Button type="button" variant="secondary" disabled><MessageCircle size={18}/>{isInvoice ? 'Enviar factura por WhatsApp' : 'Enviar proforma por WhatsApp'}</Button>
          <small className="muted">Guarda el documento para revisar y enviar su versión final por WhatsApp.</small>
        </Card>
      </div>
      </fieldset>
    </form>}
    <Card className="document-history"><div className="section-heading"><h2>{isInvoice ? 'Facturas emitidas' : 'Proformas guardadas'}</h2><Button type="button" variant="ghost" onClick={query.retry}>Actualizar</Button></div>
      <p className="muted">Últimos 100 documentos de esta sección.</p>
      {query.error && <ErrorState message={query.error} retry={query.retry}/>}
      {query.data?.documents.length ? query.data.documents.map(doc=><div className="document-history-row" key={doc.id}>
        <div><strong>{doc.number}</strong><small>{doc.customerName} · {localDate(new Date(doc.createdAt))}</small></div>
        <strong>{formatCurrency(doc.total,doc.currency)}</strong><Button variant="secondary" onClick={()=>{setSaved(doc);setError('')}}>Ver documento</Button>
      </div>) : <p className="document-empty">{isInvoice ? 'Todavía no hay facturas.' : 'Todavía no hay proformas.'}</p>}
    </Card>
  </>
}

function DocumentPreview({ document: doc }: { document: BusinessDocument }) {
  const [sharing,setSharing]=useState(false)
  const [phone,setPhone]=useState('')
  const [error,setError]=useState('')
  const label=doc.kind==='invoice' ? 'factura' : 'proforma'
  let url=''
  try { if(phone) url=whatsappUrl(doc,phone) } catch { /* Explain on explicit validation below. */ }
  return <>
    <Card className="document-preview">
      <div className="document-paper">
        {doc.demo && <div className="print-demo">DEMOSTRACIÓN · SIN VALIDEZ COMERCIAL</div>}
        <div className="document-paper-heading"><div><span className="eyebrow">{doc.issuer.name}</span><h2>{doc.kind==='invoice' ? 'FACTURA' : 'PROFORMA / COTIZACIÓN'}</h2><strong>{doc.number}</strong></div><div><p>{doc.issuer.address}</p><p>{doc.issuer.phone}</p></div></div>
        <p><strong>Cliente:</strong> {doc.customerName}</p><p>Fecha: {localDate(new Date(doc.createdAt))} · Lista {tierLabels[doc.tier]}</p>
        {doc.validUntil && <p>Válida hasta: {doc.validUntil}</p>}
        <div className="document-item-table"><table><thead><tr><th>Descripción</th><th>Cant.</th><th>Precio</th><th>Importe</th></tr></thead><tbody>{doc.items.map(item=><tr key={item.productId}><td>{item.description}</td><td>{item.quantity}</td><td>{formatCurrency(item.unitPrice,doc.currency)}</td><td>{formatCurrency(item.lineTotal,doc.currency)}</td></tr>)}</tbody></table></div>
        <div className="document-total"><span>Total {doc.currency}</span><strong>{formatCurrency(doc.total,doc.currency)}</strong></div>
        {doc.notes && <p>Observaciones: {doc.notes}</p>}
        <p className="document-kind-note">{doc.kind==='proforma' ? 'Esta cotización no es una factura ni un comprobante de pago. Sujeta a disponibilidad.' : doc.paymentMethod==='pending' ? 'Pago pendiente.' : `Forma de pago registrada: ${labels.payment[doc.paymentMethod!]}.`}</p>
      </div>
      <div className="document-actions"><Button onClick={()=>{setSharing(true);setPhone(doc.customerPhone ?? '');setError('')}}><MessageCircle size={18}/>Enviar {label} por WhatsApp</Button><Button variant="secondary" onClick={()=>window.print()}><Printer size={18}/>Imprimir / Guardar PDF</Button></div>
    </Card>
    <Dialog open={sharing} title={`Enviar ${label} por WhatsApp`} onClose={()=>setSharing(false)}>
      <p>Se abrirá WhatsApp con el detalle en texto. Revisa el destinatario y pulsa enviar allí.</p>
      <Input label="Número de WhatsApp" type="tel" placeholder="+505 8888 0000" value={phone} onChange={e=>{setPhone(e.target.value);setError('')}}/>
      <label className="field"><span>Mensaje de {label}</span><textarea className="whatsapp-preview" readOnly value={documentText(doc)}/></label>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {url ? <a className="button button-primary" href={url} target="_blank" rel="noopener noreferrer">Abrir WhatsApp con {label}</a> : <Button onClick={()=>{try{normalizePhone(phone)}catch(err){setError(errorMessage(err))}}}>Revisar número</Button>}
    </Dialog>
  </>
}
