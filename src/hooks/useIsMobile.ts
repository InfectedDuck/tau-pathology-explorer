import { useEffect, useState } from 'react'

/** True for coarse-pointer (touch) devices or narrow viewports. Single source for all mobile adaptations. */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (window.matchMedia?.('(pointer: coarse)').matches) return true
    if (Math.min(window.innerWidth, window.innerHeight) < 500) return true
    if (window.innerWidth < 768 && 'ontouchstart' in window) return true
  } catch { /* ignore */ }
  return false
}

/** Reactive hook version — updates on resize/orientation change. */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState<boolean>(() => isMobileDevice())
  useEffect(() => {
    const onChange = () => setMobile(isMobileDevice())
    window.addEventListener('resize', onChange)
    window.addEventListener('orientationchange', onChange)
    return () => {
      window.removeEventListener('resize', onChange)
      window.removeEventListener('orientationchange', onChange)
    }
  }, [])
  return mobile
}
