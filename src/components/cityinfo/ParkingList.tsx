import {
  parkingTone,
  sortParkingByAvailable,
  type ParkingLot,
} from '../../domain/cityInfo'
import { ToneBadge } from '../common/ToneBadge'

/** 한 명소에 주차장이 수십 곳 딸려 오는 경우가 있다. 여유 많은 순으로 몇 곳만 보여준다. */
const VISIBLE_LIMIT = 5

// "정보 없음"과 "만차"를 같은 문구로 묶으면, 실시간 정보를 주지 않는 주차장이
// 전부 만차로 보인다 — 그 앞을 지나가는 사용자에게는 정반대의 안내다.
function availabilityLabel(lot: ParkingLot): string {
  if (lot.available === null) {
    return lot.liveAvailable ? '정보 없음' : '실시간 미제공'
  }
  return lot.available === 0 ? '만차' : `${lot.available.toLocaleString()}면`
}

function describe(lot: ParkingLot): string {
  const parts: string[] = []
  if (lot.capacity !== null) {
    parts.push(`총 ${lot.capacity.toLocaleString()}면`)
  }
  if (lot.paid !== null) {
    parts.push(lot.paid ? '유료' : '무료')
  }
  return parts.join(' · ')
}

interface Props {
  readonly lots: readonly ParkingLot[]
}

export function ParkingList({ lots }: Props) {
  const visible = sortParkingByAvailable(lots, VISIBLE_LIMIT)

  return (
    <>
      <ul className="flex flex-col gap-3">
        {visible.map((lot) => (
          <li key={lot.name} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-body-md text-on-surface">{lot.name}</p>
              {describe(lot) !== '' && (
                <p className="mt-0.5 text-label-sm text-on-surface-variant">{describe(lot)}</p>
              )}
            </div>
            <ToneBadge
              tone={parkingTone(lot.available, lot.capacity)}
              label={availabilityLabel(lot)}
            />
          </li>
        ))}
      </ul>
      {lots.length > visible.length && (
        <p className="mt-3 text-label-sm text-outline">
          외 {lots.length - visible.length}곳
        </p>
      )}
    </>
  )
}
