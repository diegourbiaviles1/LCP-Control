import { useState, type FormEvent } from 'react'
import { useAuth } from './AuthContext'
import { useAccess } from '../../app/AccessContext'
import { supabase } from '../../lib/supabase'
import { useQuery } from '../../lib/useQuery'
import {
  Button,
  Card,
  Input,
  LoadingState,
  ErrorState,
} from '../../components/ui'
async function getProfile() {
  if (!supabase) throw new Error('Falta configurar Supabase.')
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw new Error('Vuelve a iniciar sesión.')
  const { data, error } = await supabase
    .from('staff_members')
    .select('display_name')
    .eq('user_id', auth.user.id)
    .single()
  if (error) throw new Error('No pudimos leer tu perfil.')
  return data.display_name as string
}
export function AccountPage() {
  const { demo } = useAccess()
  return demo ? (
    <AccountForm initialName="Usuario de ejemplo" />
  ) : (
    <AccountLoader />
  )
}
function AccountLoader() {
  const { data, loading, error, retry } = useQuery(getProfile)
  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} retry={retry} />
  return <AccountForm initialName={data ?? ''} />
}
function AccountForm({ initialName }: { initialName: string }) {
  const { user } = useAuth()
  const { demo } = useAccess()
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function save(
    event: FormEvent,
    section: 'name' | 'email' | 'password',
  ) {
    event.preventDefault()
    if (busy || demo || !supabase) return
    setMessage('')
    setError('')
    if (
      section === 'password' &&
      (password.length < 10 || password !== repeat)
    ) {
      setError('Usa al menos 10 caracteres y repite la misma contraseña.')
      return
    }
    setBusy(true)
    try {
      const result =
        section === 'name'
          ? await supabase.rpc('update_my_profile', { p_name: name.trim() })
          : await supabase.auth.updateUser(
              section === 'email' ? { email: email.trim() } : { password },
            )
      if (result.error) {
        setError(
          'No se pudo completar el cambio. Revisa los datos; si tu sesión venció, vuelve a entrar.',
        )
        return
      }
      setMessage(
        section === 'email'
          ? 'Solicitud enviada. Revisa los correos de confirmación para completar el cambio de dirección.'
          : section === 'password'
            ? 'Contraseña actualizada.'
            : 'Nombre actualizado.',
      )
      setPassword('')
      setRepeat('')
    } catch {
      setError('No pudimos conectar. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Mi cuenta</h1>
          <p className="muted">
            Actualiza tu nombre y los datos con los que entras al sistema.
          </p>
        </div>
      </div>
      {demo && (
        <p className="page-feedback">
          Vista de ejemplo. Los cambios requieren iniciar sesión.
        </p>
      )}
      <div className="account-grid">
        <Card className="form-card">
          <form onSubmit={(e) => void save(e, 'name')}>
            <h2>Perfil</h2>
            <Input
              label="Nombre visible"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="muted">
              Rol:{' '}
              {user?.role === 'admin'
                ? 'Administrador'
                : demo
                  ? 'Ejemplo'
                  : 'Operador'}
            </p>
            <Button disabled={busy || demo}>Guardar nombre</Button>
          </form>
        </Card>
        <Card className="form-card">
          <form onSubmit={(e) => void save(e, 'email')}>
            <h2>Correo de acceso</h2>
            <Input
              label="Nuevo correo"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="muted">
              El cambio puede requerir confirmación por correo.
            </p>
            <Button disabled={busy || demo || email === user?.email}>
              Cambiar correo
            </Button>
          </form>
        </Card>
        <Card className="form-card">
          <form onSubmit={(e) => void save(e, 'password')}>
            <h2>Contraseña</h2>
            <Input
              label="Nueva contraseña"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input
              label="Repetir contraseña"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
            />
            <Button disabled={busy || demo}>Cambiar contraseña</Button>
          </form>
        </Card>
      </div>
      {message && (
        <p role="status" className="page-feedback">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
    </>
  )
}
