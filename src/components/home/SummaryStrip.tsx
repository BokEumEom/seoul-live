import { t } from '../../i18n/t'
import type { CitySummary } from '../../domain/summary'

interface Props {
  readonly summary: CitySummary
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
// **재난문자는 더 이상 이 줄이 지지 않는다.** 예전에는 여기에 「재난문자 2건」을
// 앞세우고 줄 색을 빨강으로 바꿨는데, 건수로는 우산을 챙길 일인지 대피할 일인지
// 알 수 없었다. 지금은 바로 위 `AlertBanner`가 **본문을 그대로** 보여준다 —
// 같은 것을 두 줄이 말하면 이 줄의 한 칸이 중복에 낭비되고, 배너가 이미 빨강인데
// 바로 아래 줄까지 빨가면 무엇이 경보인지 흐려진다.
export function SummaryStrip({ summary, onOpen }: Props) {
  // counted === 0으로만 갈린다. 붐빔이 0곳인 건 정보가 없는 게 아니라 좋은
  // 소식이라 "30곳 중 붐빔 0곳"으로 그대로 센다.
  const label =
    summary.counted === 0
      ? t('혼잡도 정보를 아직 받지 못했어요.')
      : t('{개수}곳 중 붐빔 {붐빔}곳', {
          개수: summary.counted,
          붐빔: summary.byLevel.붐빔,
        })

  return (
    <button
      type="button"
      onClick={onOpen}
      // 높이가 36px이라 이 저장소의 48px 탭 규약(SearchBar·AreaListItem의
      // min-h-12, BottomSheet 손잡이의 히트 44px)을 혼자 벗어난다. 면제인 이유:
      // 설계 문서가 이 줄을 "약 40px"로 예산 잡았고, 48px로 올리면 half에서
      // 목록이 0.2행 줄어든다. 폭이 시트 전체라 명중률 손실도 작다.
      // WCAG 2.5.8(24px)은 통과한다.
      //
      // font-medium을 쓰지 않는다 — --text-label-md--font-weight가 이미 500이라
      // 같은 값을 두 번 쓰는 것이고, 나중에 토큰을 고쳐도 여기만 안 따라온다.
      className="flex w-full items-center justify-between gap-2 rounded-card bg-secondary-container px-3 py-2 text-label-md text-primary"
    >
      <span className="truncate">{label}</span>
      {/* 보이는 문구는 상태 읽어주기라 눌러서 무엇이 열리는지 말해주지 않는다.
          aria-label로 덮으면 보이는 글자와 이름이 어긋나므로(음성 제어가 보이는
          문구로 못 부른다) 목적지만 이름 뒤에 덧댄다. */}
      <span className="sr-only">{t(', 오늘의 서울 열기')}</span>
      <span aria-hidden className="shrink-0">
        ›
      </span>
    </button>
  )
}
