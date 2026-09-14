import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowDownToLine, BadgeDollarSign, BookOpen, Coins, Plus, ReceiptText, Upload, Wallet } from 'lucide-react'
import { Badge, Button, Card, Dialog, EmptyState, Input, Select } from '../../components/ui'
import { useAccess } from '../../app/AccessContext'
import { useServices } from '../../services/useServices'
import { useQuery } from '../../lib/useQuery'
import { can } from '../../lib/permissions'
import { errorMessage } from '../../lib/errors'
import { formatCurrency, formatDate } from '../../lib/format'
import { createIdempotentOperation } from '../../lib/idempotentOperation'
import { labels, type Currency, type InventoryLocation } from '../../lib/domain'
import { priceTierLabels } from '../../lib/pricing'
import { totalStock } from '../inventory/model'
import { accountingByMonth, accountingSummary, belowCostSales, catalogMargins, emptyAccounting, expenseCategories, inventoryTurnover, marginRate, type ExpenseCategory, type ExpenseInput, type OpeningCostInput, type PurchaseInput } from './accounting'
import { parseOpeningCosts, type OpeningCostParse } from './openingCostImport'
import { localDay, type ReportRange, type ReportSource } from './model'
import './accounting.css'

const money = (amount: number) => formatCurrency(amount, 'NIO')
const percent = new Intl.NumberFormat('es-NI', { style: 'percent', maximumFractionDigits: 1 })
const ratio = new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 })
const monthName = new Intl.DateTimeFormat('es-NI', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const tabs = { summary: 'Resumen', purchases: 'Compras', prices: 'Costos y precios', expenses: 'Gastos' } as const
type Section = keyof typeof tabs
type Action = { kind: 'purchase' | 'opening' | 'expense'; productId?: string } | { kind: 'void'; expenseId: string } | { kind: 'bulk' }
const inPeriod = (day: string, range: ReportRange) => day >= range.from && day <= range.to

export function AccountingPanel({ source, range, onRecorded }: { source: ReportSource; range: ReportRange; onRecorded: () => void }) {
  const { demo, role } = useAccess()
  const { settingsService } = useServices()
  const { data: savedRate } = useQuery(settingsService.getExchangeRate)
  const ledger = source.accounting ?? emptyAccounting
  const summary = useMemo(() => accountingSummary(source, range), [source, range])
  const turnover = useMemo(() => inventoryTurnover(summary, range), [summary, range])
  const losses = useMemo(() => belowCostSales(source, range), [source, range])
  const margins = useMemo(() => catalogMargins(source), [source])
  const months = useMemo(() => accountingByMonth(source, range), [source, range])
  const [section, setSection] = useState<Section>('summary')
  const [action, setAction] = useState<Action | null>(null)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [page, setPage] = useState(0)
  const writable = ledger.available && !demo && can(role, 'product.edit_cost')
  const costs = new Map(ledger.costs.map((cost) => [cost.productId, cost.averageCostNio]))
  const purchases = ledger.purchases.filter((item) => inPeriod(item.incurredOn, range)).sort((a, b) => b.incurredOn.localeCompare(a.incurredOn))
  const expenses = ledger.expenses.filter((item) => inPeriod(item.incurredOn, range)).sort((a, b) => b.incurredOn.localeCompare(a.incurredOn))
  const products = source.inventory.filter((item) => {
    const product = item.product
    return (!onlyMissing || costs.get(product.id) == null) && `${product.brand} ${product.name} ${product.barcode}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es').trim())
  })
  const currentPage = Math.min(page, Math.max(0, Math.ceil(products.length / 30) - 1))
  const value = (amount: number | null) => !ledger.available ? 'Sin activar' : amount === null ? 'Pendiente' : money(amount)

  return <section className="accounting-panel" aria-label="Contabilidad del negocio">
    <div className="accounting-heading">
      <div><span className="eyebrow">LA CASA DEL PERFUME · CONTROL DEL NEGOCIO</span><h2>Costos, margen y gastos</h2><p>Del {formatDate(range.from)} al {formatDate(range.to)} · Consolidado en córdobas con el tipo de cambio de cada operación.</p></div>
      <div className="accounting-badges">
        <Badge tone="neutral"><BookOpen size={14} /> Promedio ponderado</Badge>
        {savedRate && <Badge tone="neutral"><Coins size={14} /> 1 USD = {savedRate.usdToNio} C$</Badge>}
      </div>
    </div>
    {(demo || !ledger.available) && <div className="accounting-callout" role="status"><strong>{demo ? 'Explora el módulo contable' : 'El registro contable está pendiente de activar'}</strong><p>{demo ? 'Las compras, los costos y los gastos de esta vista son inventados, para poder recorrer las pantallas antes de conectar la base de datos. No se puede registrar nada aquí.' : 'La base de datos necesita la actualización de contabilidad para registrar compras, costos iniciales y gastos. Los reportes de ventas siguen disponibles.'} Los precios del catálogo son precios de venta; no se usan como costos de compra.</p></div>}
    {ledger.available && !summary.complete && <div className="accounting-callout" role="status"><strong>El resultado del período está incompleto</strong><p>{summary.missingCostUnits > 0 && `${summary.missingCostUnits} unidades vendidas sin costo registrado. `}{summary.missingRevenueLines > 0 && `${summary.missingRevenueLines} renglones sin desglose de venta o tipo de cambio. `}{summary.missingWriteOffUnits > 0 && `${summary.missingWriteOffUnits} unidades de salida o merma sin costo. `}{(source.truncated || ledger.truncated) && 'La consulta alcanzó su límite; selecciona un período más corto. '}Las cifras conocidas se muestran por separado; la utilidad queda pendiente hasta tener información completa.</p></div>}
    {message && <p role="status" className="page-feedback">{message}</p>}
    <nav className="accounting-tabs" aria-label="Secciones contables">{Object.entries(tabs).map(([id, label]) => <button key={id} type="button" aria-pressed={section === id} aria-controls="accounting-content" onClick={() => setSection(id as Section)}>{label}</button>)}</nav>
    <div id="accounting-content">
      {section === 'summary' && <>
        <div className="accounting-metrics">
          <Metric label="Ventas netas registradas" amount={value(summary.revenueNio)} note="Facturas sin el impuesto incluido" icon={<BadgeDollarSign size={19} />} />
          <Metric label="Costo de lo vendido" amount={value(summary.costOfSalesNio)} note={summary.missingCostUnits ? `${summary.missingCostUnits} unidades pendientes de costo` : 'Costo guardado al emitir cada venta'} icon={<ArrowDownToLine size={19} />} />
          <Metric label="Margen bruto" amount={value(summary.grossProfitNio)} note="Ventas netas menos costo vendido" />
          <Metric label="Gastos reconocidos" amount={value(summary.expensesNio)} note="Incluye impuestos no recuperables" icon={<ReceiptText size={19} />} />
          <Metric label="Mermas y otras salidas" amount={value(summary.inventoryWriteOffNio)} note="Costo de daños, salidas y ajustes negativos" />
          <Metric label="Resultado operativo registrado" amount={value(summary.netProfitNio)} note="Margen menos gastos, mermas y salidas" icon={<Wallet size={19} />} highlight />
        </div>
        <div className="accounting-two-columns">
          <Card className="accounting-card"><h3>Impuestos registrados</h3><dl className="accounting-breakdown"><Line label="Incluido en ventas" amount={value(summary.salesTaxNio)} /><Line label="Impuestos en compras" amount={value(summary.purchaseTaxNio)} /><Line label="Impuestos en gastos" amount={value(summary.expenseTaxNio)} /><Line label="Marcados como recuperables" amount={value(summary.recoverableTaxNio)} /></dl><p className="accounting-note">El importe recuperable se registra según los comprobantes del negocio. Estos valores no determinan una declaración ni un impuesto a pagar.</p></Card>
          <Card className="accounting-card"><h3>Capital en productos</h3><dl className="accounting-breakdown"><Line label="Inventario actual a costo conocido" amount={value(summary.inventoryCostNio)} /><Line label="Compras incorporadas al costo" amount={value(summary.purchasesNio)} /><Line label="Productos sin valoración completa" amount={String(summary.unvaluedProducts)} /><Line label="Rotación anual del inventario" amount={turnover.turnoverPerYear === null ? 'Pendiente' : `${ratio.format(turnover.turnoverPerYear)} veces`} /><Line label="Días que dura el inventario" amount={turnover.daysOnHand === null ? 'Pendiente' : `${ratio.format(turnover.daysOnHand)} días`} /></dl><p className="accounting-note">El inventario muestra las existencias actuales. Las compras corresponden al período elegido e incluyen flete e impuestos no recuperables. La rotación proyecta a un año el costo vendido del período y queda pendiente mientras haya productos sin costo.</p><Button variant="secondary" onClick={() => setSection('prices')}>Revisar costos y precios</Button></Card>
        </div>
        {losses.length > 0 && <Card className="accounting-card accounting-alert"><div className="section-heading"><div><h3>Ventas por debajo del costo</h3><p className="accounting-note">Renglones donde el costo congelado al emitir superó la venta neta. Sólo aparecen los que tienen ambas cifras registradas.</p></div><Badge tone="danger">{money(losses.reduce((total, row) => total + row.lossNio, 0))} de pérdida</Badge></div>
          <LedgerTable label="Ventas por debajo del costo" headings={['Documento', 'Producto', 'Unidades', 'Venta neta', 'Costo', 'Pérdida']}>
            {losses.slice(0, 25).map((row) => <tr key={`${row.documentId}:${row.productId}`}><th scope="row">{row.number}<small>{formatDate(row.createdAt)}</small></th><td>{row.description}</td><td>{row.quantity}</td><td>{money(row.netRevenueNio)}</td><td>{money(row.costNio)}</td><td>{money(row.lossNio)}</td></tr>)}
          </LedgerTable>
          {losses.length > 25 && <p className="accounting-note">Se muestran las 25 mayores de {losses.length}. La exportación a Excel las incluye todas.</p>}
        </Card>}
        <Card className="accounting-card"><div className="section-heading"><div><h3>Rentabilidad por producto vendido</h3><p className="accounting-note">El costo histórico de una venta se conserva aunque cambie el precio de compra.</p></div><Badge tone={summary.complete ? 'success' : 'warning'}>{summary.coverage === null ? 'Sin ventas' : `${Math.round(summary.coverage * 100)} % con costo`}</Badge></div>
          {summary.products.length ? <LedgerTable label="Rentabilidad por producto" headings={['Producto', 'Unidades', 'Venta neta', 'Costo conocido', 'Margen bruto']}>
            {summary.products.map((item) => <tr key={item.productId}><th scope="row">{item.description}{item.missingUnits > 0 && <small>{item.missingUnits} unidades sin costo</small>}</th><td>{item.quantity}</td><td>{money(item.netRevenueNio)}</td><td>{money(item.costNio)}</td><td>{item.profitNio === null ? <Badge tone="warning">Pendiente</Badge> : money(item.profitNio)}</td></tr>)}
          </LedgerTable> : <EmptyState title="Sin ventas en este período" description="Las facturas emitidas aparecerán aquí con el costo que tenían al venderse." />}
        </Card>
        <div className="accounting-two-columns accounting-wide-left">
          <Card className="accounting-card"><h3>Rentabilidad por lista de precios</h3><p className="accounting-note">Lo vendido en el período con cada lista, y el margen que la lista deja hoy sobre el costo promedio de todo el catálogo.</p>
            <LedgerTable label="Rentabilidad por lista de precios" headings={['Lista', 'Venta neta del período', 'Margen del período', 'Margen hoy']}>
              {margins.map((catalog) => {
                const sold = summary.tiers.find((row) => row.tier === catalog.tier)
                return <tr key={catalog.tier}><th scope="row">{priceTierLabels[catalog.tier]}{catalog.belowCost > 0 && <small className="accounting-thin">{catalog.belowCost} producto(s) por debajo del costo</small>}</th><td>{sold ? <>{money(sold.netRevenueNio)}<small>costo {money(sold.costNio)}</small></> : '—'}</td><td>{!sold ? '—' : sold.profitNio === null ? <Badge tone="warning">Pendiente</Badge> : money(sold.profitNio)}</td><td>{catalog.medianMargin === null ? <Badge tone="warning">Sin costos</Badge> : percent.format(catalog.medianMargin)}<small>mediana de {catalog.priced} producto(s)</small></td></tr>
              })}
            </LedgerTable>
          </Card>
          <Card className="accounting-card"><h3>Gastos por categoría</h3><p className="accounting-note">Gastos vigentes del período, con sus impuestos no recuperables incluidos.</p>
            {summary.expenseGroups.length ? <dl className="accounting-breakdown">{[...summary.expenseGroups].sort((a, b) => b.amountNio - a.amountNio).map((group) => <Line key={group.category} label={expenseCategories[group.category]} amount={money(group.amountNio)} />)}<Line label="Total de gastos" amount={value(summary.expensesNio)} /></dl> : <EmptyState title="Sin gastos en este período" description="Registra alquiler, servicios y demás gastos para conocer el resultado real del negocio." />}
            <Button variant="secondary" onClick={() => setSection('expenses')}>Ir a gastos</Button>
          </Card>
        </div>
        <Card className="accounting-card"><h3>Evolución mes a mes</h3><p className="accounting-note">Cada mes calendario recortado al período elegido, con el mismo criterio de la contabilidad. Una utilidad pendiente indica meses con información incompleta.</p>
          <LedgerTable label="Evolución mensual del resultado" headings={['Mes', 'Venta neta', 'Costo de ventas', 'Gastos y mermas', 'Resultado']}>
            {months.map(({ month, totals }) => <tr key={month}><th scope="row">{monthName.format(new Date(`${month}-01T12:00:00Z`))}</th><td>{money(totals.revenueNio)}</td><td>{money(totals.costOfSalesNio)}</td><td>{money(totals.expensesNio + totals.inventoryWriteOffNio)}</td><td>{totals.netProfitNio === null ? <Badge tone="warning">Pendiente</Badge> : money(totals.netProfitNio)}</td></tr>)}
          </LedgerTable>
        </Card>
        <p className="accounting-note">Control administrativo basado en operaciones registradas. El resultado incluye ventas pendientes de pago; no representa saldo de caja ni balance general.</p>
      </>}
      {section === 'purchases' && <Card className="accounting-card"><div className="section-heading"><div><h3>Compras de productos</h3><p className="accounting-note">Cada compra recibida suma existencias y actualiza el costo promedio ponderado.</p></div><Button disabled={!writable} onClick={() => setAction({ kind: 'purchase' })}><Plus size={17} />Registrar compra</Button></div>
        <p className="accounting-formula">Nuevo promedio = (valor del inventario existente + costo de la compra recibida) ÷ unidades totales.</p>
        {purchases.length ? <LedgerTable label="Compras del período" headings={['Fecha / proveedor', 'Producto / destino', 'Unidades', 'Compra original', 'Impuestos / recuperable', 'Costo unitario NIO']}>
          {purchases.map((purchase) => <tr key={purchase.id}><th scope="row">{formatDate(purchase.incurredOn)}<small>{purchase.supplier || 'Sin proveedor'} · {purchase.reference || 'Sin referencia'}</small></th><td>{productName(source, purchase.productId)}<small>{labels.location[purchase.location]}</small></td><td>{purchase.quantity}</td><td>{formatCurrency(purchase.quantity * purchase.unitPrice + purchase.freightAmount + purchase.taxAmount, purchase.currency)}<small>{purchase.currency === 'USD' ? `TC ${purchase.exchangeRate} NIO/USD` : 'Moneda: NIO'}</small></td><td>{formatCurrency(purchase.taxAmount, purchase.currency)}<small>Recuperable: {formatCurrency(purchase.recoverableTaxAmount, purchase.currency)}</small></td><td>{money(purchase.landedUnitCostNio)}</td></tr>)}
        </LedgerTable> : <EmptyState title="Aún no hay compras registradas" description="Registra el costo de compra del proveedor, el flete y los impuestos de la mercancía recibida." />}
      </Card>}
      {section === 'prices' && <Card className="accounting-card"><div className="section-heading"><div><h3>Costos reales y precios de venta</h3><p className="accounting-note">El costo promedio es independiente de las listas Emprendedor, VIP y Premium. El porcentaje bajo cada precio es lo que queda de ese precio después del costo.</p></div><div className="accounting-actions"><Button variant="secondary" disabled={!writable} onClick={() => setAction({ kind: 'bulk' })}><Upload size={17} />Cargar costos desde lista</Button><Button disabled={!writable} onClick={() => setAction({ kind: 'opening' })}><Plus size={17} />Registrar costo inicial</Button></div></div>
        <div className="accounting-search"><Input label="Buscar producto" placeholder="Nombre, marca o código" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} /><label className="accounting-checkbox"><input type="checkbox" checked={onlyMissing} onChange={(event) => { setOnlyMissing(event.target.checked); setPage(0) }} />Solo sin costo registrado</label></div>
        <p className="accounting-note">Precios de venta actuales, con el impuesto que corresponda. Los precios en USD se muestran en su moneda original; no se convierten sin una operación con tipo de cambio.</p>
        {products.length ? <LedgerTable label="Comparación de costos y precios actuales" headings={['Producto', 'Existencia actual', 'Costo promedio NIO', ...Object.values(priceTierLabels), '']}>
          {products.slice(currentPage * 30, (currentPage + 1) * 30).map((item) => {
            const cost = costs.get(item.product.id)
            const stock = totalStock(item)
            return <tr key={item.product.id}><th scope="row">{item.product.brand} {item.product.name}<small>{item.product.barcode} · {item.product.size ?? '?'} {item.product.unit}</small></th><td>{stock === null ? 'Sin conteo completo' : `${stock} uds.`}</td><td>{cost == null ? <Badge tone="warning">Sin costo</Badge> : money(cost)}</td>{(['emprendedor', 'vip', 'premium'] as const).map((tier) => {
              const rate = item.product.prices ? marginRate(item.product.prices[tier].NIO, cost) : null
              return <td key={tier}>{item.product.prices ? <>{money(item.product.prices[tier].NIO)}<small>{formatCurrency(item.product.prices[tier].USD, 'USD')}</small><small className={rate !== null && rate < 0.15 ? 'accounting-thin' : undefined}>{rate === null ? 'Margen pendiente' : `Margen ${percent.format(rate)}`}</small></> : 'Sin precio por lista'}</td>
            })}<td>{cost == null && <Button variant="ghost" disabled={!writable || stock === null || stock <= 0} aria-label={`Registrar costo inicial de ${item.product.name}`} onClick={() => setAction({ kind: 'opening', productId: item.product.id })}>Registrar costo</Button>}</td></tr>
          })}
        </LedgerTable> : <EmptyState title="Sin productos para este filtro" description="Prueba otro nombre o desmarca el filtro de costos pendientes." />}
        {products.length > 30 && <div className="accounting-pagination"><span>{currentPage * 30 + 1}–{Math.min((currentPage + 1) * 30, products.length)} de {products.length}</span><Button variant="secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</Button><Button variant="secondary" disabled={(currentPage + 1) * 30 >= products.length} onClick={() => setPage(currentPage + 1)}>Siguiente</Button></div>}
      </Card>}
      {section === 'expenses' && <Card className="accounting-card"><div className="section-heading"><div><h3>Gastos del negocio</h3><p className="accounting-note">Alquiler, servicios y otros gastos, con sus comprobantes e impuestos.</p></div><Button disabled={!writable} onClick={() => setAction({ kind: 'expense' })}><Plus size={17} />Registrar gasto</Button></div>
        {expenses.length ? <LedgerTable label="Gastos del período" headings={['Fecha / categoría', 'Descripción', 'Importe original', 'Gasto reconocido NIO', 'Estado', '']}>
          {expenses.map((expense) => <tr key={expense.id} className={expense.voidedAt ? 'accounting-voided' : undefined}><th scope="row">{formatDate(expense.incurredOn)}<small>{expenseCategories[expense.category]}</small></th><td>{expense.description}<small>{expense.reference || 'Sin referencia'}</small></td><td>{formatCurrency(expense.amount + expense.taxAmount, expense.currency)}<small>Impuesto: {formatCurrency(expense.taxAmount, expense.currency)} · Recuperable: {formatCurrency(expense.recoverableTaxAmount, expense.currency)}</small>{expense.currency === 'USD' && <small>TC {expense.exchangeRate} NIO/USD</small>}</td><td>{money((expense.amount + expense.taxAmount - expense.recoverableTaxAmount) * expense.exchangeRate)}</td><td><Badge tone={expense.voidedAt ? 'neutral' : 'success'}>{expense.voidedAt ? 'Anulado' : 'Registrado'}</Badge>{expense.voidedAt && <small>{expense.voidReason}</small>}</td><td>{!expense.voidedAt && <Button variant="ghost" disabled={!writable} onClick={() => setAction({ kind: 'void', expenseId: expense.id })} aria-label={`Anular gasto ${expense.description}`}>Anular</Button>}</td></tr>)}
        </LedgerTable> : <EmptyState title="Aún no hay gastos registrados" description="Los gastos del período se restarán del margen bruto para mostrar el resultado operativo." />}
      </Card>}
    </div>
    {action?.kind === 'bulk'
      ? <BulkOpeningCosts source={source} writable={writable} defaultRate={savedRate?.usdToNio ?? null} onClose={() => setAction(null)} onRecorded={(text) => { setMessage(text); onRecorded() }} />
      : action && <AccountingAction key={JSON.stringify(action)} action={action} source={source} writable={writable} defaultRate={savedRate?.usdToNio ?? null} onClose={() => setAction(null)} onRecorded={(text) => { setAction(null); setMessage(text); onRecorded() }} />}
  </section>
}

/**
 * Loading 260 opening costs one dialog at a time is not a workflow anybody
 * finishes. The list is resolved against the catalogue before anything is
 * written, and each row is sent as its own operation so one rejected product
 * never discards the rest.
 */
function BulkOpeningCosts({ source, writable, defaultRate, onClose, onRecorded }: { source: ReportSource; writable: boolean; defaultRate: number | null; onClose: () => void; onRecorded: (message: string) => void }) {
  const { accountingService } = useServices()
  const [text, setText] = useState('')
  const [currency, setCurrency] = useState<Currency>('NIO')
  const [exchange, setExchange] = useState(defaultRate ? String(defaultRate) : '')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)
  const [outcome, setOutcome] = useState<{ saved: number; failures: { label: string; reason: string }[] } | null>(null)
  const parsed: OpeningCostParse = useMemo(() => parseOpeningCosts(text, source), [text, source])
  const rate = currency === 'NIO' ? 1 : Number(exchange)
  const ready = writable && !busy && parsed.rows.length > 0 && note.trim().length >= 3 && Number.isFinite(rate) && rate > 0

  async function run() {
    if (!ready) return
    setBusy(true)
    setDone(0)
    const failures: { label: string; reason: string }[] = []
    let saved = 0
    // Sequential on purpose: each write locks the product and its balances, so
    // firing 260 at once would just queue them behind each other in Postgres.
    for (const row of parsed.rows) {
      try {
        await accountingService.setOpeningCost({ requestId: crypto.randomUUID(), productId: row.productId, unitCost: row.unitCost, currency, exchangeRate: rate, note: note.trim() })
        saved++
      } catch (error) {
        failures.push({ label: `${row.code} · ${row.description}`, reason: errorMessage(error) })
      }
      setDone((value) => value + 1)
    }
    setBusy(false)
    setOutcome({ saved, failures })
    onRecorded(`${saved} costo(s) inicial(es) registrado(s)${failures.length ? `; ${failures.length} producto(s) no se pudieron guardar.` : '.'}`)
  }

  return <Dialog open title="Cargar costos iniciales desde una lista" onClose={() => { if (!busy) onClose() }}><div className="accounting-form">
    {outcome ? <>
      <p><strong>{outcome.saved}</strong> producto(s) quedaron con su costo inicial registrado.</p>
      {outcome.failures.length > 0 && <><p className="accounting-note">Estos no se guardaron. Su costo sigue pendiente y puedes volver a intentarlo.</p>
        <ul className="accounting-problems">{outcome.failures.map((failure) => <li key={failure.label}><strong>{failure.label}</strong><span>{failure.reason}</span></li>)}</ul></>}
      <div className="form-actions"><Button onClick={onClose}>Cerrar</Button></div>
    </> : <>
      <p className="accounting-callout">Pega una columna con el código del producto y otra con su costo de compra por unidad, tal como sale de Excel. El costo debe incluir el flete y los impuestos que no recuperas. Se registra sobre las existencias contadas actuales y no modifica cantidades ni ventas pasadas.</p>
      <label className="field">
        <span>Lista de códigos y costos</span>
        <textarea rows={8} disabled={busy} value={text} placeholder={'7501234567890\t420.50\n7501234567891\t515'} onChange={(event) => setText(event.target.value)} />
      </label>
      <div className="form-grid">
        <Select label="Moneda de los costos" value={currency} disabled={busy} onChange={(event) => setCurrency(event.target.value as Currency)}><option value="NIO">NIO · Córdobas</option><option value="USD">USD · Dólares</option></Select>
        {currency === 'USD' && <Input label="Tipo de cambio (NIO por 1 USD)" type="number" min="0.000001" max={1000000} step="0.000001" required disabled={busy} value={exchange} onChange={(event) => setExchange(event.target.value)} />}
      </div>
      <Input label="Origen del costo / comprobante" required minLength={3} maxLength={500} disabled={busy} value={note} onChange={(event) => setNote(event.target.value)} />
      {text.trim() && <div className="accounting-form-total"><span>Listas para registrar</span><strong>{parsed.rows.length} producto(s)</strong>{parsed.problems.length > 0 && <small>{parsed.problems.length} fila(s) se omitirán.</small>}</div>}
      {parsed.rows.length > 0 && <LedgerTable label="Costos por registrar" headings={['Producto', 'Existencias', `Costo unitario ${currency}`, 'Inventario a costo NIO']}>
        {parsed.rows.slice(0, 12).map((row) => <tr key={row.productId}><th scope="row">{row.description}<small>{row.code}</small></th><td>{row.stock} uds.</td><td>{formatCurrency(row.unitCost, currency)}</td><td>{rate > 0 ? money(row.unitCost * rate * row.stock) : '—'}</td></tr>)}
      </LedgerTable>}
      {parsed.rows.length > 12 && <p className="accounting-note">Se muestran las primeras 12 de {parsed.rows.length} filas.</p>}
      {parsed.problems.length > 0 && <ul className="accounting-problems">{parsed.problems.slice(0, 15).map((problem) => <li key={problem.line}><strong>Línea {problem.line}: {problem.text}</strong><span>{problem.reason}</span></li>)}{parsed.problems.length > 15 && <li><span>…y {parsed.problems.length - 15} fila(s) más con problemas.</span></li>}</ul>}
      {busy && <p role="status" className="accounting-note">Guardando {done} de {parsed.rows.length}…</p>}
      <div className="form-actions"><Button disabled={!ready} onClick={() => void run()}>{busy ? 'Guardando…' : `Registrar ${parsed.rows.length} costo(s)`}</Button><Button variant="secondary" disabled={busy} onClick={onClose}>Cancelar</Button></div>
    </>}
  </div></Dialog>
}

function Metric({ label, amount, note, icon, highlight = false }: { label: string; amount: string; note: string; icon?: ReactNode; highlight?: boolean }) {
  return <div className={`accounting-metric ${highlight ? 'accounting-metric-highlight' : ''}`}><span>{label}{icon}</span><strong>{amount}</strong><small>{note}</small></div>
}
function Line({ label, amount }: { label: string; amount: string }) { return <div><dt>{label}</dt><dd>{amount}</dd></div> }
function LedgerTable({ label, headings, children }: { label: string; headings: string[]; children: ReactNode }) { return <div className="accounting-table-scroll" tabIndex={0} role="region" aria-label={label}><table className="accounting-table"><caption className="sr-only">{label}</caption><thead><tr>{headings.map((heading, index) => <th scope="col" key={index}>{heading || <span className="sr-only">Actions</span>}</th>)}</tr></thead><tbody>{children}</tbody></table></div> }
function productName(source: ReportSource, productId: string) { const product = source.inventory.find((item) => item.product.id === productId)?.product; return product ? `${product.brand} ${product.name}` : 'Producto fuera del catálogo actual' }

function AccountingAction({ action, source, writable, defaultRate, onClose, onRecorded }: { action: Exclude<Action, { kind: 'bulk' }>; source: ReportSource; writable: boolean; defaultRate: number | null; onClose: () => void; onRecorded: (message: string) => void }) {
  const { accountingService } = useServices()
  const [purchaseOperation] = useState(() => createIdempotentOperation<Omit<PurchaseInput, 'requestId'>, unknown>(accountingService.recordPurchase))
  const [openingOperation] = useState(() => createIdempotentOperation<Omit<OpeningCostInput, 'requestId'>, unknown>(accountingService.setOpeningCost))
  const [expenseOperation] = useState(() => createIdempotentOperation<Omit<ExpenseInput, 'requestId'>, unknown>(accountingService.recordExpense))
  const [productId, setProductId] = useState('productId' in action ? action.productId ?? '' : '')
  const [currency, setCurrency] = useState<Currency>('NIO')
  const [location, setLocation] = useState<InventoryLocation>('warehouse')
  const [incurredOn, setIncurredOn] = useState(localDay(new Date()))
  const [quantity, setQuantity] = useState('1')
  const [amount, setAmount] = useState('')
  const [freight, setFreight] = useState('0')
  const [taxAmount, setTaxAmount] = useState('0')
  const [recoverable, setRecoverable] = useState('0')
  const [exchange, setExchange] = useState(defaultRate ? String(defaultRate) : '')
  const [supplier, setSupplier] = useState('')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('otros')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const isPurchase = action.kind === 'purchase'
  const isOpening = action.kind === 'opening'
  const isVoid = action.kind === 'void'
  const rate = currency === 'NIO' ? 1 : Number(exchange)
  const quantityNumber = isPurchase ? Number(quantity) : 1
  const baseAmount = Number(amount) * quantityNumber
  const totalCost = baseAmount + (isPurchase ? Number(freight) : 0) + (isOpening ? 0 : Number(taxAmount) - Number(recoverable))
  const selected = source.inventory.find((item) => item.product.id === productId)
  const stock = selected ? totalStock(selected) : null
  const titles = { purchase: 'Registrar compra recibida', opening: 'Registrar costo inicial', expense: 'Registrar gasto', void: 'Anular gasto' }
  const validTax = isOpening || isVoid || Number(recoverable) <= Number(taxAmount)
  const hasExistingCost = (source.accounting?.costs ?? []).some((item) => item.productId === productId && item.averageCostNio !== null)
  const products = source.inventory.filter((item) => !isOpening || (totalStock(item) !== null && (totalStock(item) ?? 0) > 0 && !(source.accounting?.costs ?? []).some((cost) => cost.productId === item.product.id && cost.averageCostNio !== null)))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !writable) return
    setFailure('')
    if (!validTax) { setFailure('El impuesto recuperable no puede superar el impuesto total.'); return }
    if (isOpening && (stock === null || stock <= 0 || hasExistingCost)) { setFailure('El costo inicial requiere existencias contadas y un producto sin costo previo.'); return }
    if (!isVoid && (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(totalCost) || Number(amount) < 0)) { setFailure('Revisa los importes y el tipo de cambio.'); return }
    setBusy(true)
    try {
      if (action.kind === 'void') { await accountingService.voidExpense(action.expenseId, note.trim()); onRecorded('Gasto anulado. Se conserva su registro y el motivo de la anulación.'); return }
      if (action.kind === 'purchase') {
        await purchaseOperation.execute({ productId, location, incurredOn, quantity: Number(quantity), unitPrice: Number(amount), freightAmount: Number(freight), taxAmount: Number(taxAmount), recoverableTaxAmount: Number(recoverable), currency, exchangeRate: rate, supplier: supplier.trim(), reference: reference.trim(), note: note.trim() })
        onRecorded('Compra registrada. Se actualizaron las existencias y el costo promedio ponderado.')
      } else if (action.kind === 'opening') {
        await openingOperation.execute({ productId, unitCost: Number(amount), currency, exchangeRate: rate, note: note.trim() })
        onRecorded('Costo inicial registrado para las existencias actuales. Las ventas anteriores conservan su información original.')
      } else {
        await expenseOperation.execute({ incurredOn, category, description: note.trim(), amount: Number(amount), taxAmount: Number(taxAmount), recoverableTaxAmount: Number(recoverable), currency, exchangeRate: rate, reference: reference.trim() })
        onRecorded('Gasto registrado en el período correspondiente.')
      }
    } catch (error) { setFailure(errorMessage(error)) } finally { setBusy(false) }
  }

  return <Dialog open title={titles[action.kind]} onClose={() => { if (!busy) onClose() }}><form className="accounting-form" onSubmit={submit}><fieldset disabled={busy}>
    {isVoid ? <><p>La anulación excluye este gasto del resultado y conserva el comprobante en el historial.</p><Input label="Motivo de anulación" required minLength={5} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></> : <>
      {(isPurchase || isOpening) && <Select label="Producto" required value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Selecciona un producto</option>{products.map((item) => <option key={item.product.id} value={item.product.id}>{item.product.brand} {item.product.name} · {item.product.barcode}</option>)}</Select>}
      {isOpening && <p className="accounting-callout">Asigna el costo de compra documentado a las {stock ?? '—'} unidades actuales. No modifica cantidades ni recalcula ventas pasadas. Incluye el flete y los impuestos no recuperables en este costo unitario.</p>}
      {isPurchase && <p className="accounting-callout">Registra aquí solo mercancía ya recibida. Esta operación suma unidades al inventario; evita registrar también una entrada manual por la misma compra.</p>}
      <div className="form-grid">
        {!isOpening && <Input label="Fecha del comprobante" type="date" required max={localDay(new Date())} value={incurredOn} onChange={(event) => setIncurredOn(event.target.value)} />}
        {isPurchase && <Select label="Recibido en" value={location} onChange={(event) => setLocation(event.target.value as InventoryLocation)}>{Object.entries(labels.location).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select>}
        {isPurchase && <Input label="Cantidad recibida" type="number" min={1} max={999999} step={1} required value={quantity} onChange={(event) => setQuantity(event.target.value)} />}
        {!isPurchase && !isOpening && <Select label="Categoría del gasto" value={category} onChange={(event) => setCategory(event.target.value as ExpenseCategory)}>{Object.entries(expenseCategories).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select>}
        <Select label="Moneda del comprobante" value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}><option value="NIO">NIO · Córdobas</option><option value="USD">USD · Dólares</option></Select>
        {currency === 'USD' && <Input label="Tipo de cambio (NIO por 1 USD)" type="number" min="0.000001" max={1000000} step="0.000001" required value={exchange} onChange={(event) => setExchange(event.target.value)} />}
        <Input label={isPurchase ? `Precio de compra unitario sin impuesto (${currency})` : isOpening ? `Costo inicial por unidad (${currency})` : `Importe del gasto sin impuesto (${currency})`} type="number" min={0} max={10000000} step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} />
        {isPurchase && <Input label={`Flete total de esta compra (${currency})`} type="number" min={0} max={10000000} step="0.01" required value={freight} onChange={(event) => setFreight(event.target.value)} />}
        {!isOpening && <><Input label={`Impuesto total (${currency})`} type="number" min={0} max={10000000} step="0.01" required value={taxAmount} onChange={(event) => setTaxAmount(event.target.value)} /><Input label={`Parte del impuesto recuperable (${currency})`} type="number" min={0} max={Math.max(0, Number(taxAmount))} step="0.01" required error={!validTax ? 'No puede superar el impuesto total.' : undefined} value={recoverable} onChange={(event) => setRecoverable(event.target.value)} /></>}
        {isPurchase && <Input label="Proveedor" maxLength={200} required value={supplier} onChange={(event) => setSupplier(event.target.value)} />}
        {!isOpening && <Input label="Número de comprobante / referencia" maxLength={200} value={reference} onChange={(event) => setReference(event.target.value)} />}
      </div>
      <Input label={isOpening ? 'Origen del costo / comprobante' : isPurchase ? 'Nota de la compra' : 'Descripción del gasto'} required={!isPurchase} minLength={isPurchase ? undefined : 3} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
      {!isOpening && <p className="accounting-note">Todos los importes se ingresan en {currency}. El impuesto recuperable es una parte del impuesto total; se excluye del costo o gasto reconocido.</p>}
      <div className="accounting-form-total"><span>{isPurchase ? 'Costo de esta compra en NIO' : isOpening ? 'Costo inicial unitario en NIO' : 'Gasto reconocido en NIO'}</span><strong>{amount !== '' && rate > 0 && validTax && Number.isFinite(totalCost) ? money(totalCost * rate) : 'Completa los importes'}</strong>{isPurchase && quantityNumber > 0 && amount !== '' && rate > 0 && validTax && <small>{money(totalCost * rate / quantityNumber)} por unidad recibida</small>}</div>
    </>}
    {failure && <p role="alert" className="inline-error">{failure}</p>}
    <div className="form-actions"><Button type="submit" disabled={!writable || !validTax}>{busy ? 'Guardando…' : isVoid ? 'Anular gasto' : isPurchase ? 'Registrar compra y recibir' : 'Guardar registro'}</Button><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button></div>
  </fieldset></form></Dialog>
}
