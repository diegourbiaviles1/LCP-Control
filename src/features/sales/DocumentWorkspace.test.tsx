import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DocumentWorkspace } from './DocumentWorkspace'
import { AccessContext } from '../../app/AccessContext'
import { createServices } from '../../services'
import { catalogAdapter } from '../../services/adapters/catalog'
import { localBusiness } from '../../services/adapters/local'
import type { DocumentRecord } from '../../lib/domain'

const { createDocument } = vi.hoisted(() => ({ createDocument: vi.fn() }))
vi.mock('../../services/useServices', () => ({ useServices: () => services }))
vi.mock('../../services/workspace', () => ({ listContacts: async () => [] }))
vi.mock('../../lib/workspaceDrafts', () => ({
  useWorkspaceDrafts: () => ({
    items: [],
    error: '',
    loading: false,
    save: async () => true,
    retry: vi.fn(),
  }),
}))
const services = createServices(catalogAdapter)
services.salesService.createDocument = createDocument
const issued: DocumentRecord = {
  id: 'issued-1',
  kind: 'invoice',
  number: 'FAC-000001',
  customerId: 'c1',
  customerName: 'Cliente confirmado',
  customerPhone: null,
  issuer: localBusiness,
  tier: 'emprendedor',
  currency: 'NIO',
  total: 42,
  location: 'store',
  validUntil: null,
  paymentMethod: 'pending',
  notes: '',
  createdAt: '2026-09-13T03:00:00Z',
  items: [
    {
      id: 'line-1',
      productId: 'demo-0001',
      description: 'Producto confirmado',
      quantity: 1,
      unitPrice: 42,
      lineTotal: 42,
    },
  ],
}
beforeEach(() => {
  localStorage.clear()
  createDocument.mockReset()
})
async function prepare(demo = false) {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <AccessContext.Provider value={{ demo, base: '', role: 'admin' }}>
        <DocumentWorkspace kind="invoice" />
      </AccessContext.Provider>
    </MemoryRouter>,
  )
  await user.type(await screen.findByLabelText('Cliente'), 'Cliente de prueba')
  await user.click(
    screen.getByRole('button', { name: /^Agregar Aurora Norte Cedro 01/ }),
  )
  return user
}
it('reintenta con el mismo ID y muestra el precio confirmado, bloqueando la edición', async () => {
  createDocument
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValue(issued)
  const user = await prepare()
  await user.click(screen.getByRole('button', { name: 'Emitir factura' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('conexión')
  await user.click(screen.getByRole('button', { name: 'Emitir factura' }))
  await screen.findByText('Producto confirmado', { selector: 'strong' })
  expect(createDocument.mock.calls[0][0].requestId).toBe(
    createDocument.mock.calls[1][0].requestId,
  )
  expect(document.querySelector('.invoice-total')).toHaveTextContent('42.00')
  expect(screen.getByLabelText('Cliente')).toBeDisabled()
  expect(screen.getByLabelText('Moneda')).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Guardar borrador' }),
  ).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Nueva factura' }))
  await waitFor(() => expect(screen.getByLabelText('Cliente')).toBeEnabled())
})
it('la demo permite preparar un borrador pero no emitirlo', async () => {
  await prepare(true)
  expect(screen.getByRole('button', { name: 'Emitir factura' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeEnabled()
  expect(createDocument).not.toHaveBeenCalled()
})
