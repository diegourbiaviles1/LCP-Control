import { Navigate } from 'react-router-dom'
import { useAccess } from '../../app/AccessContext'
export function SalesPage() {
  const { base } = useAccess()
  return <Navigate to={base + '/invoices'} replace />
}
