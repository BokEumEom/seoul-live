import { useRef } from 'react'
import { t } from '../../i18n/t'
import {
  DETAIL_TABS,
  detailTabButtonId,
  detailTabPanelId,
  type DetailTabId,
} from '../../domain/detailTabs'

interface Props {
  readonly value: DetailTabId
  readonly onChange: (id: DetailTabId) => void
}

/**
 * 상세의 가로 탭 줄.
 *
 * **`role="tablist"`를 제대로 쓴다.** 겉모습만 탭이고 버튼 일곱 개인 화면은
 * 스크린리더에서 「버튼, 버튼, 버튼…」으로 읽혀 몇 개 중 몇째인지 알 수 없다.
 * 여기서는 `tab`/`tabpanel`/`aria-selected`/`aria-controls`가 다 붙는다.
 *
 * **화살표 키로 옮긴다(WAI-ARIA Authoring Practices).** 탭 줄의 규약은
 * 「Tab 키는 탭 줄을 통째로 지나가고, 좌우 화살표가 탭을 고른다」이다 —
 * 그래서 선택된 탭만 `tabIndex=0`이고 나머지는 `-1`이다. 이게 없으면
 * 키보드 사용자가 패널로 내려가기 전에 탭을 일곱 번 눌러야 한다.
 */
export function DetailTabs({ value, onChange }: Props) {
  const listRef = useRef<HTMLDivElement>(null)

  function moveFocus(delta: number): void {
    const at = DETAIL_TABS.findIndex((tab) => tab.id === value)
    // 양 끝에서 감는다. 목록이 순환이라는 것이 화살표 조작의 관용이고,
    // 일곱 개를 훑을 때 끝에서 막히면 반대로 되짚어야 한다.
    const next = DETAIL_TABS[(at + delta + DETAIL_TABS.length) % DETAIL_TABS.length]
    onChange(next.id)
    // 「선택을 옮기면 포커스도 따라간다」가 자동 활성화 탭의 규약이다. 포커스가
    // 옛 탭에 남으면 다음 화살표가 두 칸 건너뛴 것처럼 보인다.
    listRef.current
      ?.querySelector<HTMLElement>(`#${CSS.escape(detailTabButtonId(next.id))}`)
      ?.focus()
  }

  return (
    // **`sticky`다.** 탭을 옮기면 패널이 통째로 갈리는데, 스크롤을 한참 내린
    // 상태에서 탭 줄이 화면 밖이면 「어느 탭에 있는지」를 확인하러 맨 위까지
    // 되돌아가야 한다.
    //
    // **`top-12`는 `DetailAppBar`의 높이(`h-12`)다.** 상세가 시트로 돌아오면서
    // 상단 바와 이 줄이 스크롤 상자 하나를 나눠 쓰게 됐다 — `top-0`으로 두면
    // 이 줄이 상단 바 뒤에 숨는다. 그 바의 높이를 고치면 이 값이 따라와야 한다.
    //
    // `-mx-*`를 쓰지 않고 컨테이너가 폭 전체다 — 배경이 있어야 sticky로 떠
    // 있을 때 아래 내용이 비쳐 보이지 않는다.
    <div
      ref={listRef}
      role="tablist"
      aria-label={t('명소 정보 분류')}
      className="sticky top-12 z-10 flex gap-1 overflow-x-auto border-b border-outline-variant bg-surface-container-lowest px-2 scrollbar-none"
    >
      {DETAIL_TABS.map((tab) => {
        const selected = tab.id === value
        return (
          <button
            key={tab.id}
            id={detailTabButtonId(tab.id)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={detailTabPanelId(tab.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              onChange(tab.id)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') {
                event.preventDefault()
                moveFocus(1)
              } else if (event.key === 'ArrowLeft') {
                event.preventDefault()
                moveFocus(-1)
              }
            }}
            // 밑줄이 선택 표시다. 배경 알약을 쓰지 않는 이유는 시안의 모양이기도
            // 하지만, 일곱 칸이 가로로 훑리는 줄에서 알약은 저마다 폭이 달라
            // 눈이 붙잡을 기준선이 없어서다.
            //
            // **선택을 밑줄로만 말하지 않는다** — 글자 색과 굵기가 함께 바뀐다.
            // 밑줄 2px은 저대비 화면에서 사라질 수 있다(WCAG 1.4.1).
            className={`min-h-12 shrink-0 border-b-2 px-3 text-label-md whitespace-nowrap ${
              selected
                ? 'border-primary font-bold text-primary'
                : 'border-transparent text-on-surface-variant'
            }`}
          >
            {t(tab.label)}
          </button>
        )
      })}
    </div>
  )
}
