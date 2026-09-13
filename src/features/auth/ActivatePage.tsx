import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Button, Card, Input } from '../../components/ui'
import { Brand } from '../../components/Brand'
export function ActivatePage() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    const f = new FormData(e.currentTarget)
    const password = String(f.get('password'))
    if (password !== f.get('repeat')) {
      setMessage('Las contraseñas no coinciden.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      if (!supabase) throw Error()
      const { error } = await supabase.auth.signUp({
        email: String(f.get('email')).trim().toLowerCase(),
        password,
      })
      if (error) {
        setMessage(
          error.code === 'email_address_not_authorized'
            ? 'Falta habilitar el envío de correos de acceso para esta dirección. Comunícalo al administrador.'
            : error.status === 429
              ? 'Se alcanzó el límite temporal de correos. Espera antes de intentarlo otra vez.'
              : 'No se pudo activar la cuenta. Verifica que el administrador haya autorizado tu correo; si ya te registraste, inicia sesión.',
        )
        return
      }
      setMessage(
        'Registro recibido. Confirma tu correo y después vuelve a Iniciar sesión.',
      )
    } catch {
      setMessage('No pudimos conectar. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="main-content activation-page">
      <Card className="form-card">
        <Brand wordmark />
        <h1>Activar mi cuenta</h1>
        <p>
          Solo pueden registrarse los correos autorizados por el administrador.
          Elige una contraseña personal.
        </p>
        <form onSubmit={submit}>
          <Input
            label="Correo autorizado"
            name="email"
            type="email"
            required
            autoComplete="username"
          />
          <Input
            label="Contraseña"
            name="password"
            type="password"
            minLength={12}
            required
            autoComplete="new-password"
          />
          <Input
            label="Repetir contraseña"
            name="repeat"
            type="password"
            minLength={12}
            required
            autoComplete="new-password"
          />
          <p className="muted">Usa al menos 12 caracteres.</p>
          <Button disabled={busy}>
            {busy ? 'Registrando…' : 'Crear mi acceso'}
          </Button>
        </form>
        {message && <p role="status">{message}</p>}
        <Link to="/login">Iniciar sesión</Link>
      </Card>
    </main>
  )
}
