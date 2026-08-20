import { t } from '../../i18n/t'
import type { DetailTabId } from '../../domain/detailTabs'
import { Icon, type IconName } from '../common/Icon'

interface Props {
  readonly icon: IconName
  /** 카드 머리의 이름표. 「혼잡도」·「날씨」처럼 무엇을 재는지. */
  readonly label: string
  /** 큰 값. 「약간 붐빔」·「27°」·「5곳」. 없으면 `—`가 아니라 카드를 안 그린다. */
  readonly value: string
  /** 값 아래 한 줄. 「주변 주차장」처럼 값의 단위나 조건. */
  readonly caption?: string
  /** 값 글자에 붙일 톤 클래스. 안 주면 본문 색이다. */
  readonly valueClassName?: string
  /** 값 오른쪽의 작은 점. 혼잡도 카드만 쓴다. */
  readonly dotClassName?: string
  readonly tab: DetailTabId
  /** 이 카드가 여는 탭의 이름. 접근성 이름 뒤에 붙는다. */
  readonly tabLabel: string
  readonly onOpen: (tab: DetailTabId) => void
}

/**
 * 요약 탭의 2열 그리드 한 칸. **값을 보여주고, 누르면 그 탭으로 간다.**
 *
 * 이 카드가 접이식 절을 대신한다. 접힌 절은 「무엇이 있는지」조차 감추지만
 * 카드는 값까지 보여준 뒤 **자세히 볼 사람만** 넘긴다 — 상세가 5,395px에서
 * 짧아지면서 잃을 뻔한 것을 여기서 지킨다.
 *
 * 버튼인 것이 중요하다. 예전의 요약 칩 줄(`CityInfoChips`)은 같은 화면 안의
 * 절로 스크롤했지만, 탭이 생긴 뒤로는 그 절이 다른 패널에 있어 스크롤로는
 * 닿지 않는다.
 */
export function SummaryCard({
  icon,
  label,
  value,
  caption,
  valueClassName = 'text-on-surface',
  dotClassName,
  tab,
  tabLabel,
  onOpen,
}: Props) {
  return (
    <button
      type="button"
      onClick={() => {
        onOpen(tab)
      }}
      // `text-left`가 필요하다. 버튼의 기본 정렬이 가운데라 카드 안 세 줄이
      // 저마다 다른 x에서 시작한다.
      //
      // 그림자와 1px 테두리를 함께 둔다 — 시안의 규칙이고, 이유는 밝은 배경
      // 위에서 흰 카드의 가장자리가 그림자만으로는 안 서기 때문이다.
      className="flex min-h-[88px] flex-col rounded-card border border-outline-variant bg-surface-container-lowest p-3 text-left shadow-[0_4px_12px_rgb(0_0_0/0.05)]"
    >
      <span className="flex items-center gap-1 text-label-xs text-on-surface-variant">
        <Icon name={icon} className="size-4" />
        {label}
      </span>

      {/* `mt-auto`가 값을 아래로 민다. 캡션이 있는 카드와 없는 카드가 나란히
          설 때 값의 밑선이 맞아야 두 열이 한 표로 읽힌다. */}
      <span className="mt-auto flex items-center justify-between gap-1 pt-2">
        <span className={`text-headline-sm ${valueClassName}`}>{value}</span>
        {dotClassName !== undefined && (
          <span aria-hidden className={`size-2 shrink-0 rounded-full ${dotClassName}`} />
        )}
      </span>

      {caption !== undefined && (
        <span className="text-body-sm text-outline">{caption}</span>
      )}

      {/* 보이는 글자는 값을 읽어 주고 이 줄이 목적지를 말한다. `aria-label`로
          덮으면 보이는 문구와 이름이 어긋나 음성 제어가 카드를 못 부른다 —
          `SummaryStrip`이 쓰는 것과 같은 규칙이다. */}
      <span className="sr-only">{t(', {분류} 자세히 보기', { 분류: tabLabel })}</span>
    </button>
  )
}
