import { ProductPicker } from './ProductPicker'
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { listContacts } from '../../services/workspace'
import { DocumentPrint } from './DocumentPrint'
import {
  CircleCheckBig,
  FileDown,
  MessageCircle,
  Plus,
  Printer,
  Save,
  Trash2,
} from 'lucide-react'
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
import { useServices } from '../../services/useServices'
import { createIdempotentOperation } from '../../lib/idempotentOperation'
import { useAccess } from '../../app/AccessContext'
import { useQuery } from '../../lib/useQuery'
import { useWorkspaceDrafts } from '../../lib/workspaceDrafts'
import { errorMessage } from '../../lib/errors'
import { formatCurrency, formatDate } from '../../lib/format'
import { documentCopy, labels } from '../../lib/domain'
import type {
  Currency,
  DocumentKind,
  DocumentRecord,
  InventoryLocation,
  PriceTier,
  NewDocument,
} from '../../lib/domain'
import { priceTierLabels } from '../../lib/pricing'
import {
  defaultValidUntil,
  documentDraftSchema,
  draftPreview,
  draftStorageKey,
  draftTotal,
  isoDate,
  type DocumentDraft,
  type DraftLine,
} from './document'
import { whatsappNumber, whatsappUrl } from './whatsapp'
import { shareDocumentPdf } from './pdf'

const paymentOptions = {
  pending: 'Pendiente de pago',
  ...labels.payment,
}

