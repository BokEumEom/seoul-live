import { t } from '../../i18n/t'
import { congestionSentence, congestionTone } from '../../domain/congestion'
import {
  formatDistance,
  haversineMeters,
  walkableMinutes,
} from '../../domain/distance'
import { CATEGORY_LABEL } from '../../domain/types'
import type {
  AreaCatalogEntry,
  AreaSnapshot,
  CongestionLevel,
  Coords,
} from '../../domain/types'
import { Icon } from '../common/Icon'
import { TONE_DOT_CLASS, TONE_TEXT_CLASS } from '../common/toneClass'

interface Props {
  readonly entry: AreaCatalogEntry
  /** 위치를 아직 못 잡았거나 사용자가 거부하면 null. */
  readonly coords: Coords | null
  /** 혼잡도 응답 전에는 undefined. 자리를 미리 잡지 않는다 — 아래 주석. */
  readonly snapshot: AreaSnapshot | undefined
  /**
   * 목록이 이미 받아 둔 등급(`seededCongestion`). `snapshot`이 오기 전 **큰
   * 글씨 한 줄만** 먼저 그리는 데 쓴다. 둘 다 없으면 블록 자체가 없다.
   */
  readonly seededCongestion: CongestionLevel | undefined
}

/**
 * 상세 맨 위의 네 줄. 시안(stitch_ui_ux/_2)의 히어로 그대로다.
 *
 * ```
 * 고궁·문화유산 · 1.0km · 도보 15분
 * ● 지금은 약간 붐벼요
 *   74,000~76,000명
 *   조금 붐벼요.
 * 🕐 11:00 기준
 * ```
 *
 * **배지가 없다.** 예전 히어로는 제목 줄 오른쪽에 「약간 붐빔」 배지를 달았고,
 * 그래서 큰 글씨로 등급을 한 번 더 말하는 것이 중복이었다. 전체 화면에서는
 * 이름이 상단 바로 올라가 제목 줄 자체가 없어졌으므로, 등급을 말하는 자리가
 * 이 문장 하나다 — 되풀이가 아니라 처음 말하는 것이 됐다.
 *
 * **인원수가 여전히 가장 큰 값이 아닌 이유.** 같은 「약간 붐빔」이 광화문에서는
 * 40,000명이고 서촌에서는 4,000명이라 숫자가 등급이 뭉갠 것을 되살린다 — 그
 * 판단은 그대로다. 다만 문장이 한 단 위인 것은 **모르는 사람이 먼저 읽어야 할
 * 것**이 「그래서 지금 갈 만한가」이기 때문이다. 숫자는 그 답의 근거다.
 *
 * **문장이 여전히 인원수보다 한 단 위다**(2026-08-27에도 20px > 16px로 유지돼
 * 위 근거는 살아 있다). 다만 **화면에서 가장 큰 글씨는 이제 이 문장이
 * 아니다** — 「장소 타이틀이 상대적으로 작다」는 사용자 지적으로
 * `DetailAppBar`의 `h2`를 24px로 올리고 이 히어로 세 줄을 그 아래 한 단씩
 * 내렸다(문장 24→20px, 인원수 20→16px, 안내 문구 16→14px). 「그래서 지금
 * 갈 만한가」를 이름보다 먼저 읽어야 한다는 판단이 바뀐 것이 아니라, 그 순서를
 * 재는 눈금 전체가 이름 아래 칸으로 옮겨간 것이다.
 */
