import { useCallback } from 'react'
import { useAccess } from '../../app/AccessContext'
import { useQuery } from '../../lib/useQuery'
import { listMovements } from '../../services/workspace'
import { Card, ErrorState, LoadingState } from '../../components/ui'
import { formatDate } from '../../lib/format'
export function MovementHistory() {
  const { demo } = useAccess()
  const load = useCallback(
    () => (demo ? Promise.resolve([]) : listMovements()),
    [demo],
  )
  const { data, error, loading, retry } = useQuery(load)
  return (
    <>
      <h1>Historial de inventario</h1>
      <p>
        Entradas, salidas, daños, ajustes y ventas. Se muestran los últimos 200
        movimientos permitidos para tu cuenta.
      </p>
      {loading && <LoadingState />}
      {error && <ErrorState message={error} retry={retry} />}
      <div className="supplier-grid">
        {data?.map((r) => (
          <Card key={r.id}>
            <h2>
              {{
                ENTRY: 'Entrada',
                EXIT: 'Salida',
                DAMAGED: 'Dañado',
                ADJUSTMENT: 'Ajuste',
                SALE: 'Venta',
              }[r.type as string] ?? r.type}
            </h2>
            <p>
              {(Array.isArray(r.products) ? r.products[0] : r.products)?.name ??
                'Producto'}{' '}
              · {(Array.isArray(r.products) ? r.products[0] : r.products)?.sku}
            </p>
            <p>
              {r.before_quantity ?? 'Sin contar'} → {r.after_quantity} unidades
              · {r.location === 'store' ? 'Tienda' : 'Bodega'}
            </p>
            <p>{r.note}</p>
            <small>{formatDate(r.created_at)}</small>
          </Card>
        ))}
      </div>
      {data?.length === 0 && <p>No hay movimientos registrados.</p>}
    </>
  )
}
