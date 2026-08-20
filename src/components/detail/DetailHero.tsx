import { t } from '../../i18n/t'
import { congestionSentence, congestionTone } from '../../domain/congestion'
import {
  formatDistance,
  haversineMeters,
  walkableMinutes,
} from '../../domain/distance'
import { CATEGORY_LABEL } from '../../domain/types'
import type { AreaCatalogEntry, AreaSnapshot, Coords } from '../../domain/types'
import { Icon } from '../common/Icon'
import { TONE_DOT_CLASS, TONE_TEXT_CLASS } from '../common/toneClass'

interface Props {
  readonly entry: AreaCatalogEntry
  /** 위치를 아직 못 잡았거나 사용자가 거부하면 null. */
  readonly coords: Coords | null
  /** 혼잡도 응답 전에는 undefined. 자리를 미리 잡지 않는다 — 아래 주석. */
  readonly snapshot: AreaSnapshot | undefined
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
 */
export function DetailHero({ entry, coords, snapshot }: Props) {
  const distanceMeters = coords === null ? null : haversineMeters(coords, entry)
  const walkMinutes =
    distanceMeters === null ? null : walkableMinutes(distanceMeters)
  const tone = snapshot === undefined ? null : congestionTone(snapshot.congestion)

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

      {/* **혼잡도가 오기 전에는 이 블록이 통째로 없다.** 스켈레톤을 두지 않는
          이유는 히어로가 자리를 잡아 두면 도착할 때 아래 탭 줄이 밀려서다 —
          탭은 sticky라 그 밀림이 눈에 크게 띈다. 카테고리 줄은 카탈로그만으로
          서므로 화면이 빈 채로 시작하지는 않는다. */}
      {snapshot !== undefined && tone !== null && (
        <>
          <h3 className="mt-2 flex items-center gap-2 text-display-lg text-on-surface">
            {/* 「지금 값이다」를 뜻하는 점. **색이 정보를 혼자 나르지 않는다** —
                바로 옆 문장이 같은 말을 적는다(WCAG 1.4.1). `animate-pulse`는
                `prefers-reduced-motion`에서 멈춘다(index.css). */}
            <span
              aria-hidden
              className={`size-3 shrink-0 animate-pulse rounded-full ${TONE_DOT_CLASS[tone]}`}
            />
            {t(congestionSentence(snapshot.congestion))}
          </h3>

          <p className={`mt-1 text-headline-md ${TONE_TEXT_CLASS[tone]}`}>
            {t('{최소}~{최대}명', {
              최소: snapshot.populationMin.toLocaleString(),
              최대: snapshot.populationMax.toLocaleString(),
            })}
          </p>

          {/* 서울 API가 주는 안내 문구(`PPLTN_MSG`)다. 우리가 짓지 않는다 —
              같은 등급이라도 「도로가 매우 혼잡합니다」와 「사람이 많습니다」는
              다른 조언이고, 그 차이는 상류만 안다. 빈 문자열로 오는 응답이
              있어 길이를 본다. */}
          {snapshot.message !== '' && (
            <p className="mt-2 text-body-md text-on-surface-variant">
              {snapshot.message}
            </p>
          )}

          {/* **기준 시각이 없으면 「지금」이라고 주장하는 것과 같다.** 이 앱의
              혼잡도는 5분 간격 관측이고 프록시 캐시까지 얹히므로, 숫자만 크게
              적고 시각을 빼면 앱이 거짓말을 한다. */}
          <p className="mt-4 flex items-center gap-1 text-label-sm text-outline">
            <Icon name="clock" className="size-4" />
            {t('{시각} 기준', { 시각: snapshot.observedAtLabel })}
          </p>
        </>
      )}
    </section>
  )
}
