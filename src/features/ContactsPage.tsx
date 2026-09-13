import { useCallback, useState, type FormEvent } from 'react'
import {
  Button,
  Card,
  Input,
  Select,
  LoadingState,
  ErrorState,
} from '../components/ui'
import { useQuery } from '../lib/useQuery'
import { useAccess } from '../app/AccessContext'
import { can } from '../lib/permissions'
import { AppError, errorMessage } from '../lib/errors'
import {
  listContacts,
  saveContact,
  type ContactRecord,
} from '../services/workspace'
import { whatsappNumber } from './sales/whatsapp'
const empty: ContactRecord = {
  id: '',
  revision: 0,
  name: '',
  phone: '',
  email: '',
  taxId: '',
  address: '',
  notes: '',
  active: true,
  contact: '',
  brands: '',
  terms: '',
  priceTier: 'emprendedor',
}
export function ContactsPage({ kind }: { kind: 'customers' | 'suppliers' }) {
  const { demo, role } = useAccess()
  const supplier = kind === 'suppliers'
  const permitted = can(role, supplier ? 'supplier.read' : 'customer.read')
  const load = useCallback(
    () => (demo || !permitted ? Promise.resolve([]) : listContacts(kind)),
    [demo, kind, permitted],
  )
  const { data, loading, error, retry } = useQuery(load)
  const [form, setForm] = useState<ContactRecord | null>(null)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  if (!permitted && !demo)
    return <ErrorState message="Tu cuenta no tiene acceso a este registro." />
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form || busy) return
    setBusy(true)
    setMessage('')
    try {
      const phone = supplier ? form.phone : whatsappNumber(form.phone)
      if (!supplier && form.phone && !phone)
        throw new AppError('validation', 'Revisa el teléfono del cliente.')
      await saveContact(kind, {
        ...form,
        id: form.id || crypto.randomUUID(),
        phone: phone ?? '',
      })
      setForm(null)
      retry()
      setMessage('Datos guardados.')
    } catch (e) {
      setMessage(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const editable =
    !demo && can(role, supplier ? 'supplier.manage' : 'customer.manage')
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{supplier ? 'Proveedores' : 'Clientes'}</h1>
          <p className="muted">Datos compartidos con el personal autorizado.</p>
        </div>
        {editable && (
          <Button onClick={() => setForm({ ...empty })}>
            Nuevo {supplier ? 'proveedor' : 'cliente'}
          </Button>
        )}
      </div>
      {message && <p role="status">{message}</p>}
      {loading && <LoadingState />}
      {error && <ErrorState message={error} retry={retry} />}
      {form && (
        <Card className="form-card">
          <h2>{form.id ? 'Editar datos' : 'Registrar datos'}</h2>
          <form onSubmit={submit}>
            <div className="form-grid">
              {(
                [
                  ['name', 'Nombre', 160],
                  ['phone', 'Teléfono / WhatsApp', 60],
                  ['email', 'Correo', 254],
                  ['taxId', 'RUC', 80],
                  ['address', 'Dirección', 600],
                  ...(supplier
                    ? [
                        ['contact', 'Contacto', 160],
                        ['brands', 'Marcas', 500],
                        ['terms', 'Condiciones', 500],
                      ]
                    : []),
                  ['notes', 'Notas', 1500],
                ] as [keyof ContactRecord, string, number][]
              ).map(([key, label, max]) => (
                <Input
                  key={key}
                  label={label}
                  required={key === 'name'}
                  type={key === 'email' ? 'email' : 'text'}
                  maxLength={max}
                  value={String(form[key] ?? '')}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              ))}
              {!supplier && (
                <Select
                  label="Lista de precios"
                  value={form.priceTier}
                  disabled={!can(role, 'product.manage')}
                  onChange={(e) =>
                    setForm({ ...form, priceTier: e.target.value })
                  }
                >
                  <option value="emprendedor">Emprendedor</option>
                  <option value="vip">VIP</option>
                  <option value="premium">Premium</option>
                </Select>
              )}
              {can(role, 'product.manage') && (
                <Select
                  label="Estado"
                  value={String(form.active)}
                  onChange={(e) =>
                    setForm({ ...form, active: e.target.value === 'true' })
                  }
                >
                  <option value="true">Activo</option>
                  <option value="false">Archivado</option>
                </Select>
              )}
            </div>
            <div className="form-actions">
              <Button disabled={busy} type="submit">
                {busy ? 'Guardando…' : 'Guardar'}
              </Button>
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
      <Input
        label="Buscar"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="supplier-grid">
        {data
          ?.filter((r) =>
            `${r.name} ${r.phone}`.toLowerCase().includes(search.toLowerCase()),
          )
          .map((r) => (
            <Card key={r.id}>
              <h2>{r.name}</h2>
              <p>
                {r.phone || 'Sin teléfono'} ·{' '}
                {r.active ? 'Activo' : 'Archivado'}
              </p>
              <p>{r.email}</p>
              <p>{r.address}</p>
              {r.taxId && <p>RUC: {r.taxId}</p>}
              {supplier && (
                <>
                  <p>{r.contact}</p>
                  <p>{r.brands}</p>
                  <p>{r.terms}</p>
                </>
              )}
              {!supplier && <p>Lista: {r.priceTier}</p>}
              <p>{r.notes}</p>
              {editable && (
                <Button variant="secondary" onClick={() => setForm(r)}>
                  Editar
                </Button>
              )}
            </Card>
          ))}
      </div>
      {data?.length === 0 && (
        <p>No hay {supplier ? 'proveedores' : 'clientes'} registrados.</p>
      )}
    </>
  )
}
