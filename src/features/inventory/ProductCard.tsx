import { Package } from 'lucide-react'
import { Badge } from '../../components/ui'
import type { InventoryItem } from '../../lib/domain'
import { labels } from '../../lib/domain'
import { formatCurrency } from '../../lib/format'
import { stockStatus, totalStock } from './model'
export function StockBadge({ item }: { item: InventoryItem }) {
  const status = stockStatus(item)
  return (
    <Badge
      tone={
        status === 'out' ? 'danger' : status === 'low' ? 'warning' : 'success'
      }
    >
      {status === 'out'
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
      <div className={`product-icon ${item.product.category}`}>
        <Package size={20} strokeWidth={1.3} />
      </div>
      <div>
        <strong>{item.product.name}</strong>
        <small>
          {item.product.brand} <span>·</span> {item.product.size}{' '}
          {item.product.unit}
        </small>
      </div>
    </div>
  )
}
export function ProductCard({ item }: { item: InventoryItem }) {
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
          {formatCurrency(item.product.price, item.product.currency)}
        </strong>
      </div>
      <div className="location-strip">
        <span>
          Bodega <b>{item.quantities.warehouse}</b>
        </span>
        <span>
          Tienda <b>{item.quantities.store}</b>
        </span>
        <span>
          Total <b>{totalStock(item)}</b>
        </span>
      </div>
    </article>
  )
}
