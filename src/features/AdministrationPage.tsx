import { UsersRound, ShieldCheck, Store, UserPlus, Pencil } from 'lucide-react'
import {
  WorkspaceHeading,
  WorkspaceEmpty,
} from '../components/WorkspacePresentation'
import { Brand } from '../components/Brand'
import { useState, useCallback, type FormEvent } from 'react'
import {
  Button,
  Card,
  Input,
  Select,
  ErrorState,
  LoadingState,
} from '../components/ui'
import { useAccess } from '../app/AccessContext'
import { can, roleLabels } from '../lib/permissions'
import { useQuery } from '../lib/useQuery'
import { errorMessage } from '../lib/errors'
import {
  listStaff,
  saveStaff,
  rpc,
  type StaffAccount,
} from '../services/workspace'
import { useServices } from '../services/useServices'
import type { UserRole } from '../lib/domain'
export function StaffPage() {
  const { demo, role } = useAccess()
  const permitted = !demo && can(role, 'staff.manage')
  const load = useCallback(
    () => (permitted ? listStaff() : Promise.resolve([])),
    [permitted],
  )
  const { data, error, loading, retry } = useQuery(load)
  const [form, setForm] = useState<StaffAccount | null>(null)
  const [editingEmail, setEditingEmail] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  if (!permitted && !demo)
    return (
      <ErrorState message="Solo los administradores pueden gestionar usuarios." />
    )
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form || busy || !permitted) return
    setBusy(true)
    try {
      await saveStaff(form)
      setForm(null)
      retry()
      setMessage(
        'Acceso guardado. Las cuentas nuevas se activan desde la pantalla de acceso.',
      )
    } catch (e) {
      setMessage(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <WorkspaceHeading
        eyebrow="EQUIPO DE LA TIENDA"
        title="Usuarios y permisos"
        description="Cada persona con el acceso que necesita para trabajar."
        icon={UsersRound}
      >
        <Button
          disabled={demo}
          onClick={() => {
            setEditingEmail(false)
            setForm({
              email: '',
              display_name: '',
              role: 'operator',
              active: true,
              registered: false,
            })
          }}
        >
          <UserPlus size={17} /> Autorizar correo
        </Button>
      </WorkspaceHeading>
      <div className="access-note">
        <ShieldCheck size={21} />
        <div>
          <strong>Un acceso personal para cada integrante</strong>
          <p>
            Autoriza su correo, asigna sus permisos y deja que active su propia
            cuenta.
          </p>
        </div>
      </div>
      {message && (
        <p role="status" className="workspace-feedback">
          {message}
        </p>
      )}
      {loading && <LoadingState />}
      {error && <ErrorState message={error} retry={retry} />}
      {form && (
        <Card className="form-card record-form">
          <div className="section-heading">
            <div>
              <span className="section-kicker">ACCESO DEL PERSONAL</span>
              <h2>
                {editingEmail ? 'Editar permisos' : 'Autorizar una cuenta'}
              </h2>
            </div>
          </div>
          <form onSubmit={submit}>
            <div className="form-grid">
              <Input
                label="Correo"
                type="email"
                required
                value={form.email}
                disabled={editingEmail}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <Input
                label="Nombre"
                required
                maxLength={100}
                value={form.display_name}
                onChange={(e) =>
                  setForm({ ...form, display_name: e.target.value })
                }
              />
              <Select
                label="Permisos"
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as UserRole })
                }
              >
                {Object.entries(roleLabels)
                  .filter(([r]) => r !== 'superadmin' || role === 'superadmin')
                  .map(([r, label]) => (
                    <option key={r} value={r}>
                      {label}
                    </option>
                  ))}
              </Select>
              <Select
                label="Estado"
                value={String(form.active)}
                onChange={(e) =>
                  setForm({ ...form, active: e.target.value === 'true' })
                }
              >
                <option value="true">Activo</option>
                <option value="false">Deshabilitado</option>
              </Select>
            </div>
            <div className="form-actions">
              <Button disabled={busy || demo}>Guardar</Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setForm(null)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}
      <div className="record-grid">
        {data?.map((r) => (
          <Card key={r.email} className="record-card staff-card">
            <div className="record-card-top">
              <span className="record-avatar">
                <ShieldCheck size={22} />
              </span>
              <span
                className={`record-badge ${!r.active ? 'is-muted' : !r.registered ? 'is-pending' : ''}`}
              >
                {!r.active
                  ? 'Deshabilitado'
                  : r.registered
                    ? 'Activo'
                    : 'Por activar'}
              </span>
            </div>
            <h2>{r.display_name}</h2>
            <p className="record-email">{r.email}</p>
            <span className="role-pill">{roleLabels[r.role]}</span>
            {(r.role !== 'superadmin' || role === 'superadmin') && (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingEmail(true)
                  setForm(r)
                }}
              >
                <Pencil size={14} /> Editar permisos
              </Button>
            )}
          </Card>
        ))}
      </div>
      {!loading && !error && !data?.length && (
        <WorkspaceEmpty
          icon={UsersRound}
          title="Tu equipo comienza aquí"
          description="Las cuentas autorizadas aparecerán con su rol y estado de activación."
        />
      )}
      <div className="role-guide">
        {[
          ['Administración', 'Catálogo, ventas, inventario y equipo.'],
          ['Ventas', 'Clientes, facturas, proformas y salidas.'],
          ['Inventario', 'Entradas, salidas, daños y conteos.'],
          ['Solo consulta', 'Catálogo, fotografías y existencias.'],
        ].map(([title, detail]) => (
          <div key={title}>
            <strong>{title}</strong>
            <p>{detail}</p>
          </div>
        ))}
      </div>
    </>
  )
}
export function BusinessPage() {
  const { demo, role } = useAccess()
  const { salesService } = useServices()
  const { data, error, loading, retry } = useQuery(salesService.getBusiness)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  if (!demo && !can(role, 'settings.manage'))
    return (
      <ErrorState message="Solo los administradores pueden configurar el negocio." />
    )
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (demo || busy || !can(role, 'settings.manage')) return
    const f = new FormData(e.currentTarget)
    setBusy(true)
    try {
      await rpc('save_business_settings', {
        p_name: f.get('name'),
        p_address: f.get('address'),
        p_phone: f.get('phone'),
      })
      setMessage('Datos del negocio guardados.')
      retry()
    } catch (e) {
      setMessage(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <WorkspaceHeading
        eyebrow="IDENTIDAD COMERCIAL"
        title="Datos del negocio"
        description="La información que acompaña a cada factura y proforma."
        icon={Store}
      />
      {loading && <LoadingState />}
      {error && <ErrorState message={error} retry={retry} />}
      <div className="business-settings-layout">
        <Card className="business-identity">
          <Brand wordmark />
          <span className="section-kicker">LA CASA DEL PERFUME</span>
          <h2>El sello de tu negocio</h2>
          <p>
            Mantén tus datos de contacto al día para que tus clientes siempre
            sepan dónde encontrarte.
          </p>
          <div className="business-note">
            <ShieldCheck size={18} />
            <span>
              Los documentos emitidos conservan su información original.
            </span>
          </div>
        </Card>
        <Card className="form-card record-form">
          <div className="section-heading">
            <div>
              <span className="section-kicker">INFORMACIÓN GENERAL</span>
              <h2>Cómo te encuentran tus clientes</h2>
            </div>
          </div>
          {data && (
            <form onSubmit={submit} key={JSON.stringify(data)}>
              <Input
                label="Nombre comercial"
                name="name"
                required
                maxLength={160}
                defaultValue={data.name}
              />
              <Input
                label="Dirección"
                name="address"
                maxLength={600}
                defaultValue={data.address}
              />
              <Input
                label="Teléfono"
                name="phone"
                maxLength={60}
                defaultValue={data.phone}
              />
              <Button disabled={busy || demo}>Guardar</Button>
            </form>
          )}
          {message && (
            <p role="status" className="workspace-feedback">
              {message}
            </p>
          )}
        </Card>
      </div>
    </>
  )
}
