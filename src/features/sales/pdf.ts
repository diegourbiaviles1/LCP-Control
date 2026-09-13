import { documentCopy, labels } from '../../lib/domain'
import { formatCurrency, formatDate } from '../../lib/format'
import { priceTierLabels } from '../../lib/pricing'
import type { DocumentRecord } from '../../lib/domain'

const WINE: [number, number, number] = [87, 23, 28]
const GOLD: [number, number, number] = [138, 99, 24]
const MUTED: [number, number, number] = [110, 110, 110]
const MARGIN = 48
const PAGE_BOTTOM = 780
// Escaped on purpose: literal combining marks are invisible and easy to break.
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')

export function documentFileName(document: DocumentRecord) {
  return `${document.number}-${document.customerName}`
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .concat('.pdf')
}

/** jsPDF is loaded on demand: the invoice screens work without it until the
 * operator actually asks for a PDF. */
export async function buildDocumentPdf(
  document: DocumentRecord,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' })
  const copy = documentCopy[document.kind]
  // El color acompaña al sello: vino para facturas, dorado para proformas.
  const accent = document.kind === 'proforma' ? GOLD : WINE
  const right = pdf.internal.pageSize.getWidth() - MARGIN
  let y = MARGIN + 10

  pdf
    .setFont('helvetica', 'bold')
    .setFontSize(16)
    .setTextColor(...accent)
  pdf.text(document.issuer.name, MARGIN, y)
  pdf.setFont('helvetica', 'bold').setFontSize(13)
  pdf.text(copy.stamp, right, y, { align: 'right' })
  y += 16
  pdf
    .setFont('helvetica', 'normal')
    .setFontSize(9)
    .setTextColor(...MUTED)
  pdf.text(document.issuer.address, MARGIN, y)
  pdf
    .setFont('helvetica', 'bold')
    .setTextColor(...accent)
    .setFontSize(11)
  pdf.text(document.number, right, y, { align: 'right' })
  y += 13
  pdf
    .setFont('helvetica', 'normal')
    .setFontSize(9)
    .setTextColor(...MUTED)
  pdf.text(document.issuer.phone, MARGIN, y)
  y += 26

  pdf.setDrawColor(...accent).setLineWidth(1)
  pdf.line(MARGIN, y, right, y)
  y += 20

  pdf.setTextColor(30, 30, 30).setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Cliente', MARGIN, y)
  pdf.text('Emitida', right - 170, y)
  y += 14
  pdf.setFont('helvetica', 'normal')
  pdf.text(document.customerName, MARGIN, y)
  pdf.text(formatDate(document.createdAt), right - 170, y)
  y += 13
  pdf.setFontSize(9).setTextColor(...MUTED)
  if (document.customerPhone) pdf.text(document.customerPhone, MARGIN, y)
  pdf.text(
    `${priceTierLabels[document.tier]} · ${document.currency}`,
    right - 170,
    y,
  )
  y += 13
  const detail =
    document.kind === 'proforma'
      ? document.validUntil
        ? `Válida hasta ${formatDate(`${document.validUntil}T12:00:00`)}`
        : ''
      : document.paymentMethod
        ? document.paymentMethod === 'pending'
          ? 'Pago pendiente'
          : labels.payment[document.paymentMethod]
        : ''
  if (detail) pdf.text(detail, right - 170, y)
  y += 24

  const quantityX = right - 190
  const priceX = right - 110
  const totalX = right
  pdf.setFont('helvetica', 'bold').setFontSize(9).setTextColor(30, 30, 30)
  pdf.text('Descripción', MARGIN, y)
  pdf.text('Cant.', quantityX, y, { align: 'right' })
  pdf.text('Precio', priceX, y, { align: 'right' })
  pdf.text('Importe', totalX, y, { align: 'right' })
  y += 8
  pdf.setDrawColor(210, 210, 210).setLineWidth(0.5)
  pdf.line(MARGIN, y, right, y)
  y += 15

  pdf.setFont('helvetica', 'normal')
  for (const item of document.items) {
    const wrapped = pdf.splitTextToSize(
      item.description,
      quantityX - MARGIN - 18,
    ) as string[]
    if (y + wrapped.length * 11 > PAGE_BOTTOM) {
      pdf.addPage()
      y = MARGIN
    }
    pdf.text(wrapped, MARGIN, y)
    pdf.text(String(item.quantity), quantityX, y, { align: 'right' })
    pdf.text(formatCurrency(item.unitPrice, document.currency), priceX, y, {
      align: 'right',
    })
    pdf.text(formatCurrency(item.lineTotal, document.currency), totalX, y, {
      align: 'right',
    })
    y += wrapped.length * 11 + 8
  }

  if (y + 90 > PAGE_BOTTOM) {
    pdf.addPage()
    y = MARGIN
  }
  y += 6
  pdf.setDrawColor(...accent).setLineWidth(1)
  pdf.line(quantityX - 40, y, right, y)
  y += 20
  pdf
    .setFont('helvetica', 'bold')
    .setFontSize(12)
    .setTextColor(...accent)
  pdf.text('Total', quantityX - 40, y)
  pdf.text(formatCurrency(document.total, document.currency), totalX, y, {
    align: 'right',
  })
  y += 26

  pdf
    .setFont('helvetica', 'normal')
    .setFontSize(8)
    .setTextColor(...MUTED)
  if (document.notes.trim()) {
    const notes = pdf.splitTextToSize(
      `Nota: ${document.notes.trim()}`,
      right - MARGIN,
    ) as string[]
    pdf.text(notes, MARGIN, y)
    y += notes.length * 10 + 8
  }
  const notice = pdf.splitTextToSize(copy.notice, right - MARGIN) as string[]
  pdf.text(notice, MARGIN, y)

  return pdf.output('blob')
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled'

/** Mobile gets the native share sheet (WhatsApp included); desktop, where the
 * API cannot attach files, gets the download so it can be attached by hand. */
export async function shareDocumentPdf(
  document: DocumentRecord,
): Promise<ShareOutcome> {
  const blob = await buildDocumentPdf(document)
  const name = documentFileName(document)
  const file = new File([blob], name, { type: 'application/pdf' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `${documentCopy[document.kind].stamp} ${document.number}`,
      })
      return 'shared'
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(blob)
  const link = window.document.createElement('a')
  link.href = url
  link.download = name
  link.rel = 'noopener'
  window.document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}
