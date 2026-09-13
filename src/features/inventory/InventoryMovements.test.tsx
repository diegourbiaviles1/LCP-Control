import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccessContext } from '../../app/AccessContext'
import { InventoryMovements } from './InventoryMovements'
import { catalogAdapter } from '../../services/adapters/catalog'
import type { UserRole } from '../../lib/domain'

const { recordMovement } = vi.hoisted(() => ({ recordMovement: vi.fn() }))
vi.mock('../../services/useServices', () => ({
  useServices: () => ({ inventoryService: { recordMovement } }),
}))
beforeEach(() => {
  recordMovement.mockReset().mockResolvedValue('movement-id')
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
async function mount(role: UserRole, demo = false) {
  const items = (await catalogAdapter.getInventory()).slice(0, 1)
  const onRecorded = vi.fn()
  render(
    <AccessContext.Provider value={{ demo, base: '', role }}>
      <InventoryMovements items={items} onRecorded={onRecorded} />
    </AccessContext.Provider>,
  )
  return { onRecorded }
}
it('permite al administrador registrar el conteo inicial en cero', async () => {
  const { onRecorded } = await mount('admin')
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Ajuste' }))
  await user.type(screen.getByLabelText('Conteo total'), '0')
  await user.type(screen.getByLabelText('Motivo'), 'Conteo físico')
  await user.click(screen.getByRole('button', { name: 'Confirmar movimiento' }))
  await waitFor(() => expect(onRecorded).toHaveBeenCalledOnce())
  expect(recordMovement).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'ADJUSTMENT',
      quantity: 0,
      productId: 'demo-0001',
      location: 'store',
      requestId: expect.any(String),
    }),
  )
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Inventario actualizado',
  )
})
it('el operador solo ve salidas y daños y no puede mover un saldo sin conteo', async () => {
  await mount('operator')
  expect(
    screen.queryByRole('button', { name: 'Ajuste' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Entrada' }),
  ).not.toBeInTheDocument()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Salida' }))
  await user.type(screen.getByLabelText('Cantidad'), '2')
  await user.type(screen.getByLabelText('Motivo'), 'Salida de prueba')
  await user.click(screen.getByRole('button', { name: 'Confirmar movimiento' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('conteo inicial')
  expect(recordMovement).not.toHaveBeenCalled()
})
it('no presenta acciones reales en demo', async () => {
  await mount('admin', true)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
