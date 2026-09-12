import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import { AlertCircle, LoaderCircle, PackageOpen, X } from 'lucide-react'
export function Button({
  className = '',
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
}) {
  return (
    <button className={`button button-${variant} ${className}`} {...props} />
  )
}
export function Input({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId()
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} {...props} />
    </label>
  )
}
export function Select({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId()
  return (
    <label className="field" htmlFor={id}>
      <span id={`${id}-label`}>{label}</span>
      <select id={id} aria-labelledby={`${id}-label`} {...props}>
        {children}
      </select>
    </label>
  )
}
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'warning' | 'danger' | 'success'
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}
export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <section className={`card ${className}`}>{children}</section>
}
export function LoadingState() {
  return (
    <div className="state" role="status">
      <LoaderCircle className="spin" size={28} />
      <p>Cargando información…</p>
    </div>
  )
}
export function EmptyState({
  title = 'No hay resultados',
  description = 'Prueba con otra búsqueda o cambia los filtros.',
}: {
  title?: string
  description?: string
}) {
  return (
    <div className="state">
      <PackageOpen size={32} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}
export function ErrorState({
  message,
  retry,
}: {
  message: string
  retry?: () => void
}) {
  return (
    <div className="state error" role="alert">
      <AlertCircle size={28} />
      <p>{message}</p>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}
export function Feedback({ children }: { children: ReactNode }) {
  return (
    <div className="feedback" role="status">
      {children}
    </div>
  )
}
export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (open) dialog?.showModal()
    else dialog?.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="section-heading">
        <h2 id={titleId}>{title}</h2>
        <Button variant="ghost" aria-label="Cerrar" onClick={onClose}>
          <X size={20} />
        </Button>
      </div>
      {children}
    </dialog>
  )
}
