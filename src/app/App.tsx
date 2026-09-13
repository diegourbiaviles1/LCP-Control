import { Route, Routes } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AppShell } from './AppShell'
import { LoginPage } from '../features/auth/LoginPage'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { EmptyState, LoadingState } from '../components/ui'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { InventoryPage } from '../features/inventory/InventoryPage'
import { AlertsPage } from '../features/alerts/AlertsPage'
import { ProductEditorPage } from '../features/products/ProductEditorPage'
import { ProductManagementPage } from '../features/products/ProductManagementPage'
import { AccountPage } from '../features/auth/AccountPage'
import { DocumentExamplePage } from '../features/sales/DocumentExamplePage'
import { SuppliersPage } from '../features/suppliers/SuppliersPage'
const ScannerPage = lazy(() =>
  import('../features/scanner/ScannerPage').then((page) => ({
    default: page.ScannerPage,
  })),
)
const SalesPage = lazy(() =>
  import('../features/sales/SalesPage').then((page) => ({
    default: page.SalesPage,
  })),
)
const ProformaPage = lazy(() =>
  import('../features/sales/ProformaPage').then((page) => ({
    default: page.ProformaPage,
  })),
)
export function App() {
  const pages = (
    <>
      <Route index element={<DashboardPage />} />
      <Route path="inventory" element={<InventoryPage />} />
      <Route path="scanner" element={<ScannerPage />} />
      <Route path="suppliers" element={<SuppliersPage />} />
      <Route path="sales" element={<SalesPage />} />
      <Route path="proformas" element={<ProformaPage />} />
      <Route path="products" element={<InventoryPage catalog />} />
      <Route path="products/new" element={<ProductEditorPage />} />
      <Route path="products/manage" element={<ProductManagementPage />} />
      <Route path="products/:id/edit" element={<ProductEditorPage />} />
      <Route path="account" element={<AccountPage />} />
      <Route path="documents/example/:kind" element={<DocumentExamplePage />} />
      <Route path="alerts" element={<AlertsPage />} />
    </>
  )
  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<AppShell />}>
            {pages}
          </Route>
        </Route>
        {/* Vista local con datos sintéticos: sólo existe en desarrollo y pruebas. */}
        {import.meta.env.DEV && (
          <Route path="/demo" element={<AppShell demo />}>
            {pages}
          </Route>
        )}
        <Route path="*" element={<EmptyState title="Página no encontrada" />} />
      </Routes>
    </Suspense>
  )
}
