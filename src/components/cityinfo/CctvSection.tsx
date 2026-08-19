import { useState } from 'react'
import { t } from '../../i18n/t'
import { useCctv } from '../../data/queries'
import type { CctvCamera } from '../../domain/cctv'
import { cityInfoSectionDomId } from '../../domain/cityInfoSummary'
import type { FacilityLocation } from '../../domain/cityInfo'
import { CctvPlayer } from './CctvPlayer'
import { EmptyNote, InfoSection } from './InfoSection'
import { ShowOnMapButton } from './ShowOnMapButton'

// 명소 주변 교통 CCTV.
//
// **한 번에 한 대만 튼다.** 목록의 모든 카메라를 동시에 재생하면 명동(7대)에서
// HLS 스트림 일곱 개가 동시에 흐른다 — 모바일 데이터와 배터리를 그만큼 먹고,
// 서울시 프록시에도 우리가 일곱 배로 매달린다. 첫 대를 자동으로 틀어 두고
// (그래야 「영상이 있다」는 사실이 한눈에 보인다) 나머지는 눌러서 갈아탄다.
//
// **추가 쿼터가 0이다.** 서울 OpenAPI가 아니라서 하루 1,000회와 무관하다 —
// 근거는 `api/_lib/seoulRtd.ts`.

interface Props {
  readonly areaName: string
  readonly onShowOnMap: (place: FacilityLocation) => void
}

/** 좌표가 있는 것만 지도로 보낼 수 있다(`toFacilityLocation`과 같은 규칙). */
function toPlace(camera: CctvCamera): FacilityLocation | null {
  return camera.coords === null ? null : { name: camera.name, coords: camera.coords }
}

export function CctvSection({ areaName, onShowOnMap }: Props) {
  const query = useCctv(areaName)
  const cameras = query.data ?? []
  // 이름이 아니라 스트림으로 고른다 — 파서가 스트림으로 중복을 걸렀으므로
  // 그것이 목록 안에서 유일한 값이다.
  const [selected, setSelected] = useState<string | null>(null)
  const current = cameras.find((camera) => camera.streamUrl === selected) ?? cameras[0]

  // **조회 중에는 절 자체를 그리지 않는다.** 30곳 중 10곳은 CCTV가 없는데
  // (2026-08-19 실측), 스켈레톤을 띄우면 그 10곳에서 없는 절이 잠깐 나타났다
  // 사라진다 — 화면이 덜컹인다.
  if (query.isPending) {
    return null
  }

  return (
    <InfoSection
      title={t('실시간 영상')}
      id={cityInfoSectionDomId('cctv')}
      icon="cctv"
      count={cameras.length}
      // 혼잡도·주차장과 달리 기준 시각을 안 적는다. **이 절만 진짜 실시간이다** —
      // 캐시되는 것은 카메라 목록이지 영상이 아니다.
      note={cameras.length === 0 ? undefined : t('영상은 지금 화면이에요')}
    >
      {current === undefined ? (
        <EmptyNote>{t('이 명소 주변에는 공개된 CCTV가 없어요.')}</EmptyNote>
      ) : (
        <>
          <CctvPlayer key={current.streamUrl} name={current.name} streamUrl={current.streamUrl} />

          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-body-md text-on-surface">{current.name}</p>
            <ShowOnMapButton place={toPlace(current)} onShow={onShowOnMap} />
          </div>

          {/* 카메라가 하나뿐이면 고를 것이 없다. 버튼 한 개짜리 목록은
              무엇을 하라는 것인지 알려주지 못한다. */}
          {cameras.length > 1 && (
            <ul className="mt-1 flex flex-wrap gap-2">
              {cameras.map((camera) => {
                const active = camera.streamUrl === current.streamUrl
                return (
                  <li key={camera.streamUrl}>
                    <button
                      type="button"
                      // 「눌려 있음」을 색으로만 말하면 스크린리더에 안 전해진다.
                      aria-pressed={active}
                      onClick={() => setSelected(camera.streamUrl)}
                      className={
                        active
                          ? 'rounded-full bg-primary px-3 py-1.5 text-label-sm font-semibold text-on-primary'
                          : 'rounded-full bg-surface-container px-3 py-1.5 text-label-sm text-on-surface-variant'
                      }
                    >
                      {camera.name}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </InfoSection>
  )
}
