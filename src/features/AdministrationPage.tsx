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
  if (!permitted)
    return (
      <ErrorState message="Solo los administradores pueden gestionar usuarios." />
    )
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form || busy) return
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
      <div className="page-heading">
        <h1>Usuarios y permisos</h1>
        <Button
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
          Autorizar correo
        </Button>
      </div>
      <p>
        SuperAdmin y administradores gestionan el negocio. Ventas registra
        clientes y documentos. Inventario registra movimientos. Solo consulta
        puede ver catálogo y existencias.
      </p>
      {message && <p role="status">{message}</p>}
      {loading && <LoadingState />}
      {error && <ErrorState message={error} retry={retry} />}
      {form && (
        <Card>
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
            <Button disabled={busy}>Guardar</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setForm(null)}
            >
              Cancelar
            </Button>
          </form>
        </Card>
      )}
      <div className="supplier-grid">
        {data?.map((r) => (
          <Card key={r.email}>
            <h2>{r.display_name}</h2>
            <p>{r.email}</p>
            <p>
              {roleLabels[r.role]} · {r.active ? 'Activo' : 'Deshabilitado'} ·{' '}
              {r.registered ? 'Registrado' : 'Pendiente de activación'}
            </p>
            {(r.role !== 'superadmin' || role === 'superadmin') && (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingEmail(true)
                  setForm(r)
                }}
              >
                Editar permisos
              </Button>
            )}
          </Card>
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
  if (demo || !can(role, 'settings.manage'))
    return (
      <ErrorState message="Solo los administradores pueden configurar el negocio." />
    )
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
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
      <h1>Datos del negocio</h1>
      <p>
        Se usan en los documentos nuevos. Los documentos emitidos conservan sus
        datos originales.
      </p>
      {loading && <LoadingState />}
      {error && <ErrorState message={error} retry={retry} />}
      <Card>
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
            <Button disabled={busy}>Guardar</Button>
          </form>
        )}
        {message && <p role="status">{message}</p>}
      </Card>
    </>
  )
}
