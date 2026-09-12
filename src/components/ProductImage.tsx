import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import type { Product } from '../lib/domain'
export function ProductImage({
  product,
  large = false,
}: {
  product: Product
  large?: boolean
}) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={`product-photo ${large ? 'product-photo-large' : ''}`}>
      {product.imageUrl && !failed ? (
        <img
          src={product.imageUrl}
          alt={`${product.brand} ${product.name}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="photo-missing">
          <ImageOff size={large ? 30 : 18} />
          {large && (
            <span>
              {product.imageUrl ? 'Foto no disponible' : 'Foto pendiente'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
