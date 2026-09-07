import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { ProtectedRoute } from './ProtectedRoute'
import { LoginPage } from './LoginPage'
import { useAuth } from './AuthContext'
import type { AuthService } from '../../services/auth'
import type { UserProfile } from '../../lib/domain'
import { AppError } from '../../lib/errors'
const profile: UserProfile = {
  id: 'test',
  email: 'test@example.test',
  role: 'operator',
}
function serviceFor(user: UserProfile | null): AuthService {
  return {
    getSession: vi.fn(async () => user),
    subscribe: vi.fn(() => () => {}),
    signIn: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
  }
}
function PrivatePage() {
  const { service } = useAuth()
  return (
    <>
      <h1>Private</h1>
      <button
        onClick={() => {
          void service.signOut()
        }}
      >
        Salir
      </button>
    </>
  )
}
function mount(service: AuthService, initial = '/inventory') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider service={service}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/inventory" element={<PrivatePage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}
describe('auth flow', () => {
  it('redirects unauthenticated visitors', async () => {
    mount(serviceFor(null))
    expect(
      await screen.findByRole('heading', { name: 'Todo comienza aquí.' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Private')).not.toBeInTheDocument()
  })
  it('restores a session after refresh', async () => {
    mount(serviceFor(profile))
    expect(await screen.findByText('Private')).toBeInTheDocument()
  })
  it('shows loading until restoration completes', async () => {
    const service = serviceFor(null)
    service.getSession = () => new Promise(() => {})
    mount(service)
    expect(screen.getByRole('status')).toHaveTextContent('Cargando')
  })
  it('denies an account without a backend role', async () => {
    mount(serviceFor({ ...profile, role: null }))
    expect(await screen.findByRole('alert')).toHaveTextContent('rol autorizado')
    expect(screen.queryByText('Private')).not.toBeInTheDocument()
  })
  it('handles invalid credentials in the login form', async () => {
    const service = serviceFor(null)
    service.signIn = vi
      .fn()
      .mockRejectedValue(
        new AppError('unauthorized', 'Correo o contraseña incorrectos.'),
      )
    mount(service, '/login')
    await screen.findByLabelText('Correo electrónico')
    const user = userEvent.setup()
    await user.type(
      screen.getByLabelText('Correo electrónico'),
      'test@example.test',
    )
    await user.type(screen.getByLabelText('Contraseña'), 'not-a-real-password')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('incorrectos')
  })
  it('logout event removes access', async () => {
    const service = serviceFor(profile)
    let callback!: (user: UserProfile | null) => void
    service.subscribe = (handler) => {
      callback = handler
      return () => {}
    }
    service.signOut = vi.fn(async () => callback(null))
    mount(service)
    await userEvent.click(await screen.findByText('Salir'))
    expect(
      await screen.findByRole('heading', { name: 'Todo comienza aquí.' }),
    ).toBeInTheDocument()
  })
  it('does not let stale restoration overwrite an auth event', async () => {
    const service = serviceFor(null)
    let resolve!: (user: UserProfile | null) => void
    service.getSession = () =>
      new Promise((r) => {
        resolve = r
      })
    service.subscribe = (handler) => {
      handler(profile)
      return () => {}
    }
    mount(service)
    expect(await screen.findByText('Private')).toBeInTheDocument()
    resolve(null)
    await waitFor(() => expect(screen.getByText('Private')).toBeInTheDocument())
  })
})
