import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { ContactsPage } from './ContactsPage'
import { AccessContext } from '../app/AccessContext'
import type { ContactRecord } from '../services/workspace'
const { listContacts, saveContact } = vi.hoisted(() => ({
  listContacts: vi.fn(),
  saveContact: vi.fn(),
}))
vi.mock('../services/workspace', () => ({ listContacts, saveContact }))
beforeEach(() => {
  listContacts.mockReset()
  saveContact.mockReset()
})
it('registers a customer, normalizes the local phone and edits the returned database revision', async () => {
  let rows: ContactRecord[] = []
  listContacts.mockImplementation(async () => rows)
  saveContact.mockImplementation(async (_kind, record) => {
    rows = [{ ...record, revision: record.revision + 1 }]
    return record.id
  })
  render(
    <AccessContext.Provider value={{ demo: false, base: '', role: 'admin' }}>
      <ContactsPage kind="customers" />
    </AccessContext.Provider>,
  )
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Nuevo cliente' }))
  await user.type(screen.getByLabelText('Nombre'), 'Cliente de prueba')
  await user.type(screen.getByLabelText('Teléfono / WhatsApp'), '8888 1111')
  await user.type(screen.getByLabelText('RUC'), 'RUC-PRUEBA')
  await user.click(screen.getByRole('button', { name: 'Guardar' }))
  await screen.findByRole('heading', { name: 'Cliente de prueba' })
  expect(saveContact.mock.calls[0][1]).toMatchObject({
    phone: '50588881111',
    taxId: 'RUC-PRUEBA',
    revision: 0,
  })
  await user.click(screen.getByRole('button', { name: 'Editar' }))
  await user.type(screen.getByLabelText('Dirección'), 'Dirección de prueba')
  await user.click(screen.getByRole('button', { name: 'Guardar' }))
  await waitFor(() =>
    expect(saveContact.mock.calls[1][1]).toMatchObject({
      id: rows[0].id,
      revision: 1,
      address: 'Dirección de prueba',
    }),
  )
})
it('warehouse staff can read suppliers but cannot edit them or read customers', async () => {
  listContacts.mockResolvedValue([
    { id: '1', name: 'Proveedor de prueba', phone: '', active: true },
  ])
  const page = render(
    <AccessContext.Provider
      value={{ demo: false, base: '', role: 'warehouse' }}
    >
      <ContactsPage kind="suppliers" />
    </AccessContext.Provider>,
  )
  await screen.findByRole('heading', { name: 'Proveedor de prueba' })
  expect(
    screen.queryByRole('button', { name: 'Nuevo proveedor' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Editar' }),
  ).not.toBeInTheDocument()
  page.rerender(
    <AccessContext.Provider
      value={{ demo: false, base: '', role: 'warehouse' }}
    >
      <ContactsPage kind="customers" />
    </AccessContext.Provider>,
  )
  expect(screen.getByRole('alert')).toHaveTextContent('no tiene acceso')
  expect(listContacts).toHaveBeenCalledTimes(1)
})
