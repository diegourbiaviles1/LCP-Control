import { jsPDF } from 'jspdf'
import { documentCopy, labels, type DocumentRecord } from '../../lib/domain'
import { formatCurrency, formatDate } from '../../lib/format'
import { equivalentAmount, priceTierLabels } from '../../lib/pricing'
import { includedTax } from './document'

export function renderDocumentPdf(d: DocumentRecord, logo: Uint8Array): Blob {
  const tax = d.taxRate == null ? null : includedTax(d.total, d.taxRate)
  // La tasa con la que se cotizó este documento, no la del dólar de hoy.
  const rate = d.catalogRate ?? (d.currency === 'USD' ? d.exchangeRate : null)
  const equivalent = equivalentAmount(d.total, d.currency, rate)
  const pdf = new jsPDF({ unit: 'pt', format: 'letter', compress: true })
  const accent: [number, number, number] =
    d.kind === 'invoice' ? [87, 23, 28] : [138, 99, 24]
  const gray: [number, number, number] = [102, 96, 92]
  const left = 36,
    right = 576,
    width = 540
  const columns = [36, 78, 360, 468, 576]
  const money = (n: number) => formatCurrency(n, d.currency).replace(/\s/g, ' ')
  const clean = (s: string) => s.replace(/\s/g, ' ').trim()
  function text(
    s: string | string[],
    x: number,
    y: number,
    size = 9,
    bold = false,
    align: 'left' | 'right' | 'center' = 'left',
  ) {
    pdf
      .setFont('helvetica', bold ? 'bold' : 'normal')
      .setFontSize(size)
      .setTextColor(40, 34, 31)
    pdf.text(s, x, y, { align, lineHeightFactor: 1.3 })
  }
  function wrap(s: string, w: number, size = 9): string[] {
    pdf.setFont('helvetica', 'normal').setFontSize(size)
    return pdf.splitTextToSize(clean(s), w) as string[]
  }
  function header(continued = false) {
    pdf.setFillColor(...accent).rect(left, 27, width, 4, 'F')
    pdf.addImage(logo, 'JPEG', left, 39, 176, 80.19)
    pdf.setFillColor(248, 244, 237).roundedRect(344, 43, 232, 84, 5, 5, 'F')
    text(documentCopy[d.kind].stamp, 560, 67, 19, true, 'right')
    pdf.setTextColor(...accent)
    text(d.number, 560, 88, 12, true, 'right')
    text(
      d.previewKind === 'example'
        ? 'EJEMPLO / SIN EMITIR'
        : d.previewKind === 'draft'
          ? 'BORRADOR / SIN EMITIR'
          : 'DOCUMENTO EMITIDO',
      560,
      108,
      8,
      true,
      'right',
    )
    const address = wrap(
      d.issuer.address || 'Dirección: __________________________________',
      295,
      8,
    )
    text(address, left, 131, 8)
    let y = 131 + address.length * 10.4
    text(
      d.issuer.phone
        ? `Tel. ${d.issuer.phone}`
        : 'Teléfono: __________________________________',
      left,
      y,
      8,
    )
    y += 13
    text('RUC del negocio: ____________________________', left, y, 8)
    text(`Fecha: ${formatDate(d.createdAt)}`, right, 146, 9, false, 'right')
    y = Math.max(174, y + 16)
    const customer = wrap(d.customerName, 310, 10)
    const clientHeight = Math.max(83, 52 + customer.length * 13)
    pdf
      .setDrawColor(211, 200, 188)
      .setLineWidth(0.6)
      .roundedRect(left, y, width, clientHeight, 4, 4)
    text('CLIENTE / RAZÓN SOCIAL', left + 12, y + 15, 7, true)
    text(customer, left + 12, y + 32, 10, true)
    const detailY = y + 36 + customer.length * 13
    text(
      `RUC / Identificación: ${d.customerTaxId || '________________________'}`,
      left + 12,
      detailY,
      8,
    )
    text(
      'Dirección: __________________________________________',
      left + 12,
      detailY + 13,
      8,
    )
    text(`Teléfono: ${d.customerPhone || '________________'}`, 384, y + 17, 8)
    text(`Lista: ${priceTierLabels[d.tier]} / ${d.currency}`, 384, y + 33, 8)
    text(
      d.kind === 'proforma'
        ? `Vigencia: ${d.validUntil ? formatDate(d.validUntil) : '____________'}`
        : `Pago: ${d.paymentMethod && d.paymentMethod !== 'pending' ? labels.payment[d.paymentMethod] : 'Pendiente'}`,
      384,
      y + 49,
      8,
    )
    if (d.currency === 'USD' && d.exchangeRate != null) text(`Cambio: ${d.exchangeRate} NIO por USD`, 384, y + 66, 8)
    else if (continued) text('Continuación del documento', 384, y + 66, 8)
    return y + clientHeight + 16
  }
  function tableHeading(y: number) {
    pdf.setFillColor(...accent).rect(left, y, width, 25, 'F')
    for (const [label, x, align] of [
      ['CANT.', 57, 'center'],
      ['DESCRIPCIÓN', 87, 'left'],
      ['PRECIO UNIT.', 459, 'right'],
      ['IMPORTE', 567, 'right'],
    ] as const) {
      pdf
        .setFont('helvetica', 'bold')
        .setFontSize(8)
        .setTextColor(255, 255, 255)
        .text(label, x, y + 16, { align })
    }
    return y + 25
  }
  function borders(y: number, height: number) {
    pdf.setDrawColor(220, 212, 201).setLineWidth(0.5)
    for (const x of columns) pdf.line(x, y, x, y + height)
    pdf.line(left, y + height, right, y + height)
  }
  let y = tableHeading(header())
  for (const item of d.items) {
    const lines = wrap(item.description, 264, 9)
    let first = true
    while (lines.length) {
      if (y + 29 > 638) {
        pdf.addPage()
        y = tableHeading(header(true))
      }
      const available = Math.max(1, Math.floor((638 - y - 16) / 11.7))
      const part = lines.splice(0, available)
      const height = Math.max(34, part.length * 11.7 + 16)
      borders(y, height)
      text(part, 87, y + 17, 9)
      if (first) {
        text(String(item.quantity), 57, y + 17, 9, false, 'center')
        text(money(item.unitPrice), 459, y + 17, 9, false, 'right')
        text(money(item.lineTotal), 567, y + 17, 9, false, 'right')
        first = false
      }
      y += height
    }
  }
  if (y > 520) {
    pdf.addPage()
    y = header(true)
  } else {
    borders(y, 520 - y)
    y = 520
  }
  const summaryTop = y + 19
  text('OBSERVACIONES', left, summaryTop, 7, true)
  text(tax ? 'Subtotal sin impuesto' : 'Subtotal (sin desglose)', 358, summaryTop, 8)
  text(money(tax?.net ?? d.total), right, summaryTop, 10, false, 'right')
  if (tax) {
    text(`Impuesto incluido (${d.taxRate} %)`, 358, summaryTop + 16, 8)
    text(money(tax.tax), right, summaryTop + 16, 9, false, 'right')
  }
  const totalOffset = tax ? 18 : 0
  pdf
    .setFillColor(...accent)
    .roundedRect(354, summaryTop + 10 + totalOffset, 222, 39, 4, 4, 'F')
  pdf
    .setTextColor(255, 255, 255)
    .setFont('helvetica', 'bold')
    .setFontSize(10)
    .text(`TOTAL ${d.currency}`, 368, summaryTop + 34 + totalOffset)
  pdf
    .setFontSize(15)
    .text(money(d.total), 564, summaryTop + 35 + totalOffset, { align: 'right' })
  if (equivalent)
    text(
      `Equivale a ${formatCurrency(equivalent.amount, equivalent.currency).replace(/\s/g, ' ')} a ${rate} C$ por dólar`,
      right,
      summaryTop + 63 + totalOffset,
      8,
      false,
      'right',
    )
  const notes = wrap(
    d.notes || 'Gracias por elegir La Casa del Perfume.',
    294,
    8,
  )
  y = summaryTop + 16
  while (notes.length) {
    const available = Math.max(1, Math.floor((665 - y) / 10.4))
    const part = notes.splice(0, available)
    text(part, left, y, 8)
    y += part.length * 10.4
    if (notes.length) {
      pdf.addPage()
      y = header(true)
      text('OBSERVACIONES (CONTINUACIÓN)', left, y, 7, true)
      y += 17
    }
  }
  y = Math.max(y + 15, summaryTop + (equivalent ? 78 : 66) + totalOffset)
  if (d.kind === 'invoice' && d.location) {
    text(`Entrega desde: ${labels.location[d.location]}`, left, y, 8)
    y += 20
  }
  if (y + 50 > 705) {
    pdf.addPage()
    y = header(true)
  }
  y = Math.max(y + 32, 668)
  pdf
    .setDrawColor(...gray)
    .line(65, y, 245, y)
    .line(365, y, 545, y)
  text('Elaborado por', 155, y + 14, 8, false, 'center')
  text(
    d.kind === 'invoice' ? 'Recibido por' : 'Aceptación del cliente',
    455,
    y + 14,
    8,
    false,
    'center',
  )
  const pageCount = pdf.getNumberOfPages()
  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page)
    pdf
      .setDrawColor(...accent)
      .setLineWidth(1)
      .line(left, 724, right, 724)
    text('Gracias por tu confianza.', left, 739, 10, true)
    text(`${page} / ${pageCount}`, right, 739, 8, false, 'right')
    const notice = `${d.previewKind === 'example' ? 'Ejemplo de diseño; no registra una venta. ' : d.previewKind === 'draft' ? 'Borrador sin emitir. ' : ''}${d.kind === 'invoice' ? 'Documento de control administrativo. No es comprobante fiscal. Desglose según la tasa de impuesto registrada.' : 'Cotización sujeta a disponibilidad. No constituye factura ni comprobante de pago.'}`
    text(wrap(notice, width, 7), left, 753, 7)
  }
  return pdf.output('blob')
}
