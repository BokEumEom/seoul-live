import { t } from '../../i18n/t'
import { useCctv } from '../../data/queries'
import { isPlayable } from '../../domain/cctv'
import { cityInfoSectionDomId } from '../../domain/cityInfoSummary'
import type { Coords } from '../../domain/types'
import { CctvList } from './CctvList'
import { EmptyNote, InfoSection } from './InfoSection'

// 명소 주변 교통 CCTV.
//
// **추가 쿼터가 0이다.** 서울 OpenAPI가 아니라서 하루 1,000회와 무관하다 —
// 근거는 `api/_lib/seoulRtd.ts`.
//
// 영상은 여기서 안 튼다. 목록만 그리고 펼친 줄에만 붙인다 — 근거는
// `CctvList`의 주석(자동 재생이 느렸던 이유).

interface Props {
  readonly areaName: string
  readonly origin: Coords | null
  /** 지금 펼쳐 둔 카메라. 지도 마커와 나눠 갖는 상태라 위에서 내려온다. */
  readonly openStreamUrl: string | null
  readonly onToggle: (streamUrl: string) => void
}

export function CctvSection({ areaName, origin, openStreamUrl, onToggle }: Props) {
  const query = useCctv(areaName)
  const cameras = query.data ?? []
  const hasPlayable = cameras.some(isPlayable)

  // **조회 중에는 절 자체를 그리지 않는다.** 30곳 중 10곳은 CCTV가 없는데
  // (2026-08-19 실측), 스켈레톤을 띄우면 그 10곳에서 없는 절이 잠깐
  // 나타났다 사라져 화면이 덜컹인다.
  if (query.isPending) {
    return null
  }

  return (
    <InfoSection
      title={t('주변 CCTV')}
      id={cityInfoSectionDomId('cctv')}
      icon="cctv"
      count={cameras.length}
      // 기준 시각을 안 적는다. **이 절만 진짜 실시간이다** — 캐시되는 것은
      // 카메라 목록이지 영상이 아니다.
      note={hasPlayable ? t('누르면 지금 화면이 나와요') : undefined}
    >
      {cameras.length === 0 ? (
        <EmptyNote>{t('이 명소 주변에는 공개된 CCTV가 없어요.')}</EmptyNote>
      ) : (
        <CctvList
          cameras={cameras}
          origin={origin}
          openStreamUrl={openStreamUrl}
          onToggle={onToggle}
        />
      )}
    </InfoSection>
  )
}
