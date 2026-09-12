import { useState } from 'react'
import { Plus, Printer, Save, Trash2 } from 'lucide-react'
import {
  Button,
  Card,
  Input,
  Select,
  ErrorState,
  LoadingState,
} from '../../components/ui'
import { Brand } from '../../components/Brand'
import { PriceControls } from '../../components/PriceControls'
import { inventoryService } from '../../services'
import { useQuery } from '../../lib/useQuery'
import { useLocalDrafts } from '../../lib/localDrafts'
import { formatCurrency, formatDate } from '../../lib/format'
import { labels } from '../../lib/domain'
import type { Currency, PriceTier } from '../../lib/domain'
import { priceTierLabels } from '../../lib/pricing'
import {
  invoiceSchema,
  invoiceTotal,
  type InvoiceDraft,
  type InvoiceLine,
} from './invoice'
export function SalesPage() {
  const {
    data,
    loading,
    error: loadError,
    retry,
  } = useQuery(inventoryService.getInventory)
  const {
    items: drafts,
    save,
    error,
  } = useLocalDrafts('lcp.invoices.v1', invoiceSchema)
  const [currency, setCurrency] = useState<Currency>('NIO')
  const [tier, setTier] = useState<PriceTier>('emprendedor')
  const [customer, setCustomer] = useState('')
  const [taxId, setTaxId] = useState('')
  const [payment, setPayment] = useState<InvoiceDraft['payment']>('cash')
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [productId, setProductId] = useState('')
  const [lines, setLines] = useState<InvoiceLine[]>([])
  const [current, setCurrent] = useState<{
    id: string
    reference: string
    createdAt: string
  } | null>(null)
  const [message, setMessage] = useState('')
  const valid = lines.every(
    (line) =>
      Number.isInteger(line.quantity) &&
      line.quantity > 0 &&
      line.quantity <= 9999,
  )
  const total = valid ? invoiceTotal(lines, tier, currency) : null
  function add() {
    const product = data?.find((item) => item.product.id === productId)?.product
    if (!product?.prices) {
      setMessage('Selecciona un producto del catálogo.')
      return
    }
    if (lines.some((line) => line.productId === product.id)) {
      setMessage(
        'El producto ya está en el borrador. Puedes cambiar su cantidad.',
      )
      return
    }
    setLines([
      ...lines,
      {
        productId: product.id,
        name: `${product.brand} ${product.name}`,
        barcode: product.barcode,
        size:
          product.size === null
            ? 'Tamaño por confirmar'
            : `${product.size} ${product.unit}`,
        quantity: 1,
        prices: structuredClone(product.prices),
      },
    ])
    setMessage('')
    setProductId('')
  }
  function saveDraft() {
    const stamp = current ?? {
      id: crypto.randomUUID(),
      reference: `B-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      createdAt: new Date().toISOString(),
    }
    const result = invoiceSchema.safeParse({
      ...stamp,
      customer,
      taxId,
      payment,
      notes,
      currency,
      tier,
      lines,
    })
    if (!result.success) {
      setMessage('Agrega productos y revisa las cantidades (1 a 9999).')
      return
    }
    if (
      save([result.data, ...drafts.filter((draft) => draft.id !== stamp.id)])
    ) {
      setCurrent(stamp)
      setMessage('Borrador guardado en este navegador.')
    }
  }
  function load(draft: InvoiceDraft) {
    setCurrent(draft)
    setCurrency(draft.currency)
    setTier(draft.tier)
    setCustomer(draft.customer)
    setTaxId(draft.taxId)
    setPayment(draft.payment)
    setNotes(draft.notes)
    setLines(structuredClone(draft.lines))
    setMessage('Borrador abierto. Guarda los cambios al terminar.')
  }
  function clear() {
    setCurrent(null)
    setCustomer('')
    setTaxId('')
    setNotes('')
    setLines([])
    setMessage('')
    setProductId('')
    setSearch('')
  }
  if (loading) return <LoadingState />
  if (loadError) return <ErrorState message={loadError} retry={retry} />
  return (
    <>
      <div className="page-heading no-print">
        <div>
          <h1>Facturación</h1>
          <p className="muted">Prepara y revisa el próximo pedido.</p>
        </div>
        <Button variant="secondary" onClick={clear}>
          <Plus size={18} />
          Nuevo borrador
        </Button>
      </div>
      <div className="invoice-layout">
        <div className="invoice-editor no-print">
          <Card className="form-card">
            <h2>Datos del borrador</h2>
            <PriceControls
              currency={currency}
              tier={tier}
              onCurrency={setCurrency}
              onTier={setTier}
            />
            <div className="form-grid">
              <Input
                label="Cliente"
                maxLength={200}
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="Nombre del cliente"
              />
              <Input
                label="RUC / Identificación del cliente"
                maxLength={100}
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
              />
              <Select
                label="Forma de pago"
                value={payment}
                onChange={(e) =>
                  setPayment(e.target.value as InvoiceDraft['payment'])
                }
              >
                {Object.entries(labels.payment).map(([id, label]) => (
                  <option value={id} key={id}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </Card>
          <Card className="form-card">
            <h2>Agregar productos</h2>
            <Input
              label="Buscar en catálogo"
              placeholder="Nombre, marca o código interno"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              label="Producto para facturar"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">Selecciona un producto</option>
              {data
                ?.filter(({ product: p }) =>
                  `${p.name} ${p.brand} ${p.barcode}`
                    .toLocaleLowerCase('es')
                    .includes(search.toLocaleLowerCase('es')),
                )
                .map(({ product: p }) => (
                  <option key={p.id} value={p.id}>
                    {p.brand} · {p.name} · {p.size ?? '?'} {p.unit}
                  </option>
                ))}
            </Select>
            <Button onClick={add} disabled={!productId}>
              <Plus size={16} />
              Agregar al borrador
            </Button>
          </Card>
          {drafts.length > 0 && (
            <Card className="form-card">
              <h2>Borradores guardados</h2>
              <div className="saved-drafts">
                {drafts.map((draft) => (
                  <button key={draft.id} onClick={() => load(draft)}>
                    <strong>
                      {draft.reference} · {draft.customer || 'Sin cliente'}
                    </strong>
                    <span>
                      {formatCurrency(
                        invoiceTotal(draft.lines, draft.tier, draft.currency),
                        draft.currency,
                      )}{' '}
                      · {formatDate(draft.createdAt)}
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
        <Card className="invoice-paper">
          <div className="invoice-heading">
            <Brand wordmark />
            <div>
              <strong>BORRADOR</strong>
              <span>{current?.reference ?? 'Sin guardar'}</span>
            </div>
          </div>
          <div className="invoice-meta">
            <p>
              {customer || 'Cliente por indicar'}
              {taxId && <small>RUC: {taxId}</small>}
            </p>
            <p>
              {formatDate(current?.createdAt ?? new Date())}
              <small>
                {priceTierLabels[tier]} · {currency} · {labels.payment[payment]}
              </small>
            </p>
          </div>
          <div className="invoice-lines">
            {lines.length === 0 ? (
              <p className="empty-lines">
                Agrega productos para ver el detalle de la factura.
              </p>
            ) : (
              lines.map((line) => (
                <div className="invoice-line" key={line.productId}>
                  <div>
                    <strong>{line.name}</strong>
                    <small>
                      {line.size} · {line.barcode}
                    </small>
                    <span>
                      {formatCurrency(line.prices[tier][currency], currency)}{' '}
                      por unidad
                    </span>
                  </div>
                  <div className="invoice-line-quantity">
                    <Input
                      label={`Cantidad de ${line.name}`}
                      type="number"
                      min={1}
                      max={9999}
                      step={1}
                      value={Number.isNaN(line.quantity) ? '' : line.quantity}
                      onChange={(e) =>
                        setLines(
                          lines.map((item) =>
                            item.productId === line.productId
                              ? { ...item, quantity: e.target.valueAsNumber }
                              : item,
                          ),
                        )
                      }
                    />
                    <Button
                      className="no-print"
                      variant="ghost"
                      aria-label={`Quitar ${line.name}`}
                      onClick={() =>
                        setLines(
                          lines.filter(
                            (item) => item.productId !== line.productId,
                          ),
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                  <strong>
                    {Number.isInteger(line.quantity) &&
                    line.quantity > 0 &&
                    line.quantity <= 9999
                      ? formatCurrency(
                          (Math.round(line.prices[tier][currency] * 100) *
                            line.quantity) /
                            100,
                          currency,
                        )
                      : 'Revisar cantidad'}
                  </strong>
                </div>
              ))
            )}
          </div>
          <div className="invoice-total">
            <span>Total del borrador</span>
            <strong>
              {total === null
                ? 'Revisar cantidades'
                : formatCurrency(total, currency)}
            </strong>
          </div>
          <label className="field no-print">
            <span>Notas del pedido</span>
            <textarea
              rows={2}
              maxLength={1500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <p className="print-only">{notes}</p>
          <p className="invoice-notice">
            Borrador sin emitir. No registra una venta ni descuenta existencias.
            Precios de la lista seleccionada; sin cálculo de impuestos.
          </p>
          <div className="form-actions no-print">
            <Button onClick={saveDraft} disabled={!lines.length || !valid}>
              <Save size={17} />
              Guardar borrador
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.print()}
              disabled={!lines.length || !valid}
            >
              <Printer size={17} />
              Imprimir borrador
            </Button>
          </div>
          {message && (
            <p role="status" className="page-feedback no-print">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="inline-error no-print">
              {error}
            </p>
          )}
        </Card>
      </div>
    </>
  )
}
