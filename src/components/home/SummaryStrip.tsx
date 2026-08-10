import type { CitySummary } from '../../domain/summary'

interface Props {
  readonly summary: CitySummary
  readonly alertCount: number
  readonly onOpen: () => void
}

// 「더보기」 탭을 대신한다. 탭은 눌러야 보이지만 이 줄은 시트를 열 때마다
// 눈에 들어온다 — 안 눌리는 탭보다 발견된다.
//
// 한 줄을 넘지 않는다. 큰 카드를 목록 위에 올리면 half 단계에서 명소가
// 한 곳도 안 보인다.
//
// 세는 값은 total이 아니라 counted다. 30곳 중 22곳만 응답한 날에 "30곳 중"이라
// 쓰면 전체를 봤다는 오해를 준다. counted와 total이 갈리는 사실 자체는 줄이
// 하나뿐이라 여기서 말하지 못하고 「오늘의 서울」의 SummaryCard가 말한다.
export function SummaryStrip({ summary, alertCount, onOpen }: Props) {
  const hasAlert = alertCount > 0

  // counted === 0으로만 갈린다. 붐빔이 0곳인 건 정보가 없는 게 아니라 좋은
  // 소식이라 "30곳 중 붐빔 0곳"으로 그대로 센다.
  const label =
    summary.counted === 0
      ? '혼잡도 정보를 아직 받지 못했어요.'
      : `${summary.counted}곳 중 붐빔 ${summary.byLevel.붐빔}곳`

  return (
    <button
      type="button"
      onClick={onOpen}
      data-alert={hasAlert}
      // font-medium을 쓰지 않는다 — --text-label-md--font-weight가 이미 500이라
      // 같은 값을 두 번 쓰는 것이고, 나중에 토큰을 고쳐도 여기만 안 따라온다.
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-label-md ${
        hasAlert
          ? 'bg-error-container text-on-error-container'
          : 'bg-secondary-container text-primary'
      }`}
    >
      <span className="truncate">
        {hasAlert ? `재난문자 ${alertCount}건 · ${label}` : label}
      </span>
      {/* 보이는 문구는 상태 읽어주기라 눌러서 무엇이 열리는지 말해주지 않는다.
          aria-label로 덮으면 보이는 글자와 이름이 어긋나므로(음성 제어가 보이는
          문구로 못 부른다) 목적지만 이름 뒤에 덧댄다. */}
      <span className="sr-only">오늘의 서울 열기</span>
      <span aria-hidden className="shrink-0">
        ›
      </span>
    </button>
  )
}
