import { Icon, type IconName } from '../common/Icon'

interface Props {
  readonly icon: IconName
  /** 이미 `t()`를 지난 글자다. 도메인 값과 우리 문장이 섞여 들어온다 */
  readonly children: React.ReactNode
}

/**
 * 아이콘 하나 + 값 한 조각. 시안 `stitch_ui_ux/_5`의 주차장 카드가 쓰는 모양이다.
 *
 * **점으로 이어 붙이던 것을 칸으로 나눴다.** 예전에는 「830m · 총 28면 · 유료 ·
 * 30분 3,000원 · 이후 10분당 1,000원」을 한 문장으로 이어 적었는데, 390px에서
 * 두 줄로 접히면서 **어디까지가 요금이고 어디부터가 거리인지**가 안 보였다.
 * 종류가 다른 값 다섯을 같은 구분점으로 잇는 한 그 문제는 안 없어진다.
 *
 * 아이콘은 장식이다(`Icon`이 `aria-hidden`을 단다) — 값 옆에 글자로 이름표를
 * 붙이지 않는 대신, 화면에서 종류를 가르는 일을 색이 아니라 **모양**이 한다.
 * 소리 채널에서는 값만 읽히고, 그 값들은 각자 단위를 달고 있다(「830m」·
 * 「총 28면」).
 */
export function FacilityFact({ icon, children }: Props) {
  return (
    <p className="flex min-w-0 items-start gap-1.5 text-label-md text-on-surface-variant">
      <Icon name={icon} className="mt-0.5 size-4 text-outline" />
      <span className="min-w-0">{children}</span>
    </p>
  )
}