export function DocumentWorkspace({ kind }: { kind: DocumentKind }) {
  const { inventoryService, salesService } = useServices()
  const [operation] = useState(() =>
    createIdempotentOperation<Omit<NewDocument, 'requestId'>, DocumentRecord>(
      salesService.createDocument,
    ),
  )
  const copy = documentCopy[kind]
  const { demo, base } = useAccess()
  const {
    data,
    loading,
    error: loadError,
    retry,
  } = useQuery(inventoryService.getInventory)
  const {
    data: business,
    error: businessError,
    loading: businessLoading,
    retry: retryBusiness,
  } = useQuery(salesService.getBusiness)
  const {
    items: drafts,
    save,
    error,
    loading: draftsLoading,
    retry: retryDrafts,
  } = useWorkspaceDrafts(draftStorageKey(kind), documentDraftSchema)
  const [currency, setCurrency] = useState<Currency>('NIO')
  const [tier, setTier] = useState<PriceTier>('emprendedor')
  const loadCustomers = useCallback(
    () => (demo ? Promise.resolve([]) : listContacts('customers')),
    [demo],
  )
  const {
    data: customers,
    error: customersError,
    retry: retryCustomers,
  } = useQuery(loadCustomers)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [customer, setCustomer] = useState('')
  const [phone, setPhone] = useState('')
  const [taxId, setTaxId] = useState('')
  const [payment, setPayment] = useState<DocumentDraft['payment']>('pending')
  const [location, setLocation] = useState<InventoryLocation>('store')
  const [validUntil, setValidUntil] = useState(defaultValidUntil())
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [current, setCurrent] = useState<{
    id: string
    reference: string
    createdAt: string
  } | null>(null)
  const [issued, setIssued] = useState<DocumentRecord | null>(null)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState(false)

  const valid = lines.every(
    (line) =>
      Number.isInteger(line.quantity) &&
      line.quantity > 0 &&
      line.quantity <= 9999,
  )
  const total = valid ? draftTotal(lines, tier, currency) : null
  const draft: DocumentDraft | null =
    lines.length && valid
      ? {
          id: current?.id ?? 'preview',
          kind,
          reference: current?.reference ?? `${copy.prefix}borrador`,
          customer,
          customerId,
          phone,
          taxId,
          currency,
          tier,
          payment,
          location,
          validUntil,
          notes,
          createdAt: current?.createdAt ?? new Date().toISOString(),
          lines,
        }
      : null
  // What is shared is always what is on screen: the issued document when it
  // exists, otherwise the draft rendered through the very same shape.
  const shareable: DocumentRecord | null =
    issued ?? (draft && business ? draftPreview(draft, business) : null)

  function add(productId: string) {
    const product = data?.find((item) => item.product.id === productId)?.product
    if (!product?.prices) {
      setMessage('Selecciona un producto del catálogo.')
      return
    }
    if (lines.some((line) => line.productId === product.id)) {
      setMessage(
        `El producto ya está en la ${copy.singular}. Puedes cambiar su cantidad.`,
      )
      return
    }
    setIssued(null)
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
  }

  async function saveDraft() {
    if (draftsLoading) {
      setMessage('Espera a que carguen tus borradores.')
      return
    }
    const stamp = current ?? {
      id: crypto.randomUUID(),
      reference: `${copy.prefix}B${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      createdAt: new Date().toISOString(),
    }
    const result = documentDraftSchema.safeParse({
      ...stamp,
      kind,
      customer,
      customerId,
      phone,
      taxId,
      payment,
      location,
      validUntil,
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
      await save([
        result.data,
        ...drafts.filter((item) => item.id !== stamp.id),
      ])
    ) {
      setCurrent(stamp)
      setMessage(
        demo
          ? 'Borrador guardado en este navegador.'
          : 'Borrador guardado en tu cuenta.',
      )
    }
  }

  async function issue() {
    if (!lines.length || !valid || busy || issued || demo) return
    setBusy(true)
    setFailure('')
    setMessage('')
    try {
      const record = await operation.execute({
        kind,
        customerId: customerId ?? undefined,
        customerName: customer.trim(),
        customerTaxId: taxId.trim(),
        customerPhone: whatsappNumber(phone),
        tier,
        currency,
        location: kind === 'invoice' ? location : null,
        paymentMethod: kind === 'invoice' ? payment : null,
        validUntil: kind === 'proforma' ? validUntil : null,
        notes,
        items: lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
        })),
      })
      setIssued(record)
      if (current) await save(drafts.filter((item) => item.id !== current.id))
      setCurrent({
        id: record.id,
        reference: record.number,
        createdAt: record.createdAt,
      })
      setMessage(
        kind === 'invoice'
          ? `Factura ${record.number} emitida. Las existencias ya se descontaron.`
          : `Proforma ${record.number} emitida. No modifica inventario.`,
      )
      retry()
    } catch (issueError) {
      setFailure(errorMessage(issueError))
    } finally {
      setBusy(false)
    }
  }

  function load(item: DocumentDraft) {
    operation.reset()
    setCurrent(item)
    setIssued(null)
    setCurrency(item.currency)
    setTier(item.tier)
    setCustomerId(item.customerId)
    setCustomer(item.customer)
    setPhone(item.phone)
    setTaxId(item.taxId)
    setPayment(item.payment)
    setLocation(item.location)
    setValidUntil(item.validUntil || defaultValidUntil())
    setNotes(item.notes)
    setLines(structuredClone(item.lines))
    setMessage('Borrador abierto. Guarda los cambios al terminar.')
  }

  function clear() {
    operation.reset()
    setCurrent(null)
    setIssued(null)
    setCustomerId(null)
    setCustomer('')
    setPhone('')
    setTaxId('')
    setNotes('')
    setLines([])
    setValidUntil(defaultValidUntil())
    setMessage('')
    setFailure('')
    setPayment('pending')
    setLocation('store')
  }

  function sendWhatsapp() {
    if (!shareable) return
    window.open(whatsappUrl(shareable), '_blank', 'noopener,noreferrer')
    setMessage(
      whatsappNumber(shareable.customerPhone)
        ? 'WhatsApp abierto con el mensaje listo para enviar.'
        : 'WhatsApp abierto. Elige el contacto; el cliente no tiene teléfono guardado.',
    )
  }

  async function sharePdf() {
    if (!shareable) return
    setBusy(true)
    try {
      const outcome = await shareDocumentPdf(shareable)
      setMessage(
        outcome === 'shared'
          ? 'PDF enviado al menú de compartir.'
          : outcome === 'downloaded'
            ? 'PDF descargado. Adjúntalo en WhatsApp Web o en el chat del cliente.'
            : 'Compartir cancelado.',
      )
    } catch (shareError) {
      setFailure(errorMessage(shareError))
    } finally {
      setBusy(false)
    }
  }

  if (loading || businessLoading) return <LoadingState />
  if (loadError) return <ErrorState message={loadError} retry={retry} />
  if (businessError)
    return <ErrorState message={businessError} retry={retryBusiness} />
  const ready = !!lines.length && valid
  return (
    <>
      <div className="page-heading no-print">
        <div>
          <h1>{copy.title}</h1>
          <p className="muted">{copy.subtitle}</p>
        </div>
        <a
          className="button button-secondary"
          href={`${base}/documents/example/${kind}`}
          target="_blank"
          rel="noreferrer"
        >
          Ver ejemplo en carta
        </a>
        <Button variant="secondary" onClick={clear} disabled={busy}>
          <Plus size={18} />
          {kind === 'invoice' ? 'Nueva factura' : 'Nueva proforma'}
        </Button>
      </div>
      {!demo && (
        <p className="no-print">
          <Link
            to={`${base}/${kind === 'invoice' ? 'sales' : 'proformas'}/history`}
          >
            Consultar {kind === 'invoice' ? 'facturas' : 'proformas'} emitidas
          </Link>
        </p>
      )}
      <div className={`invoice-layout doc-${kind} no-print`}>
        <fieldset
          className="invoice-editor no-print"
          disabled={busy || !!issued}
        >
          <Card className="form-card picker-panel">
            <div className="section-heading">
              <div>
                <span className="section-kicker">ELIGE TUS PERFUMES</span>
                <h2>Catálogo a la mano</h2>
              </div>
              <span className="section-counter">
                {lines.length} {lines.length === 1 ? 'agregado' : 'agregados'}
              </span>
            </div>
            <PriceControls
              currency={currency}
              tier={tier}
              onCurrency={(value) => {
                setIssued(null)
                setCurrency(value)
              }}
              onTier={(value) => {
                setIssued(null)
                setTier(value)
              }}
            />
            <ProductPicker
              items={data ?? []}
              currency={currency}
              tier={tier}
              location={location}
              added={lines.map((line) => line.productId)}
              onAdd={add}
            />
          </Card>
          <Card className="form-card">
            <h2>Datos de la {copy.singular}</h2>
            {!demo && (
              <Select
                label="Cliente registrado"
                value={customerId ?? ''}
                onChange={(e) => {
                  const selected = customers?.find(
                    (c) => c.id === e.target.value,
                  )
                  setCustomerId(selected?.id ?? null)
                  setCustomer(selected?.name ?? '')
                  setPhone(selected?.phone ?? '')
                  setTaxId(selected?.taxId ?? '')
                  if (selected?.priceTier)
                    setTier(selected.priceTier as PriceTier)
                }}
              >
                <option value="">Nuevo cliente</option>
                {customers
                  ?.filter((c) => c.active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.phone}
                    </option>
                  ))}
              </Select>
            )}
            {customersError && (
              <ErrorState message={customersError} retry={retryCustomers} />
            )}
            <div className="form-grid">
              <Input
                label="Cliente"
                maxLength={200}
                value={customer}
                disabled={!!customerId}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="Nombre del cliente"
              />
              <Input
                label="WhatsApp del cliente"
                type="tel"
                inputMode="tel"
                maxLength={40}
                value={phone}
                disabled={!!customerId}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="8888 0000"
              />
              <Input
                label="RUC / Identificación del cliente"
                maxLength={80}
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
              />
              {kind === 'invoice' ? (
                <>
                  <Select
                    label="Forma de pago"
                    value={payment}
                    onChange={(e) =>
                      setPayment(e.target.value as DocumentDraft['payment'])
                    }
                  >
                    {Object.entries(paymentOptions).map(([id, label]) => (
                      <option value={id} key={id}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="Sale de"
                    value={location}
                    onChange={(e) =>
                      setLocation(e.target.value as InventoryLocation)
                    }
                  >
                    {Object.entries(labels.location).map(([id, label]) => (
                      <option value={id} key={id}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </>
              ) : (
                <Input
                  label="Válida hasta"
                  type="date"
                  min={isoDate(new Date())}
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              )}
            </div>
          </Card>
          {drafts.length > 0 && (
            <Card className="form-card">
              <h2>Borradores de {copy.plural}</h2>
              <div className="saved-drafts">
                {drafts.map((item) => (
                  <button key={item.id} onClick={() => load(item)}>
                    <strong>
                      {item.reference} · {item.customer || 'Sin cliente'}
                    </strong>
                    <span>
                      {formatCurrency(
                        draftTotal(item.lines, item.tier, item.currency),
                        item.currency,
                      )}{' '}
                      · {formatDate(item.createdAt)}
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </fieldset>
        <Card className="invoice-paper">
          <div className="invoice-heading">
            <Brand wordmark />
            <div>
              <strong>
                {issued ? copy.stamp : `${copy.stamp} · BORRADOR`}
              </strong>
              <span>{current?.reference ?? 'Sin guardar'}</span>
            </div>
          </div>
          <div className="invoice-meta">
            <p>
              {issued?.customerName || customer || 'Cliente por indicar'}
              {(issued ? issued.customerPhone : phone) && (
                <small>WhatsApp: {issued ? issued.customerPhone : phone}</small>
              )}
              {!issued && taxId && <small>RUC: {taxId}</small>}
            </p>
            <p>
              {formatDate(current?.createdAt ?? new Date())}
              <small>
                {priceTierLabels[tier]} · {currency}
                {kind === 'invoice'
                  ? ` · ${paymentOptions[payment]}`
                  : validUntil
                    ? ` · Válida hasta ${formatDate(`${validUntil}T12:00:00`)}`
                    : ''}
              </small>
              {kind === 'invoice' && (
                <small>Sale de {labels.location[location]}</small>
              )}
            </p>
          </div>
          <div className="invoice-lines">
            {issued ? (
              issued.items.map((item) => (
                <div className="invoice-line" key={item.id}>
                  <div>
                    <strong>{item.description}</strong>
                    <span>
                      {formatCurrency(item.unitPrice, issued.currency)} por
                      unidad
                    </span>
                  </div>
                  <span>{item.quantity} uds.</span>
                  <strong>
                    {formatCurrency(item.lineTotal, issued.currency)}
                  </strong>
                </div>
              ))
            ) : lines.length === 0 ? (
              <p className="empty-lines">
                Agrega productos para ver el detalle de la {copy.singular}.
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
                      disabled={busy || !!issued}
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
                      disabled={busy || !!issued}
                      onClick={() => {
                        setIssued(null)
                        setLines(
                          lines.filter(
                            (item) => item.productId !== line.productId,
                          ),
                        )
                      }}
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
            <span>Total de la {copy.singular}</span>
            <strong>
              {issued
                ? formatCurrency(issued.total, issued.currency)
                : total === null
                  ? 'Revisar cantidades'
                  : formatCurrency(total, currency)}
            </strong>
          </div>
          <label className="field no-print">
            <span>Notas</span>
            <textarea
              rows={2}
              maxLength={1500}
              value={notes}
              disabled={busy || !!issued}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <p className="print-only">{notes}</p>
          <p className="invoice-notice">{copy.notice}</p>
          <div className="form-actions no-print">
            <Button
              onClick={issue}
              disabled={demo || !ready || busy || !!issued}
            >
              <CircleCheckBig size={17} />
              {issued
                ? `${copy.stamp} emitida`
                : busy
                  ? 'Emitiendo…'
                  : `Emitir ${copy.singular}`}
            </Button>
            <Button
              variant="secondary"
              onClick={saveDraft}
              disabled={!ready || busy || !!issued || draftsLoading || !!error}
            >
              <Save size={17} />
              Guardar borrador
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.print()}
              disabled={!ready}
            >
              <Printer size={17} />
              Imprimir
            </Button>
          </div>
          <div className="form-actions whatsapp-actions no-print">
            <Button
              className="button-whatsapp"
              onClick={sendWhatsapp}
              disabled={!shareable}
            >
              <MessageCircle size={17} />
              Enviar por WhatsApp
            </Button>
            <Button
              className="button-whatsapp-outline"
              onClick={sharePdf}
              disabled={!shareable || busy}
            >
              <FileDown size={17} />
              Compartir PDF
            </Button>
          </div>
          <p className="whatsapp-hint no-print">
            {demo
              ? 'La vista local comparte el borrador; no emite documentos.'
              : issued
                ? `Se comparte la ${copy.singular} ${issued.number} tal como quedó registrada.`
                : `Aún sin emitir: se comparte el borrador. Emite la ${copy.singular} para enviarla con su número definitivo.`}
          </p>
          {message && (
            <p role="status" className="page-feedback no-print">
              {message}
            </p>
          )}
          {error && (
            <Button variant="secondary" onClick={retryDrafts}>
              Recargar borradores
            </Button>
          )}
          {(failure || error) && (
            <p role="alert" className="inline-error no-print">
              {failure || error}
            </p>
          )}
        </Card>
      </div>
      {shareable && (
        <div className="document-print-root" aria-hidden="true">
          <DocumentPrint document={shareable} />
        </div>
      )}
    </>
  )
}
