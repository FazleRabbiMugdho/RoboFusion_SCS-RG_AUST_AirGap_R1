import { useState, type ImgHTMLAttributes } from 'react'

interface ImageWithFallbackProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string
}

export function ImageWithFallback({
  src,
  fallback = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100%" height="100%" fill="%231E293B"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2364748B" font-size="12">Image</text></svg>',
  alt = '',
  ...props
}: ImageWithFallbackProps) {
  const [error, setError] = useState(false)

  return (
    <img
      src={error ? fallback : src}
      alt={alt}
      onError={() => setError(true)}
      {...props}
    />
  )
}
