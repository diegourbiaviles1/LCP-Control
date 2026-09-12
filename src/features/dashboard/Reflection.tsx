import { useEffect, useState } from 'react'
import { nextReflection, reflections } from './quotes'
export function Reflection() {
  const [selection] = useState(() => {
    let history = ''
    try {
      const quote = nextReflection({
        getItem: (key) => localStorage.getItem(key),
        setItem: (_key, value) => {
          history = value
        },
      })
      return { quote, history }
    } catch {
      return { quote: reflections[0], history }
    }
  })
  useEffect(() => {
    if (selection.history) {
      try {
        localStorage.setItem('lcp.reflections.v1', selection.history)
      } catch {
        /* A reflection is still shown without storage. */
      }
    }
  }, [selection])
  return (
    <div className="reflection">
      <span>Para comenzar el día</span>
      <blockquote>{selection.quote}</blockquote>
    </div>
  )
}
