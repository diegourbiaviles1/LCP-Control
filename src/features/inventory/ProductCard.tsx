import { Badge } from '../../components/ui'
import { ProductImage } from '../../components/ProductImage'
import type { InventoryItem, Currency, PriceTier } from '../../lib/domain'
import { labels } from '../../lib/domain'
import { formatCurrency } from '../../lib/format'
import { productPrice } from '../../lib/pricing'
import { stockStatus, totalStock } from './model'
export function StockBadge({ item }: { item: InventoryItem }) {
  const status = stockStatus(item)
  return (
    <Badge
      tone={
        status === 'unknown'
          ? 'neutral'
          : status === 'out'
            ? 'danger'
            : status === 'low'
              ? 'warning'
              : 'success'
      }
    >
      {status === 'unknown'
        ? 'Sin conteo'
        : status === 'out'
          ? 'Sin existencias'
          : status === 'low'
            ? 'Stock bajo'
            : 'Disponible'}
    </Badge>
  )
}
export function ProductIdentity({ item }: { item: InventoryItem }) {
  return (
    <div className="product-identity">
      <ProductImage key={item.product.id} product={item.product} />
      <div>
        <strong>{item.product.name}</strong>
        <small>
          {item.product.brand} ·{' '}
          {item.product.size === null
            ? 'Tamaño por confirmar'
            : `${item.product.size} ${item.product.unit}`}
        </small>
      </div>
    </div>
  )
}
export function ProductCard({
  item,
  currency = 'NIO',
  tier = 'emprendedor',
}: {
  item: InventoryItem
  currency?: Currency
  tier?: PriceTier
}) {
  const price = productPrice(item.product, tier, currency)
  return (
    <article className="inventory-mobile-card">
      <div className="section-heading">
        <ProductIdentity item={item} />
        <StockBadge item={item} />
      </div>
      <div className="mobile-product-meta">
        <span>
          {labels.category[item.product.category]} ·{' '}
          {labels.gender[item.product.gender]}
        </span>
        <strong>
          {price === null
            ? 'Precio pendiente'
            : formatCurrency(price, currency)}
        </strong>
      </div>
      <div className="location-strip">
        <span>
          Bodega <b>{item.quantities.warehouse ?? '—'}</b>
        </span>
        <span>
          Tienda <b>{item.quantities.store ?? '—'}</b>
        </span>
        <span>
          Total <b>{totalStock(item) ?? '—'}</b>
        </span>
      </div>
      <small className="internal-code">
        Código interno: {item.product.barcode}
      </small>
    </article>
  )
}
