import type { BusinessSettings, Currency, PriceTier } from '../../lib/domain'
import { formatCurrency, formatDate } from '../../lib/format'
import { priceTierLabels } from '../../lib/pricing'
import { buildWorkbook, type Sheet } from '../../lib/xlsx'
import { totalStock } from '../inventory/model'
import { accountingSheets } from './accountingExport'
import {
  change,
  concentration,
  currenciesWithSales,
  customerActivity,
  idleStock,
  inRange,
  inventoryHealth,
  lapsedCustomers,
  purchaseFrequency,
  movementSummary,
  movementsInRange,
  paymentBreakdown,
  previousRange,
  proformaConversion,
  proformaCount,
  revenueByDay,
  salesByWeekday,
  shrinkage,
  stockCoverage,
  summary,
  tierBreakdown,
  topProducts,
  type ReportRange,
  type ReportSource,
} from './model'

export interface ReportContext {
  source: ReportSource
  range: ReportRange
  tier: PriceTier
  business: BusinessSettings
}

const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')
function fileName(range: ReportRange, extension: string) {
  return `reporte-${range.from}-a-${range.to}`
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .concat(extension)
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function exportReport(
  format: 'pdf' | 'excel',
  context: ReportContext,
) {
  if (format === 'excel') {
    download(buildReportWorkbook(context), fileName(context.range, '.xlsx'))
    return
  }
  const { renderReportPdf } = await import('./reportPdf')
  download(await renderReportPdf(context), fileName(context.range, '.pdf'))
}

/**
 * El libro lleva el detalle completo, una hoja por tema, para que el contador o
 * el dueño puedan filtrar y sumar por su cuenta. Las cifras van como números;
 * el formato se aplica en la columna.
 */
export function buildReportWorkbook({
  source,
  range,
  tier,
  business,
}: ReportContext): Blob {
  const current = inRange(source.documents, range)
  const previous = inRange(source.documents, previousRange(range))
  const currencies = currenciesWithSales(current)
  const header = [
    business.name,
    `Reporte del ${formatDate(range.from)} al ${formatDate(range.to)}`,
    'Ventas comerciales por moneda original; contabilidad en NIO con la tasa guardada por operación.',
  ]
  const sheets: Sheet[] = accountingSheets(source, range, business.name)

  sheets.push({
    name: 'Resumen',
    notes: [
      ...header,
      source.truncated
        ? 'Aviso: el periodo superó las filas consultadas; acorta el rango para un total exacto.'
        : '',
    ].filter(Boolean),
    columns: [
      { header: 'Moneda', width: 12 },
      { header: 'Ingresos', format: 'money', width: 16 },
      { header: 'Facturas', format: 'integer', width: 11 },
      { header: 'Ticket promedio', format: 'money', width: 17 },
      { header: 'Unidades', format: 'integer', width: 11 },
      { header: 'Clientes', format: 'integer', width: 11 },
      { header: 'Proformas', format: 'integer', width: 11 },
      { header: 'Ingresos periodo anterior', format: 'money', width: 22 },
      { header: 'Variación', format: 'number', width: 12 },
    ],
    rows: currencies.map((currency) => {
      const totals = summary(current, currency)
      const before = summary(previous, currency)
      const variation = change(totals.revenue, before.revenue)
      return [
        currency,
        totals.revenue,
        totals.count,
        Number(totals.average.toFixed(2)),
        totals.units,
        totals.customers,
        proformaCount(current, currency),
        before.revenue,
        variation === null ? null : Number((variation * 100).toFixed(1)),
      ]
    }),
  })

  sheets.push({
    name: 'Ingresos por día',
    notes: header,
    columns: [
      { header: 'Día', width: 14 },
      ...currencies.flatMap((currency) => [
        { header: `Ingresos ${currency}`, format: 'money' as const, width: 16 },
        {
          header: `Facturas ${currency}`,
          format: 'integer' as const,
          width: 15,
        },
      ]),
    ],
    rows: (() => {
      const series = currencies.map((currency) =>
        revenueByDay(current, currency, range),
      )
      const days = series[0] ?? revenueByDay([], 'NIO', range)
      return days.map((point, index) => [
        point.day,
        ...series.flatMap((entries) => [
          entries[index]?.revenue ?? 0,
          entries[index]?.count ?? 0,
        ]),
      ])
    })(),
  })

  for (const currency of currencies) {
    sheets.push({
      name: `Productos ${currency}`,
      notes: header,
      columns: [
        { header: 'Producto', width: 46 },
        { header: 'Unidades', format: 'integer', width: 12 },
        { header: 'Importe', format: 'money', width: 16 },
      ],
      rows: topProducts(current, currency, 200).map((product) => [
        product.description,
        product.quantity,
        product.revenue,
      ]),
    })
    const clients = customerActivity(current, source.customers, currency, range)
    sheets.push({
      name: `Clientes ${currency}`,
      notes: [
        ...header,
        `Nuevos en el periodo: ${clients.newCustomers} · Ya eran clientes: ${clients.returning}`,
      ],
      columns: [
        { header: 'Cliente', width: 36 },
        { header: 'Facturas', format: 'integer', width: 12 },
        { header: 'Importe', format: 'money', width: 16 },
      ],
      rows: clients.top.map((client) => [
        client.name,
        client.count,
        client.revenue,
      ]),
    })
    sheets.push({
      name: `Seguimiento ${currency}`,
      notes: [
        ...header,
        'Clientes que compraron en el periodo anterior y no en éste, y cada cuánto vuelve cada uno.',
      ],
      columns: [
        { header: 'Cliente', width: 34 },
        { header: 'Situación', width: 22 },
        { header: 'Última compra', width: 16 },
        { header: 'Días desde entonces', format: 'integer', width: 20 },
        { header: 'Compras', format: 'integer', width: 11 },
        { header: 'Importe anterior', format: 'money', width: 18 },
      ],
      rows: [
        ...lapsedCustomers(source.documents, range, currency, 200).map(
          (client) => [
            client.name,
            'No volvió',
            client.lastPurchase,
            client.daysSince,
            client.orders,
            client.previousRevenue,
          ],
        ),
        ...purchaseFrequency(source.documents, currency, range.to, 200).map(
          (client) => [
            client.name,
            client.averageDays === null
              ? 'Una sola compra'
              : `Vuelve cada ${client.averageDays.toFixed(1)} días`,
            '',
            client.daysSinceLast,
            client.orders,
            null,
          ],
        ),
      ],
    })
    sheets.push({
      name: `Semana ${currency}`,
      notes: [
        ...header,
        (() => {
          const conversion = proformaConversion(current, currency)
          return conversion.rate === null
            ? 'Sin proformas en el periodo.'
            : `Proformas: ${conversion.proformas} · terminaron en factura: ${conversion.converted} (${Math.round(conversion.rate * 100)} %, estimado por cliente y fecha).`
        })(),
        (() => {
          const share = concentration(
            topProducts(current, currency, 1000).map(
              (product) => product.revenue,
            ),
            10,
          )
          return share === null
            ? ''
            : `Los diez productos principales concentran el ${Math.round(share * 100)} % de los ingresos.`
        })(),
      ].filter(Boolean),
      columns: [
        { header: 'Día de la semana', width: 20 },
        { header: 'Ingresos', format: 'money', width: 16 },
        { header: 'Facturas', format: 'integer', width: 12 },
      ],
      rows: salesByWeekday(current, currency).map((day) => [
        day.label,
        day.revenue,
        day.count,
      ]),
    })
    sheets.push({
      name: `Cobros ${currency}`,
      notes: header,
      columns: [
        { header: 'Concepto', width: 26 },
        { header: 'Facturas', format: 'integer', width: 12 },
        { header: 'Importe', format: 'money', width: 16 },
      ],
      rows: [
        ...paymentBreakdown(current, currency).map((share) => [
          `Forma de pago: ${share.label}`,
          share.count,
          share.value,
        ]),
        ...tierBreakdown(current, currency).map((share) => [
          `Lista: ${share.label}`,
          share.count,
          share.value,
        ]),
      ],
    })
  }

  sheets.push({
    name: 'Documentos',
    notes: header,
    columns: [
      { header: 'Número', width: 14 },
      { header: 'Tipo', width: 11 },
      { header: 'Fecha', width: 22 },
      { header: 'Cliente', width: 30 },
      { header: 'Lista', width: 14 },
      { header: 'Pago', width: 18 },
      { header: 'Moneda', width: 9 },
      { header: 'Total', format: 'money', width: 15 },
    ],
    rows: current.map((document) => [
      document.number,
      document.kind === 'invoice' ? 'Factura' : 'Proforma',
      document.createdAt,
      document.customerName,
      priceTierLabels[document.tier],
      document.paymentMethod ?? '',
      document.currency,
      document.total,
    ]),
  })

  const health = inventoryHealth(source.inventory, tier, currencies[0] ?? 'NIO')
  const movements = movementSummary(movementsInRange(source.movements, range))
  sheets.push({
    name: 'Inventario',
    notes: [
      ...header,
      `Valorado con la lista ${priceTierLabels[tier]}. Es precio de venta, no costo de compra.`,
      `Con existencias ${health.available} · Bajo el mínimo ${health.low} · Agotados ${health.out} · Sin conteo ${health.uncounted}`,
      `Movimientos: entradas ${movements.entries} · ventas ${movements.sales} · salidas ${movements.exits} · dañados ${movements.damaged} · ajustes ${movements.adjustments}`,
    ],
    columns: [
      { header: 'Código', width: 16 },
      { header: 'Producto', width: 34 },
      { header: 'Marca', width: 20 },
      { header: 'Bodega', format: 'integer', width: 10 },
      { header: 'Tienda', format: 'integer', width: 10 },
      { header: 'Total', format: 'integer', width: 10 },
      { header: 'Mínimo', format: 'integer', width: 10 },
      { header: 'Precio lista', format: 'money', width: 14 },
    ],
    rows: source.inventory.map((item) => [
      item.product.barcode,
      item.product.name,
      item.product.brand,
      item.quantities.warehouse,
      item.quantities.store,
      totalStock(item),
      item.product.minimumStock,
      item.product.prices?.[tier][currencies[0] ?? 'NIO'] ?? null,
    ]),
  })

  const first = currencies[0] ?? 'NIO'
  sheets.push({
    name: 'Reposición',
    notes: [
      ...header,
      'Días de cobertura al ritmo de venta del periodo, y existencias que no se movieron.',
    ],
    columns: [
      { header: 'Producto', width: 42 },
      { header: 'Situación', width: 20 },
      { header: 'Existencias', format: 'integer', width: 13 },
      { header: 'Venta diaria', format: 'number', width: 14 },
      { header: 'Días de cobertura', format: 'number', width: 18 },
      { header: 'Valor a lista', format: 'money', width: 16 },
    ],
    rows: [
      ...stockCoverage(current, source.inventory, range, first, 500).map(
        (row) => [
          row.description,
          'Se vende',
          row.stock,
          Number(row.perDay.toFixed(2)),
          Number.isFinite(row.days) ? Number(row.days.toFixed(1)) : null,
          null,
        ],
      ),
      ...idleStock(current, source.inventory, tier, first, 500).map((row) => [
        row.description,
        'Sin ventas en el periodo',
        row.stock,
        0,
        null,
        row.listValue,
      ]),
    ],
  })

  const damaged = shrinkage(
    movementsInRange(source.movements, range),
    source.inventory,
    tier,
    first,
    500,
  )
  if (damaged.length)
    sheets.push({
      name: 'Mermas',
      notes: [...header, 'Unidades dañadas registradas en el periodo.'],
      columns: [
        { header: 'Producto', width: 42 },
        { header: 'Unidades', format: 'integer', width: 12 },
        { header: 'Valor a lista', format: 'money', width: 16 },
      ],
      rows: damaged.map((row) => [row.description, row.units, row.listValue]),
    })

  return buildWorkbook(sheets)
}

/** Las cifras que van al PDF, ya resueltas: el diseño sólo las coloca. */
export function reportTables({ source, range, tier }: ReportContext) {
  // Igual que el libro: la ventana cargada es más ancha que el periodo, así
  // que se acota antes de medir y sólo la comparación mira hacia atrás.
  const current = inRange(source.documents, range)
  const previous = inRange(source.documents, previousRange(range))
  const currencies = currenciesWithSales(current)
  const first = currencies[0] ?? 'NIO'
  return {
    currencies,
    perCurrency: currencies.map((currency: Currency) => ({
      currency,
      totals: summary(current, currency),
      before: summary(previous, currency),
      variation: change(
        summary(current, currency).revenue,
        summary(previous, currency).revenue,
      ),
      proformas: proformaCount(current, currency),
      conversion: proformaConversion(current, currency),
      products: topProducts(current, currency, 10),
      payments: paymentBreakdown(current, currency),
      tiers: tierBreakdown(current, currency),
      clients: customerActivity(current, source.customers, currency, range),
      lapsed: lapsedCustomers(source.documents, range, currency, 6),
      weekdays: salesByWeekday(current, currency),
      productShare: concentration(
        topProducts(current, currency, 1000).map((product) => product.revenue),
        10,
      ),
      money: (value: number) => formatCurrency(value, currency),
    })),
    coverage: stockCoverage(current, source.inventory, range, first, 8),
    idle: idleStock(current, source.inventory, tier, first, 6),
    damaged: shrinkage(movementsInRange(source.movements, range), source.inventory, tier, first, 6),
    health: inventoryHealth(source.inventory, tier, first),
    movements: movementSummary(movementsInRange(source.movements, range)),
    /** Moneda de referencia para las cifras que no van por moneda. */
    money: (value: number) => formatCurrency(value, first),
  }
}
