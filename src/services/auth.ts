import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AppError } from '../lib/errors'
import { parseRole } from '../lib/permissions'
import type { UserProfile, UserRole } from '../lib/domain'
export interface AuthService {
  getSession(): Promise<UserProfile | null>
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  subscribe(callback: (user: UserProfile | null) => void): () => void
}
/**
 * El rol vive únicamente en `staff_members`, la misma tabla que consultan las
 * políticas de PostgreSQL. Leerlo del token abriría una segunda fuente que hay
 * que mantener a mano y que puede contradecir a la base. La política
 * `self_profile` permite a cada cuenta leer su propia fila y ninguna otra.
 */
export async function roleFromDatabase(
  userId: string,
): Promise<UserRole | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('staff_members')
    .select('role,active')
    .eq('user_id', userId)
    .maybeSingle()
  if (error)
    throw new AppError(
      'network',
      'No pudimos comprobar tu autorización. Inténtalo de nuevo.',
    )
  const row = data as { role: string; active: boolean } | null
  return row?.active ? parseRole(row.role) : null
}
export async function profileFromSession(
  session: Session | null,
): Promise<UserProfile | null> {
  return session
    ? {
        id: session.user.id,
        email: session.user.email ?? '',
        role: await roleFromDatabase(session.user.id),
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
    let active = true
    let version = 0
    let pending: ReturnType<typeof setTimeout> | undefined
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      const eventVersion = ++version
      clearTimeout(pending)
      if (!session) {
        callback(null)
        return
      }
      const publish = (user: UserProfile | null) => {
        if (active && eventVersion === version) callback(user)
      }
      // La consulta se difiere: supabase-js desaconseja llamar al cliente
      // dentro del propio callback de autenticación.
      pending = setTimeout(() => {
        profileFromSession(session)
          .then(publish)
          // Falla cerrado: sin rol comprobado no se concede acceso.
          .catch(() =>
            publish(
              session
                ? {
                    id: session.user.id,
                    email: session.user.email ?? '',
                    role: null,
                  }
                : null,
            ),
          )
      }, 0)
    })
    return () => {
      active = false
      version++
      clearTimeout(pending)
      data.subscription.unsubscribe()
    }
  },
}
