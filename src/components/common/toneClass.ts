import type { CongestionTone } from '../../domain/congestion'

// Tailwind v4는 클래스명을 정적으로 추출한다. `bg-${tone}-container` 같은 동적 조합은
// 빌드에서 사라지므로 전체 클래스명을 리터럴로 적어야 한다.
//
// 혼잡도 배지(CongestionBadge)와 도시정보의 대기·주차 배지(ToneBadge)가 이 표를
// 공유한다. 표를 두 벌 두면 같은 화면에 미묘하게 다른 초록이 두 종류 생긴다.
// 컴포넌트 파일이 아니라 여기 두는 이유는 react-refresh 규칙이다 — 컴포넌트를
// export하는 파일이 상수까지 함께 export하면 빠른 새로고침이 깨진다.
export const TONE_CLASS: Readonly<Record<CongestionTone, string>> = {
  calm: 'bg-calm-container text-calm',
  normal: 'bg-normal-container text-normal',
  busy: 'bg-busy-container text-busy',
  crowded: 'bg-crowded-container text-crowded',
}

/** 값을 모를 때. 어느 톤도 아니라는 뜻이라 색을 쓰지 않는다. */
export const NEUTRAL_TONE_CLASS = 'bg-surface-container text-on-surface-variant'
