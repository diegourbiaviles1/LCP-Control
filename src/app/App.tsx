import { Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { LoginPage } from '../features/auth/LoginPage'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { EmptyState } from '../components/ui'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { InventoryPage } from '../features/inventory/InventoryPage'
import { ScannerPage } from '../features/scanner/ScannerPage'
import { SalesPage } from '../features/sales/SalesPage'
import { AlertsPage } from '../features/alerts/AlertsPage'
import { ProductDraftPage } from '../features/products/ProductDraftPage'
export function App() {
  const pages = (
    <>
      <Route index element={<DashboardPage />} />
      <Route path="inventory" element={<InventoryPage />} />
      <Route path="scanner" element={<ScannerPage />} />
      <Route path="sales" element={<SalesPage />} />
      <Route path="products" element={<InventoryPage catalog />} />
      <Route path="products/new" element={<ProductDraftPage />} />
      <Route path="alerts" element={<AlertsPage />} />
    </>
  )
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<AppShell />}>
          {pages}
        </Route>
      </Route>
      <Route path="/demo" element={<AppShell demo />}>
        {pages}
      </Route>
      <Route path="*" element={<EmptyState title="Página no encontrada" />} />
    </Routes>
  )
}
