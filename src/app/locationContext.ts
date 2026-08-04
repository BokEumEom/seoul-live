import { createContext, use } from 'react'
import type { CurrentLocation } from '../hooks/useCurrentLocation'

// 컨텍스트와 훅을 컴포넌트 파일에서 분리한다. 한 파일이 컴포넌트와 그 밖의 것을
// 같이 내보내면 Fast Refresh가 동작하지 않는다(eslint react-refresh 규칙).
export const LocationContext = createContext<CurrentLocation | null>(null)

export function useLocation(): CurrentLocation {
  const location = use(LocationContext)
  if (location === null) {
    throw new Error('useLocation은 LocationProvider 안에서만 쓸 수 있습니다.')
  }
  return location
}
