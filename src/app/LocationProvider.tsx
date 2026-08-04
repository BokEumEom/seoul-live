import type { ReactNode } from 'react'
import { useCurrentLocation } from '../hooks/useCurrentLocation'
import { LocationContext } from './locationContext'

// 위치를 화면이 아니라 앱 수준에서 한 번만 잡는다.
//
// 훅을 화면 안에 두면 화면이 언마운트될 때 상태가 사라져서, 상세에서 뒤로 갈
// 때마다 GPS를 새로 켠다. 배터리도 문제지만 권한을 아직 안 정한 사용자에게는
// 팝업이 반복해서 뜬다.
export function LocationProvider({ children }: { children: ReactNode }) {
  const location = useCurrentLocation()

  return <LocationContext value={location}>{children}</LocationContext>
}
