import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '../../components/ui'
import { exampleDocument } from './example'
import { DocumentPrint } from './DocumentPrint'
import { downloadDocumentPdf } from './pdf'
export function DocumentExamplePage() {
  const { kind } = useParams()
  const record = exampleDocument(kind === 'proforma' ? 'proforma' : 'invoice')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <>
      <div className="page-heading no-print">
        <div>
          <h1>
            {record.kind === 'invoice'
              ? 'Ejemplo de factura'
              : 'Ejemplo de proforma'}
          </h1>
          <p className="muted">Tamaño carta · datos de muestra · sin emisión</p>
        </div>
        <div className="form-actions">
          <Button onClick={() => window.print()}>Imprimir ejemplo</Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await downloadDocumentPdf(record)
              } catch {
                setMessage('No pudimos generar el PDF. Inténtalo de nuevo.')
              } finally {
                setBusy(false)
              }
            }}
          >
            Descargar PDF
          </Button>
        </div>
      </div>
      {message && <p role="alert">{message}</p>}
      <div className="example-paper">
        <DocumentPrint document={record} />
      </div>
    </>
  )
}
