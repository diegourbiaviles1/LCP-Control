import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AppError } from '../lib/errors'
import { parseRole } from '../lib/permissions'
import type { UserProfile } from '../lib/domain'
export interface AuthService {
  getSession(): Promise<UserProfile | null>
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  subscribe(callback: (user: UserProfile | null) => void): () => void
}
export function profileFromSession(
  session: Session | null,
): UserProfile | null {
  return session
    ? {
        id: session.user.id,
        email: session.user.email ?? '',
        role: parseRole(session.user.app_metadata.role),
      }
    : null
}
function client() {
  if (!supabase)
    throw new AppError(
      'configuration',
      'Configura Supabase para acceder con tu cuenta. Puedes explorar la demostración.',
    )
  return supabase
}
export const authService: AuthService = {
  async getSession() {
    if (!supabase) return null
    const { data, error } = await supabase.auth.getSession()
    if (error)
      throw new AppError(
        'network',
        'No pudimos restaurar tu sesión. Vuelve a intentarlo.',
      )
    return profileFromSession(data.session)
  },
  async signIn(email, password) {
    const { error } = await client().auth.signInWithPassword({
      email,
      password,
    })
    if (error)
      throw new AppError(
        error.status === 400 ? 'unauthorized' : 'network',
        error.status === 400
          ? 'Correo o contraseña incorrectos, o cuenta no habilitada.'
          : 'No pudimos iniciar sesión. Revisa tu conexión e inténtalo de nuevo.',
      )
  },
  async signOut() {
    const { error } = await client().auth.signOut({ scope: 'local' })
    if (error)
      throw new AppError(
        'network',
        'No pudimos cerrar la sesión. Inténtalo de nuevo.',
      )
  },
  subscribe(callback) {
    if (!supabase) return () => {}
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      callback(profileFromSession(session)),
    )
    return () => data.subscription.unsubscribe()
  },
}
