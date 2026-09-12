import { useState } from 'react'
import { z } from 'zod'
// Browser-only drafts. Never used as authoritative stock, sales or authorization.
export function useLocalDrafts<T>(key: string, schema: z.ZodType<T>) {
  const [error, setError] = useState('')
  const [items, setItems] = useState<T[]>(() => {
    try {
      const parsed = z
        .array(schema)
        .safeParse(JSON.parse(localStorage.getItem(key) ?? '[]'))
      return parsed.success ? parsed.data : []
    } catch {
      return []
    }
  })
  function save(next: T[]) {
    const parsed = z.array(schema).safeParse(next)
    if (!parsed.success) {
      setError('Revisa los campos del formulario.')
      return false
    }
    try {
      localStorage.setItem(key, JSON.stringify(parsed.data))
      setItems(parsed.data)
      setError('')
      return true
    } catch {
      setError(
        'No se pudo guardar en este navegador. Conserva el formulario abierto e inténtalo de nuevo.',
      )
      return false
    }
  }
  return { items, save, error }
}
