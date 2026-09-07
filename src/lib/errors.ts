export class AppError extends Error {
  constructor(
    public kind:
      | 'network'
      | 'validation'
      | 'unauthorized'
      | 'configuration'
      | 'unexpected',
    message: string,
  ) {
    super(message)
  }
}
export function errorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message
  if (!navigator.onLine || error instanceof TypeError)
    return 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.'
  return 'No pudimos completar la operación. Inténtalo de nuevo.'
}
