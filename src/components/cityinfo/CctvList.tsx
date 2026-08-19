import { t } from '../../i18n/t'
import { isPlayable, sortCctvByDistance, type CctvCamera } from '../../domain/cctv'
import { formatDistance } from '../../domain/distance'
import type { Coords } from '../../domain/types'
import { Icon } from '../common/Icon'
import { CctvPlayer } from './CctvPlayer'

// 「주변 CCTV」 목록. **샘플(서울 인파레이더)의 접이식 목록 그대로다.**
//
// 처음에는 첫 카메라를 자동으로 틀었는데 **느렸다.** 상세를 열자마자
// (1) 목록을 받고 (2) hls.js 500KB를 내려받고 (3) HLS 마스터 → chunklist →
// 2.5MB 세그먼트까지 받아야 첫 프레임이 나온다. 샘플이 빠른 이유는 기술이
// 아니라 **아무것도 안 틀기 때문이다** — 목록만 그리고, 누른 줄 하나만 튼다.
//
// 그래서 여기서는 영상이 **펼친 줄에만** 붙는다. 절이 뜨는 비용은 목록 조회
// 하나뿐이고, 그건 CDN 캐시를 탄다.
//
// **한 번에 하나만 펼친다.** 명동은 카메라가 7대라 여럿을 열면 스트림이
// 동시에 흐른다 — 모바일 데이터·배터리를 그만큼 먹고 서울시 프록시에도
// 그만큼 매달린다.

interface Props {
  readonly cameras: readonly CctvCamera[]
  /** 거리를 재는 기준점. 명소 중심이다 — 근거는 `facilityDistance.ts`. */
  readonly origin: Coords | null
  /** 지금 펼쳐 둔 카메라의 스트림 주소. 지도 마커와 공유하는 상태다. */
  readonly openStreamUrl: string | null
  readonly onToggle: (streamUrl: string) => void
}

export function CctvList({ cameras, origin, openStreamUrl, onToggle }: Props) {
  // **순수 거리순이다(따릉이와 다르다).** 볼 수 있는 것을 앞으로 당기지
  // 않는 근거는 `domain/cctv.ts`의 `sortCctvByDistance` 주석에 있다.
  const ordered = sortCctvByDistance(cameras, origin)

  return (
    <ul className="flex flex-col">
      {ordered.map((camera, index) => {
        const playable = isPlayable(camera)
        const open = playable && camera.streamUrl === openStreamUrl
        // 이름이 겹칠 수 있다 — 실응답에 「서울광장」이 두 번 온다(하나는
        // 영상 없음). 스트림이 없으면 스트림도 키가 못 되므로 자리를 섞는다.
        const key = playable ? camera.streamUrl : `${camera.name}-${index}`

        return (
          <li key={key} className="border-b border-outline-variant last:border-b-0">
            <button
              type="button"
              // 못 트는 줄은 버튼이 아니다 — 눌러도 아무 일이 없는 버튼은
              // 고장으로 보인다(`ShowOnMapButton`과 같은 규칙).
              disabled={!playable}
              aria-expanded={playable ? open : undefined}
              onClick={() => onToggle(camera.streamUrl)}
              className="flex min-h-12 w-full items-center gap-2 py-2.5 text-left disabled:cursor-default"
            >
              <Icon
                name={open ? 'chevronDown' : 'chevronRight'}
                className={`size-4 shrink-0 ${playable ? 'text-primary' : 'text-outline'}`}
              />
              <span
                className={`min-w-0 flex-1 truncate text-body-md ${
                  playable ? 'text-on-surface' : 'text-on-surface-variant'
                }`}
              >
                {camera.name}
              </span>
              {/* 못 트는 이유를 적는다. 샘플도 「영상 없음」을 그대로 쓴다 —
                  줄만 흐리게 두면 왜 안 되는지 알 길이 없다. */}
              {!playable && (
                <span className="shrink-0 text-label-sm text-outline">{t('영상 없음')}</span>
              )}
              {camera.meters !== null && (
                <span className="shrink-0 text-label-sm text-on-surface-variant">
                  {formatDistance(camera.meters)}
                </span>
              )}
            </button>

            {open && (
              <div className="pb-3">
                {/* `key`가 스트림 주소다 — 다른 카메라로 갈아탈 때
                    플레이어를 새로 만들어야 hls.js 인스턴스가 섞이지 않는다. */}
                <CctvPlayer key={camera.streamUrl} name={camera.name} streamUrl={camera.streamUrl} />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
