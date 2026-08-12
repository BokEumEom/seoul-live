import type { CongestionTone } from '../../domain/congestion'

// Tailwind v4는 클래스명을 정적으로 추출한다. `bg-${tone}-container` 같은 동적 조합은
// 빌드에서 사라지므로 전체 클래스명을 리터럴로 적어야 한다.
//
// 혼잡도 배지(CongestionBadge)와 도시정보의 대기·주차 배지(ToneBadge)가 이 표를
// 공유한다. 표를 두 벌 두면 같은 화면에 미묘하게 다른 초록이 두 종류 생긴다.
// 컴포넌트 파일이 아니라 여기 두는 이유는 react-refresh 규칙이다 — 컴포넌트를
// export하는 파일이 상수까지 함께 export하면 빠른 새로고침이 깨진다.
// 글자색이 `text-calm`이 아니라 `text-on-calm-container`인 이유는 index.css의
// 그 토큰 주석에 한 벌 있다 — 요약하면 선명한 `--color-calm`을 옅은
// `-container` 위에 얹으면 12px 글자가 4.5:1에 못 미친다. 지도 핀·마커 알약은
// 여전히 선명한 쪽을 쓴다.
export const TONE_CLASS: Readonly<Record<CongestionTone, string>> = {
  calm: 'bg-calm-container text-on-calm-container',
  normal: 'bg-normal-container text-on-normal-container',
  busy: 'bg-busy-container text-on-busy-container',
  crowded: 'bg-crowded-container text-on-crowded-container',
}

/** 값을 모를 때. 어느 톤도 아니라는 뜻이라 색을 쓰지 않는다. */
export const NEUTRAL_TONE_CLASS = 'bg-surface-container text-on-surface-variant'

/**
 * 히트맵 칸처럼 **글자 없이 색만으로** 값을 말하는 자리.
 *
 * `TONE_CLASS`의 `-container`만 쓰면 네 값이 전부 옅어 강도 차가 안 보인다
 * (계산해 보면 명도가 거의 같다). 그래서 위 둘은 옅은 배경, 아래 둘은 진한
 * 색으로 올려 눈에 램프가 생기게 했다. 색 체계는 여전히 하나다 — 같은
 * 토큰(`calm`·`normal`·`busy`·`crowded`)에서 밝기만 다르게 고른다.
 *
 * **색만으로 값을 전하지 마라.** 이 표를 쓰는 자리는 같은 값을 소리로도
 * 내보내야 한다(`WeeklyPatternCard`의 `sr-only` 참고).
 */
export const TONE_FILL_CLASS: Readonly<Record<CongestionTone, string>> = {
  calm: 'bg-calm-container',
  normal: 'bg-normal-container',
  busy: 'bg-busy',
  crowded: 'bg-crowded',
}

/** 관측이 없는 칸. 어느 톤도 아니다 — 「여유」와 반드시 달라야 한다. */
export const EMPTY_CELL_CLASS = 'bg-surface-container-high'
