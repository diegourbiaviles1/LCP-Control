import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  ScanLine,
  ShoppingBag,
  Layers3,
  Bell,
  LogOut,
  ArrowUpRight,
  Menu,
  X,
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { AccessContext } from './AccessContext'
import { Button, Badge } from '../components/ui'
import { errorMessage } from '../lib/errors'
const links = [
  ['', 'Resumen', LayoutDashboard],
  ['/inventory', 'Inventario', Package],
  ['/scanner', 'Escanear', ScanLine],
  ['/sales', 'Ventas', ShoppingBag],
  ['/products', 'Productos', Layers3],
  ['/alerts', 'Alertas', Bell],
] as const
export function AppShell({ demo = false }: { demo?: boolean }) {
  const { user, service } = useAuth()
  const base = demo ? '/demo' : ''
  const [online, setOnline] = useState(navigator.onLine)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState(false)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  async function logout() {
    setBusy(true)
    setError('')
    try {
      await service.signOut()
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  const role = demo ? 'operator' : (user?.role ?? null)
  return (
    <AccessContext.Provider value={{ demo, base, role }}>
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      <div className="app-layout">
        <aside className={`sidebar ${menu ? 'sidebar-open' : ''}`}>
          <Link className="brand" to={base || '/'}>
            <span className="brand-mark">L</span>
            <span>
              LCP <b>Control</b>
              <small>GESTIÓN DE PERFUMERÍA</small>
            </span>
          </Link>
          <Button
            className="close-menu"
            variant="ghost"
            aria-label="Cerrar menú"
            onClick={() => setMenu(false)}
          >
            <X />
          </Button>
          <span className="nav-label">ESPACIO DE TRABAJO</span>
          <nav aria-label="Navegación principal">
            {links.map(([path, label, Icon]) => (
              <NavLink
                key={path}
                end
                to={base + path || '/'}
                onClick={() => setMenu(false)}
              >
                <Icon size={19} />
                {label}
                {path === '/scanner' && <span className="nav-key">QR</span>}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="workspace-note">
              <span className="status-dot" /> Todo en un solo lugar
              <p>
                El control de tu tienda,
                <br />
                siempre a mano.
              </p>
            </div>
            <div className="user-block">
              <span className="avatar">
                {demo ? 'D' : user?.email.charAt(0).toUpperCase()}
              </span>
              <div>
                <strong>{demo ? 'Vista de demostración' : user?.email}</strong>
                <small>
                  {demo
                    ? 'Solo lectura'
                    : role === 'admin'
                      ? 'Administrador'
                      : 'Operador'}
                </small>
              </div>
            </div>
            {demo ? (
              <Link className="logout-link" to="/login">
                <LogOut size={16} /> Volver al acceso
              </Link>
            ) : (
              <Button variant="ghost" onClick={logout} disabled={busy}>
                <LogOut size={16} />
                {busy ? 'Cerrando…' : 'Cerrar sesión'}
              </Button>
            )}
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div className="topbar-label">
              <Button
                className="mobile-menu"
                variant="ghost"
                aria-label="Abrir menú"
                onClick={() => setMenu(true)}
              >
                <Menu size={20} />
              </Button>
              <span>Mi perfumería</span>
              <span className="topbar-divider">/</span>
              <span className="muted">Panel de control</span>
            </div>
            <div className="topbar-actions">
              <Badge>Foundation · 01</Badge>
              <Link aria-label="Ver alertas" to={`${base}/alerts`}>
                <Bell size={20} />
              </Link>
              <span className="avatar avatar-small">
                {demo ? 'D' : user?.email.charAt(0).toUpperCase()}
              </span>
            </div>
          </header>
          <div className="demo-banner">
            <span>
              <span className="status-dot" /> Datos de demostración · Solo
              lectura
            </span>
            <Link to="/login">
              {demo ? 'Conectar mi tienda' : 'Autenticación activa'}
              <ArrowUpRight size={14} />
            </Link>
          </div>
          {!online && (
            <div role="alert" className="offline-banner">
              Sin conexión. Los datos mostrados son de demostración; no se
              enviarán operaciones.
            </div>
          )}
          <main id="main" className="main-content">
            <Outlet />
          </main>
          <footer className="workspace-footer">
            LCP Control<span>Hecho para una operación más simple.</span>
          </footer>
        </div>
        <nav className="bottom-nav" aria-label="Navegación móvil">
          {links.slice(0, 4).map(([path, label, Icon]) => (
            <NavLink key={path} end to={base + path || '/'}>
              <Icon size={22} />
              <span>{label}</span>
            </NavLink>
          ))}
          <button onClick={() => setMenu(true)}>
            <Menu size={22} />
            <span>Más</span>
          </button>
        </nav>
      </div>
    </AccessContext.Provider>
  )
}
