import { Brand } from '../../components/Brand'
import { documentCopy, labels, type DocumentRecord } from '../../lib/domain'
import { formatCurrency, formatDate } from '../../lib/format'
import { priceTierLabels } from '../../lib/pricing'
import { includedTax } from './document'
export function DocumentPrint({ document: d }: { document: DocumentRecord }) {
  const copy = documentCopy[d.kind]
  const tax = d.taxRate === undefined || d.taxRate === null ? null : includedTax(d.total, d.taxRate)
  return (
    <article className={`letter-document letter-${d.kind}`}>
      <header className="letter-header">
        <div>
          <Brand wordmark />
          <p>
            {d.issuer.address ||
              'Dirección: __________________________________'}
          </p>
          <p>
            {d.issuer.phone
              ? `Tel. ${d.issuer.phone}`
              : 'Teléfono: __________________________________'}
          </p>
          <p>RUC del negocio: ____________________________</p>
        </div>
        <div className="letter-stamp">
          <strong>{copy.stamp}</strong>
          <b>{d.number}</b>
          <span>
            {d.previewKind === 'example'
              ? 'EJEMPLO · SIN EMITIR'
              : d.previewKind === 'draft'
                ? 'BORRADOR · SIN EMITIR'
                : 'DOCUMENTO EMITIDO'}
          </span>
          <p>Fecha: {formatDate(d.createdAt)}</p>
        </div>
      </header>
      <section className="letter-client">
        <div>
          <small>CLIENTE / RAZÓN SOCIAL</small>
          <strong>{d.customerName}</strong>
          <span>
            RUC / Identificación:{' '}
            {d.customerTaxId || '________________________'}
          </span>
          <span>Dirección: __________________________________________</span>
        </div>
        <div>
          <span>Teléfono: {d.customerPhone || '________________'}</span>
          <span>Lista: {priceTierLabels[d.tier]}</span>
          <span>
            Moneda: {d.currency === 'NIO' ? 'Córdobas (C$)' : 'Dólares (US$)'}
          </span>
          {d.currency === 'USD' && d.exchangeRate != null && <span>Tipo de cambio: {d.exchangeRate} NIO por USD</span>}
          <span>
            {d.kind === 'proforma'
              ? `Vigencia: ${d.validUntil ? formatDate(d.validUntil) : '____________'}`
              : `Pago: ${d.paymentMethod && d.paymentMethod !== 'pending' ? labels.payment[d.paymentMethod] : 'Pendiente'}`}
          </span>
        </div>
      </section>
      <table className="letter-items">
        <colgroup>
          <col style={{ width: '9%' }} />
          <col style={{ width: '53%' }} />
          <col style={{ width: '19%' }} />
          <col style={{ width: '19%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>CANT.</th>
            <th>DESCRIPCIÓN</th>
            <th>PRECIO UNIT.</th>
            <th>IMPORTE</th>
          </tr>
        </thead>
        <tbody>
          {d.items.map((item) => (
            <tr key={item.id}>
              <td>{item.quantity}</td>
              <td>{item.description}</td>
              <td>{formatCurrency(item.unitPrice, d.currency)}</td>
              <td>{formatCurrency(item.lineTotal, d.currency)}</td>
            </tr>
          ))}
          <tr
            className="letter-spacer"
            style={d.items.length > 6 ? { height: 0 } : undefined}
          >
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
        </tbody>
      </table>
      <section className="letter-summary">
        <div>
          <small>OBSERVACIONES</small>
          <p>{d.notes || 'Gracias por elegir La Casa del Perfume.'}</p>
          {d.kind === 'invoice' && d.location && (
            <p>Entrega desde: {labels.location[d.location]}</p>
          )}
        </div>
        <div>
          <p>
            <span>{tax ? 'Subtotal sin impuesto' : 'Subtotal (sin desglose)'}</span>
            <b>{formatCurrency(tax?.net ?? d.total, d.currency)}</b>
          </p>
          {tax && <p><span>Impuesto incluido ({d.taxRate} %)</span><b>{formatCurrency(tax.tax, d.currency)}</b></p>}
          <p className="letter-grand-total">
            <span>TOTAL {d.currency}</span>
            <b>{formatCurrency(d.total, d.currency)}</b>
          </p>
        </div>
      </section>
      <div className="letter-signatures">
        <span>Elaborado por</span>
        <span>
          {d.kind === 'invoice' ? 'Recibido por' : 'Aceptación del cliente'}
        </span>
      </div>
      <footer className="letter-footer">
        <strong>Gracias por tu confianza.</strong>
        <p>
          {d.previewKind === 'example'
            ? 'Ejemplo de diseño. No registra una venta ni modifica inventario. '
            : d.previewKind === 'draft'
              ? 'Borrador sin emitir. '
              : ''}
          {d.kind === 'invoice'
            ? 'Documento de control administrativo. No es comprobante fiscal. El desglose usa la tasa de impuesto registrada.'
            : 'Cotización sujeta a disponibilidad. No constituye factura ni comprobante de pago.'}
        </p>
      </footer>
    </article>
  )
}
