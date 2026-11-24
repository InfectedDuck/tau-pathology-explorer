import { useEffect, useState } from 'react'

/** Room for the three boxes side by side? Otherwise one box at a time with tabs. */
export function isWideLayout(): boolean {
  if (typeof window === 'undefined') return true
  return window.innerWidth >= 1080 && window.innerHeight >= 540
}

export function useWideLayout(): boolean {
  const [wide, setWide] = useState<boolean>(() => isWideLayout())
  useEffect(() => {
    const onChange = () => setWide(isWideLayout())
    window.addEventListener('resize', onChange)
    window.addEventListener('orientationchange', onChange)
    return () => {
      window.removeEventListener('resize', onChange)
      window.removeEventListener('orientationchange', onChange)
    }
  }, [])
  return wide
}
