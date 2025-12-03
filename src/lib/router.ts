import { useCallback, useEffect, useState } from 'react'

export type RouteName = 'lobby' | 'settings' | 'game'

const HASH_MAP: Record<RouteName, string> = {
  lobby: '#/lobby',
  settings: '#/settings',
  game: '#/game',
}

function readRouteFromHash(fallback: RouteName): RouteName {
  if (typeof window === 'undefined') {
    return fallback
  }
  const hash = window.location.hash || ''
  const entry = (Object.entries(HASH_MAP) as Array<[RouteName, string]>).find(([, value]) => value === hash)
  return entry ? entry[0] : fallback
}

export function useRouter(initialRoute: RouteName = 'lobby') {
  const [route, setRoute] = useState<RouteName>(() => readRouteFromHash(initialRoute))

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const handler = () => setRoute(readRouteFromHash(initialRoute))
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [initialRoute])

  const navigate = useCallback((next: RouteName) => {
    if (typeof window === 'undefined') {
      setRoute(next)
      return
    }
    if (HASH_MAP[next] === window.location.hash) {
      setRoute(next)
      return
    }
    window.location.hash = HASH_MAP[next]
    setRoute(next)
  }, [])

  return { route, navigate }
}
