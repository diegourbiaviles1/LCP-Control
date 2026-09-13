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
async function authorizedProfile(session: Session | null): Promise<UserProfile | null> {
  const profile = profileFromSession(session)
  if (!profile) return null
  const { data, error } = await client().from('staff_members').select('role,active').eq('user_id',profile.id).maybeSingle()
  if (error) throw new AppError('network','No pudimos verificar los permisos de tu cuenta.')
  return { ...profile, role: data?.active ? parseRole(data.role) : null }
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
    return authorizedProfile(data.session)
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
    let revision = 0
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const current = ++revision
      // Avoid awaiting a Supabase request inside its auth event lock.
      setTimeout(() => {
        void authorizedProfile(session).then(profile => {
          if (active && current === revision) callback(profile)
        }).catch(() => {
          if (active && current === revision) callback(session ? { id:session.user.id,email:session.user.email ?? '',role:null } : null)
        })
      },0)
    })
    return () => { active=false; data.subscription.unsubscribe() }
  },
}
