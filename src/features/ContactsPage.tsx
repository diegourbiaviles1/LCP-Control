import { Users, Truck, Plus, Phone, Mail, MapPin, Pencil } from 'lucide-react'
import {
  WorkspaceHeading,
  WorkspaceEmpty,
} from '../components/WorkspacePresentation'
import { priceTierLabels } from '../lib/pricing'
import type { PriceTier } from '../lib/domain'
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
  const [status, setStatus] = useState('active')
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
  const visible = (data ?? []).filter(
    (r) =>
      (status === 'all' || r.active === (status === 'active')) &&
      `${r.name} ${r.phone} ${r.email}`
        .toLocaleLowerCase('es')
        .includes(search.toLocaleLowerCase('es')),
  )
  return (
    <>
      <WorkspaceHeading
        eyebrow="RELACIONES DEL NEGOCIO"
        title={supplier ? 'Proveedores' : 'Clientes'}
        description={
          supplier
            ? 'Contactos, marcas y acuerdos, siempre a la mano.'
            : 'Conoce a tus clientes y ten sus datos listos para cada venta.'
        }
        icon={supplier ? Truck : Users}
      >
        {editable && (
          <Button onClick={() => setForm({ ...empty })}>
            <Plus size={17} />
            Nuevo {supplier ? 'proveedor' : 'cliente'}
          </Button>
        )}
      </WorkspaceHeading>
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
              <span className="section-kicker">
                {form.id ? 'ACTUALIZAR CONTACTO' : 'NUEVO CONTACTO'}
              </span>
              <h2>
                {form.id
                  ? 'Editar datos'
                  : supplier
                    ? 'Registrar proveedor'
                    : 'Registrar cliente'}
              </h2>
            </div>
          </div>
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
      <div className="directory-toolbar">
        <Input
          label="Buscar"
          type="search"
          placeholder={
            supplier
              ? 'Nombre, correo o teléfono del proveedor'
              : 'Nombre, correo o teléfono del cliente'
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          label="Mostrar"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="active">Activos</option>
          <option value="all">Todos</option>
          <option value="archived">Archivados</option>
        </Select>
        <span className="directory-count">
          {visible.length} {supplier ? 'proveedores' : 'clientes'}
        </span>
      </div>
      <div className="record-grid">
        {visible.map((r) => (
          <Card key={r.id} className="record-card contact-card">
            <div className="record-card-top">
              <span className="record-avatar">
                {r.name.trim().slice(0, 2).toLocaleUpperCase('es')}
              </span>
              <span className={`record-badge ${r.active ? '' : 'is-muted'}`}>
                {r.active ? 'Activo' : 'Archivado'}
              </span>
            </div>
            <h2>{r.name}</h2>
            {!supplier && (
              <span className="contact-tier">
                Lista {priceTierLabels[r.priceTier as PriceTier] ?? r.priceTier}
              </span>
            )}
            <div className="contact-details">
              <p>
                <Phone size={14} />
                {r.phone || 'Sin teléfono'}
              </p>
              {r.email && (
                <p>
                  <Mail size={14} />
                  {r.email}
                </p>
              )}
              {r.address && (
                <p>
                  <MapPin size={14} />
                  {r.address}
                </p>
              )}
            </div>
            {(r.taxId || r.contact || r.brands || r.terms || r.notes) && (
              <dl className="record-details">
                {[
                  ['RUC', r.taxId],
                  ['Contacto', r.contact],
                  ['Marcas', r.brands],
                  ['Condiciones', r.terms],
                  ['Notas', r.notes],
                ]
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
              </dl>
            )}
            {editable && (
              <div className="record-card-footer">
                <Button variant="ghost" onClick={() => setForm(r)}>
                  <Pencil size={14} />
                  Editar
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
      {!loading && !error && visible.length === 0 && (
        <WorkspaceEmpty
          icon={supplier ? Truck : Users}
          title={
            data?.length
              ? 'Sin coincidencias'
              : supplier
                ? 'Tus proveedores, en un solo lugar'
                : 'Aquí empieza la relación con tus clientes'
          }
          description={
            data?.length
              ? 'Prueba otra búsqueda o cambia el estado seleccionado.'
              : supplier
                ? 'Registra tu primer proveedor para guardar sus contactos y condiciones.'
                : 'Registra tu primer cliente y selecciónalo al preparar una factura o proforma.'
          }
        />
      )}
    </>
  )
}