export function DetailHero({ entry, coords, snapshot, seededCongestion }: Props) {
  const distanceMeters = coords === null ? null : haversineMeters(coords, entry)
  const walkMinutes =
    distanceMeters === null ? null : walkableMinutes(distanceMeters)
  // **누가 먼저냐가 아니라 있는 쪽을 쓴다.** `snapshot`이 도착하면 그쪽이
  // 권위다 — 씨앗은 5분 갱신이고 snapshot은 관측 시각을 달고 온다.
  const congestion = snapshot?.congestion ?? seededCongestion
  const tone = congestion === undefined ? null : congestionTone(congestion)

  return (
    <section className="border-b border-outline-variant bg-surface-container-lowest px-4 py-5">
      {/* `!== null`이지 truthy 검사가 아니다. 명소 위에 서 있으면 거리가 0이라
          `distanceMeters &&`로 쓰면 이 줄이 카테고리만 남는다. */}
      <p className="text-label-sm text-on-surface-variant">
        {t(CATEGORY_LABEL[entry.category])}
        {distanceMeters !== null && ` · ${formatDistance(distanceMeters)}`}
        {walkMinutes !== null && ` `}
        {walkMinutes !== null && t('· 도보 {분}분', { 분: walkMinutes })}
      </p>

      {/* **등급 하나만 알아도 이 블록을 그린다(2026-08-28).** 목록이 이미
          121곳 등급을 받아 뒀으므로(`seededCongestion`), 상세를 열자마자 큰
          글씨 한 줄은 왕복 없이 뜬다. 나머지 세 줄은 `snapshot`이 와야 채워진다.

          **스켈레톤은 여전히 두지 않는다.** 자리를 미리 잡아 두면 값이 도착할
          때 아래 탭 줄이 밀리는데 탭은 sticky라 크게 띈다 — 그 판단은 그대로다.
          씨앗은 자리만 잡는 것이 아니라 **진짜 값**을 그리므로 다르다.

          **씨앗도 없으면 예전과 같다** — 블록이 통째로 없다. 카테고리 줄은
          카탈로그만으로 서므로 화면이 빈 채로 시작하지는 않는다. */}
      {congestion !== undefined && tone !== null && (
        <>
          <h3 className="mt-2 flex items-center gap-2 text-headline-md text-on-surface">
            {/* 「지금 값이다」를 뜻하는 점. **색이 정보를 혼자 나르지 않는다** —
                바로 옆 문장이 같은 말을 적는다(WCAG 1.4.1). `animate-pulse`는
                `prefers-reduced-motion`에서 멈춘다(index.css). */}
            <span
              aria-hidden
              className={`size-3 shrink-0 animate-pulse rounded-full ${TONE_DOT_CLASS[tone]}`}
            />
            {t(congestionSentence(congestion))}
          </h3>

          {/* **아래 셋은 `snapshot`이 와야 있다.** 씨앗은 등급만 안다 —
              인원수·안내 문구·관측 시각을 0이나 빈 문자열로 채우면 「0명」이
              잠깐 뜬다(`seededCongestion`의 주석과 같은 규칙). */}
          {snapshot !== undefined && (
            <p className={`mt-1 text-headline-sm ${TONE_TEXT_CLASS[tone]}`}>
              {t('{최소}~{최대}명', {
                최소: snapshot.populationMin.toLocaleString(),
                최대: snapshot.populationMax.toLocaleString(),
              })}
            </p>
          )}

          {/* 서울 API가 주는 안내 문구(`PPLTN_MSG`)다. 우리가 짓지 않는다 —
              같은 등급이라도 「도로가 매우 혼잡합니다」와 「사람이 많습니다」는
              다른 조언이고, 그 차이는 상류만 안다. 빈 문자열로 오는 응답이
              있어 길이를 본다. */}
          {snapshot !== undefined && snapshot.message !== '' && (
            <p className="mt-2 text-label-md text-on-surface-variant">
              {snapshot.message}
            </p>
          )}

          {/* **기준 시각이 없으면 「지금」이라고 주장하는 것과 같다.** 이 앱의
              혼잡도는 5분 간격 관측이고 프록시 캐시까지 얹히므로, 숫자만 크게
              적고 시각을 빼면 앱이 거짓말을 한다. */}
          {snapshot !== undefined && (
            <p className="mt-4 flex items-center gap-1 text-label-sm text-outline">
              <Icon name="clock" className="size-4" />
              {t('{시각} 기준', { 시각: snapshot.observedAtLabel })}
            </p>
          )}
        </>
      )}
    </section>
  )
}
