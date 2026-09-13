import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useServices } from '../../services/useServices'
import { useAccess } from '../../app/AccessContext'
import { useQuery } from '../../lib/useQuery'
import {
  Button,
  Card,
  Input,
  ErrorState,
  LoadingState,
} from '../../components/ui'
import { formatCurrency, formatDate } from '../../lib/format'
import { errorMessage } from '../../lib/errors'
import type { DocumentKind, DocumentRecord } from '../../lib/domain'
import { DocumentPrint } from './DocumentPrint'
import { downloadDocumentPdf } from './pdf'
export function DocumentHistory({ kind }: { kind: DocumentKind }) {
  const { salesService } = useServices()
  const { base } = useAccess()
  const load = useCallback(
    () => salesService.listDocuments(kind, 200),
    [salesService, kind],
  )
  const { data, error, loading, retry } = useQuery(load)
  const [selected, setSelected] = useState<DocumentRecord | null>(null)
  const [search, setSearch] = useState('')
  const [failure, setFailure] = useState('')
  return (
    <>
      <div className="no-print">
        <h1>{kind === 'invoice' ? 'Facturas' : 'Proformas'} emitidas</h1>
        <p>
          Últimos 200 documentos disponibles para tu cuenta. Conservan los
          precios y datos con los que se emitieron.
        </p>
        <Link to={`${base}/${kind === 'invoice' ? 'sales' : 'proformas'}`}>
          Crear {kind === 'invoice' ? 'factura' : 'proforma'}
        </Link>
        <Input
          label="Buscar por número o cliente"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {loading && <LoadingState />}
        {error && <ErrorState message={error} retry={retry} />}
        <div className="supplier-grid">
          {data
            ?.filter((d) =>
              `${d.number} ${d.customerName}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((d) => (
              <Card key={d.id}>
                <h2>{d.number}</h2>
                <p>
                  {d.customerName} · {formatDate(d.createdAt)}
                </p>
                <p>{formatCurrency(d.total, d.currency)}</p>
                <Button variant="secondary" onClick={() => setSelected(d)}>
                  Ver documento
                </Button>
              </Card>
            ))}
        </div>
        {data?.length === 0 && <p>No hay documentos emitidos.</p>}
        {selected && (
          <div className="form-actions">
            <Button onClick={() => window.print()}>Imprimir en carta</Button>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await downloadDocumentPdf(selected)
                } catch (e) {
                  setFailure(errorMessage(e))
                }
              }}
            >
              Descargar PDF
            </Button>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Cerrar documento
            </Button>
          </div>
        )}
        {failure && <ErrorState message={failure} />}
      </div>
      {selected && (
        <>
          <div className="example-paper no-print">
            <DocumentPrint document={selected} />
          </div>
          <div className="document-print-root" aria-hidden="true">
            <DocumentPrint document={selected} />
          </div>
        </>
      )}
    </>
  )
}
