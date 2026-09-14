import { ProductStockEditor } from './ProductStockEditor'
import { can } from '../../lib/permissions'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Button,
  Card,
  Dialog,
  ErrorState,
  Input,
  LoadingState,
  Select,
} from '../../components/ui'
import { useAccess } from '../../app/AccessContext'
import { useServices } from '../../services/useServices'
import { useQuery } from '../../lib/useQuery'
import { errorMessage } from '../../lib/errors'
import {
  labels,
  type Product,
  type PriceTier,
} from '../../lib/domain'
import { priceTierLabels } from '../../lib/pricing'
import {
  nioFromUsd,
  optimizeProductImage,
  productInput,
  productInputSchema,
} from './product'
import { formatCurrency } from '../../lib/format'

export function ProductEditorPage() {
  const { role, demo } = useAccess()
  const { id } = useParams()
  if (!can(role, 'product.manage') && !demo)
    return (
      <ErrorState message="Solo los administradores pueden editar el catálogo." />
    )
  return <ProductLoader key={id ?? 'new'} />
}
function ProductLoader() {
  const { id } = useParams()
  const { productService } = useServices()
  const { data, loading, error, retry } = useQuery(productService.listProducts)
  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} retry={retry} />
  const product = data?.find((p) => p.id === id)
  if (id && !product) return <ErrorState message="Producto no encontrado." />
  return (
    <ProductForm
      key={`${id ?? 'new'}:${product?.revision}`}
      product={product}
      brands={[...new Set(data?.map((p) => p.brand))]}
    />
  )
}
function ProductForm({
  product,
  brands,
}: {
  product?: Product
  brands: string[]
}) {
  const { base, demo } = useAccess()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { productService, settingsService } = useServices()
  // El precio en córdobas se calcula con esta tasa. Sin ella no se puede fijar
  // un precio, así que el formulario lo dice y no deja guardar a ciegas.
  const { data: savedRate } = useQuery(settingsService.getExchangeRate)
  const rate = savedRate?.usdToNio ?? null
  const [value, setValue] = useState(() => ({
    ...productInput(product),
    manufacturerBarcode:
      product?.manufacturerBarcode ?? params.get('barcode') ?? '',
  }))
  const [file, setFile] = useState<Blob | null>(null)
  const [preview, setPreview] = useState(product?.imageUrl ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Un aviso único no dice qué campo falta entre nueve datos y seis precios.
  // La clave es la ruta del dato («name», «prices.vip.USD»).
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const form = useRef<HTMLFormElement>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  useEffect(() => {
    return () => {
      if (preview.startsWith('blob:')) URL.revokeObjectURL(preview)
    }
  }, [preview])
  function update<K extends keyof typeof value>(
    key: K,
    next: (typeof value)[K],
  ) {
    setValue((v) => ({ ...v, [key]: next }))
  }
  async function choose(file?: File) {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const optimized = await optimizeProductImage(file)
      setFile(optimized)
      setPreview(URL.createObjectURL(optimized))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos leer esa imagen.')
    } finally {
      setBusy(false)
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (busy || demo) return
    const parsed = productInputSchema.safeParse(value)
    if (!parsed.success) {
      const found: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.')
        if (key && !found[key]) found[key] = issue.message
      }
      setFieldErrors(found)
      setError(
        `Revisa ${Object.keys(found).length === 1 ? 'el campo marcado' : 'los campos marcados'} antes de guardar.`,
      )
      // El primer campo con problema puede estar fuera de la pantalla.
      requestAnimationFrame(() =>
        form.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus(),
      )
      return
    }
    setFieldErrors({})
    setBusy(true)
    setError('')
    try {
      let imagePath = value.imagePath
      if (file) {
        imagePath = await productService.uploadProductImage(file)
        update('imagePath', imagePath)
        setFile(null) // Keep this path for a retry if the product save fails.
      }
      const savedId = await productService.saveProduct({
        ...parsed.data,
        imagePath,
      })
      navigate(
        product ? `${base}/inventory` : `${base}/products/${savedId}/edit`,
        {
          state: { message: 'Perfume guardado.' },
        },
      )
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    if (!product || busy || demo) return
    setBusy(true)
    setError('')
    try {
      const result = await productService.removeProduct(
        product.id,
        product.revision ?? 0,
      )
      navigate(`${base}/inventory`, {
        state: {
          message:
            result === 'archived'
              ? 'Perfume desactivado. Su historial se conserva.'
              : 'Perfume eliminado.',
        },
      })
    } catch (e) {
      setError(errorMessage(e))
      setConfirmRemove(false)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{product ? 'Editar perfume' : 'Nuevo perfume'}</h1>
          <p className="muted">
            {product?.barcode ?? 'El código interno se asignará al guardar.'}
          </p>
        </div>
        <Link className="button button-secondary" to={`${base}/inventory`}>
          Volver al inventario
        </Link>
      </div>
      {demo && (
        <p className="page-feedback">
          Vista de ejemplo. Inicia sesión como administrador para guardar
          cambios.
        </p>
      )}
      <form onSubmit={save} ref={form} noValidate>
        <fieldset disabled={busy} className="form-fields product-editor">
          <Card className="form-card">
            <h2>Foto del perfume</h2>
            <div className="editor-photo">
              {preview ? (
                <img src={preview} alt="Vista previa del perfume" />
              ) : (
                <p>Sin fotografía</p>
              )}
            </div>
            <Input
              label="Cambiar imagen"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                void choose(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <small className="muted">
              JPG, PNG o WebP. Se ajusta a 1200 píxeles para cargar más rápido.
            </small>
            {file && (
              <p className="optimized-photo-note">
                WebP · {Math.max(1, Math.round(file.size / 1024))} KB · Lista
                para guardar en Supabase
              </p>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setFile(null)
                setPreview('')
                update('imagePath', null)
              }}
            >
              Quitar foto
            </Button>
          </Card>
          <Card className="form-card">
            <h2>Datos del producto</h2>
            <div className="form-grid">
              <Input
                label="Nombre del perfume"
                required
                maxLength={200}
                error={fieldErrors.name}
                value={value.name}
                onChange={(e) => update('name', e.target.value)}
              />
              <Input
                label="Marca"
                required
                maxLength={100}
                error={fieldErrors.brand}
                list="product-brands"
                value={value.brand}
                onChange={(e) => update('brand', e.target.value)}
              />
              <datalist id="product-brands">
                {brands.map((brand) => (
                  <option key={brand} value={brand} />
                ))}
              </datalist>
              <Select
                label="Categoría"
                value={value.category}
                onChange={(e) =>
                  update('category', e.target.value as typeof value.category)
                }
              >
                {Object.entries(labels.category).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </Select>
              <Select
                label="Género"
                value={value.gender}
                onChange={(e) =>
                  update('gender', e.target.value as typeof value.gender)
                }
              >
                {Object.entries(labels.gender).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </Select>
              <Input
                label="Tamaño (vacío si falta confirmar)"
                error={fieldErrors.size}
                type="number"
                min={0.001}
                max={99999}
                step={0.001}
                value={value.size ?? ''}
                onChange={(e) =>
                  update(
                    'size',
                    e.target.value === '' ? null : e.target.valueAsNumber,
                  )
                }
              />
              <Select
                label="Unidad"
                value={value.unit}
                onChange={(e) => update('unit', e.target.value as 'oz' | 'ml')}
              >
                <option value="oz">Onzas (oz)</option>
                <option value="ml">Mililitros (ml)</option>
              </Select>
              <Input
                label="Código del fabricante (EAN / UPC)"
                error={fieldErrors.manufacturerBarcode}
                inputMode="numeric"
                maxLength={14}
                value={value.manufacturerBarcode}
                onChange={(e) => update('manufacturerBarcode', e.target.value)}
              />
              <Input
                label="Mínimo de inventario"
                error={fieldErrors.minimumStock}
                type="number"
                min={0}
                max={1000000}
                step={1}
                required
                value={
                  Number.isNaN(value.minimumStock) ? '' : value.minimumStock
                }
                onChange={(e) => update('minimumStock', e.target.valueAsNumber)}
              />
              <Select
                label="Estado"
                value={value.active ? 'active' : 'inactive'}
                onChange={(e) => update('active', e.target.value === 'active')}
              >
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </Select>
            </div>
          </Card>
          <Card className="form-card product-prices">
            <h2>Listas de precios</h2>
            <p className="muted">
              El precio se fija en dólares. El de córdobas sale de la tasa
              vigente
              {rate === null ? '' : ` de ${rate} C$ por dólar`} y se recalcula
              solo cuando el dueño cambia la tasa en Negocio.
            </p>
            {rate === null && (
              <p className="inline-error" role="alert">
                Todavía no hay tipo de cambio registrado. Regístralo en Negocio
                antes de fijar precios.
              </p>
            )}
            {(Object.keys(priceTierLabels) as PriceTier[]).map((tier) => {
              const nio = value.prices[tier].NIO
              // Un dólar vacío ya deja su propio aviso en el campo; repetirlo
              // bajo el córdoba sería marcar dos veces el mismo descuido.
              const usdError = fieldErrors[`prices.${tier}.USD`]
              const nioError = usdError
                ? undefined
                : fieldErrors[`prices.${tier}.NIO`]
              return (
                <div className="product-price-row" key={tier}>
                  <h3>{priceTierLabels[tier]}</h3>
                  <Input
                    label={`${priceTierLabels[tier]} USD`}
                    error={usdError}
                    type="number"
                    min={0.01}
                    max={10000000}
                    step={0.01}
                    required
                    value={
                      Number.isNaN(value.prices[tier].USD)
                        ? ''
                        : value.prices[tier].USD
                    }
                    onChange={(e) => {
                      const usd = e.target.valueAsNumber
                      update('prices', {
                        ...value.prices,
                        [tier]: { USD: usd, NIO: nioFromUsd(usd, rate) },
                      })
                    }}
                  />
                  <div
                    className={`product-price-derived ${nioError ? 'field-invalid' : ''}`}
                  >
                    <span>{priceTierLabels[tier]} NIO</span>
                    <strong>
                      {Number.isNaN(nio) ? '—' : formatCurrency(nio, 'NIO')}
                    </strong>
                    <small className={nioError ? 'field-error' : undefined}>
                      {nioError ?? 'Calculado con la tasa vigente'}
                    </small>
                  </div>
                </div>
              )
            })}
          </Card>
        </fieldset>
        {error && (
          <p role="alert" className="inline-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button disabled={busy || demo}>
            {busy ? 'Guardando…' : 'Guardar perfume'}
          </Button>
          {product && (
            <Button
              type="button"
              variant="secondary"
              disabled={busy || demo}
              onClick={() => setConfirmRemove(true)}
            >
              Retirar perfume
            </Button>
          )}
        </div>
      </form>
      {product ? (
        <ProductStockEditor product={product} disabled={busy} />
      ) : (
        <p className="page-feedback">
          Guarda el perfume para registrar sus cantidades en Tienda y Bodega.
        </p>
      )}
      {confirmRemove && (
        <Dialog
          open
          title="Retirar perfume"
          onClose={() => {
            if (!busy) setConfirmRemove(false)
          }}
        >
          <p>
            Se eliminará si fue creado por error y no tiene historial. Si
            aparece en documentos, movimientos o en la importación inicial,
            quedará inactivo y podrás reactivarlo.
          </p>
          <p>Un perfume con existencias debe registrar primero su salida.</p>
          <div className="form-actions">
            <Button disabled={busy} onClick={() => void remove()}>
              Confirmar retiro
            </Button>
            <Button
              disabled={busy}
              variant="secondary"
              onClick={() => setConfirmRemove(false)}
            >
              Cancelar
            </Button>
          </div>
        </Dialog>
      )}
    </>
  )
}
