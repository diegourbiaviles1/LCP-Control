import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ArrowRight, ScanLine, ShieldCheck } from 'lucide-react'
import { useAuth } from './AuthContext'
import { Button, Feedback, Input, LoadingState } from '../../components/ui'
import { loginSchema } from '../../lib/validation'
import { errorMessage } from '../../lib/errors'
import { authConfigured } from '../../lib/supabase'
export function LoginPage() {
  const { user, loading, service } = useAuth()
  const location = useLocation()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (loading) return <LoadingState />
  const from: unknown = location.state?.from
  if (user)
    return (
      <Navigate
        to={
          typeof from === 'string' &&
          /^\/(?!\/)/.test(from) &&
          from !== '/login'
            ? from
            : '/'
        }
        replace
      />
    )
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const result = loginSchema.safeParse({
      email: data.get('email'),
      password: data.get('password'),
    })
    if (!result.success) {
      setError(result.error.issues[0].message)
      return
    }
    setBusy(true)
    setError('')
    try {
      await service.signIn(result.data.email, result.data.password)
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="login-layout">
      <section className="login-story">
        <Link className="brand" to="/login">
          <span className="brand-mark">L</span>
          <span>
            LCP <b>Control</b>
          </span>
        </Link>
        <div>
          <span className="eyebrow">CADA DETALLE, BAJO CONTROL</span>
          <h1>
            Tu perfumería.
            <br />
            En perfecto orden.
          </h1>
          <p>
            Menos tareas. Más claridad.
            <br />
            El espacio para gestionar tu inventario y acompañar cada venta.
          </p>
          <div className="login-feature">
            <ScanLine />
            <span>Escanea. Encuentra. Continúa.</span>
          </div>
        </div>
        <span className="login-footer">UN SOLO ESPACIO PARA TU OPERACIÓN</span>
      </section>
      <section className="login-form">
        <span className="eyebrow">BIENVENIDO A LCP CONTROL</span>
        <h2>Todo comienza aquí.</h2>
        <p className="muted">Ingresa con la cuenta de tu tienda.</p>
        <form onSubmit={submit}>
          <Input
            label="Correo electrónico"
            name="email"
            type="email"
            placeholder="tu@correo.com"
            autoComplete="username"
            required
          />
          <Input
            label="Contraseña"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Tu contraseña"
            required
          />
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? 'Iniciando sesión…' : 'Iniciar sesión'}
            <ArrowRight size={18} />
          </Button>
        </form>
        {!authConfigured && (
          <Feedback>
            Supabase pendiente de configuración. Explora Foundation con datos de
            demostración.
          </Feedback>
        )}
        <Link className="demo-link" to="/demo">
          Explorar demostración <ArrowRight size={16} />
        </Link>
        <p className="login-note">
          <ShieldCheck size={16} /> Acceso privado. Solicita tu cuenta al
          administrador.
        </p>
      </section>
    </main>
  )
}
