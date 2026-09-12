export function Brand({
  wordmark = false,
  className = '',
}: {
  wordmark?: boolean
  className?: string
}) {
  return (
    <img
      className={`${wordmark ? 'brand-wordmark' : 'brand-monogram'} ${className}`}
      src={`/brand/${wordmark ? 'wordmark-wine' : 'monogram-wine'}.jpeg`}
      alt="La Casa del Perfume"
    />
  )
}
