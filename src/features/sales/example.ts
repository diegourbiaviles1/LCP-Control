import type { DocumentKind, DocumentRecord } from '../../lib/domain'
export function exampleDocument(kind: DocumentKind): DocumentRecord {
  const items = [
    ['Rasasi · Hawas Black · 100 ml', 2, 1450],
    ['Lattafa · Yara · 100 ml', 1, 1100],
    ['Armaf · Club de Nuit Intense Man · 105 ml', 1, 1650],
  ] as const
  return {
    id: 'example',
    kind,
    previewKind: 'example',
    number: kind === 'invoice' ? 'FAC-EJEMPLO' : 'PRO-EJEMPLO',
    customerId: '',
    customerName: 'María López · cliente de ejemplo',
    customerPhone: null,
    issuer: { name: 'La Casa del Perfume', address: '', phone: '' },
    tier: 'emprendedor',
    currency: 'NIO',
    total: 5650,
    // El catálogo se cotiza en dólares; el ejemplo enseña también cómo sale
    // impreso el equivalente para un cliente que pide el cobro en dólares.
    catalogRate: 37,
    location: kind === 'invoice' ? 'store' : null,
    paymentMethod: kind === 'invoice' ? 'cash' : null,
    validUntil: kind === 'proforma' ? '2026-09-20' : null,
    createdAt: '2026-09-13T12:00:00-06:00',
    notes:
      'Precios y cliente de muestra. Los datos del negocio se completarán antes de utilizar el formato definitivo.',
    items: items.map(([description, quantity, unitPrice], i) => ({
      id: String(i),
      productId: `example-${i}`,
      description,
      quantity,
      unitPrice,
      lineTotal: quantity * unitPrice,
    })),
  }
}
