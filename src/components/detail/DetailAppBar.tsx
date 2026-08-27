import type { ReactNode } from 'react'
import { areaDisplayName } from '../../i18n/areaName'
import { t } from '../../i18n/t'
import type { AreaCatalogEntry } from '../../domain/types'
import { Icon } from '../common/Icon'

interface Props {
  readonly entry: AreaCatalogEntry
  readonly onBack: () => void
  /**
   * 오른쪽 조작부(저장·인스타그램·공유). 슬롯인 이유는 `AreaHero`가 그랬던
   * 것과 같다 — 저장은 즐겨찾기 저장소를, 공유는 브리지를 알아야 하는데 이
   * 바는 카탈로그 한 줄만 보고 그리는 조각이다.
   */
  readonly actions?: ReactNode
}

/**
 * 상세 전체 화면의 상단 바. **뒤로 · 이름 · 조작부**가 한 줄이다.
 *
 * **예전에는 「목록으로」라는 글자 링크가 시트 안에 있었다.** 상세가 시트를
 * 벗어나 전체 화면이 되면서 그 자리가 성립하지 않는다 — 화면을 통째로 덮는
 * 페이지에서 되돌아가는 길은 맨 위 왼쪽 화살표라는 것이 웹·iOS·안드로이드가
 * 공통으로 쓰는 관용이고, 시안(stitch_ui_ux/_2)도 그렇다.
 *
 * **이름이 여기로 올라왔다.** 예전에는 히어로의 h2였는데, 스크롤해 내려가면
 * 「지금 보고 있는 곳이 어디인지」가 화면에서 사라졌다. 고정 바에 두면 탭을
 * 옮겨 다녀도 남는다.
 *
 * `h1`이 아니라 `h2`인 것은 `App`이 h1을 갖기 때문이다 — 층을 건너뛰지 않는다.
 */
export function DetailAppBar({ entry, onBack, actions }: Props) {
  return (
    // **`sticky top-0`이고 높이가 48px로 고정이다.** 시트 안이라 노치를 피할
    // 일이 없어(`pt-safe`가 없다) 높이가 기기에 따라 흔들리지 않는다 — 바로
    // 아래 탭 줄이 `top-12`로 이 바에 붙는 근거가 그것이다. 둘 중 하나의
    // 높이를 고치면 다른 하나의 `top`이 따라와야 한다.
    //
    // `z-20`은 탭 줄(`z-10`)보다 위다. 스크롤하면 탭 줄이 이 바 **아래로**
    // 지나가야 하는데, 같은 층이면 그리는 순서가 그것을 정해 버린다.
    // **`pr-3`이 없으면 시트가 가로로 스크롤된다.** `ActionButtons`가 `-mr-3`으로
    // 마지막 48px 버튼의 안쪽 여백을 되돌리는데(그쪽 주석), 그 음수 여백을
    // 받아줄 패딩이 여기 없어서 12px이 헤더 밖으로 나갔다 — 390px에서
    // `data-sheet-content`의 `scrollWidth`가 402였다(2026-08-27 실측).
    //
    // **그 12px이 세로 스크롤을 흔든다.** 시트 상자는 `overflow-y-auto`인데,
    // 한 축이 `visible`이 아니면 다른 축의 `visible`도 `auto`로 계산된다 —
    // 즉 가로로도 스크롤 가능한 상자가 되어, 위아래로 미는 손가락의 미세한
    // 가로 성분이 그대로 내용을 좌우로 민다. 화면에는 잘린 것이 안 보이므로
    // 코드로도 스크린샷으로도 드러나지 않았다.
    //
    // 12px인 것은 우연이 아니다: 되돌리는 대상이 48px 버튼 안의 12px이라
    // 패딩도 같은 값이어야 정확히 상쇄된다. 결과는 왼쪽 뒤로 버튼과 대칭이다
    // (글리프가 양쪽 다 가장자리에서 12px).
    <header className="sticky top-0 z-20 flex h-12 items-center gap-1 border-b border-outline-variant bg-surface-container-lowest pr-3">
      <button
        type="button"
        onClick={onBack}
        // 48px 타깃. 아이콘뿐인 버튼에 이 저장소가 쓰는 크기다.
        className="grid size-12 shrink-0 place-items-center rounded-full text-on-surface"
        aria-label={t('뒤로')}
      >
        <Icon name="back" className="size-6" />
      </button>

      {/* `truncate`가 아니라 한 줄 말줄임이다. 상단 바는 높이가 고정이라
          두 줄을 허용하면 아래 탭 줄이 밀린다 — 히어로의 `line-clamp-2`와
          다른 판단이고, 이유는 그 자리가 흐름 안이라 자랄 수 있어서다.
          영어 이름이 잘리는 값은 감수한다: 바로 아래 히어로가 카테고리와
          거리를 적고, 사용자는 방금 그 이름을 눌러 들어왔다. */}
      <h2 className="min-w-0 flex-1 truncate text-headline-sm text-on-surface">
        {areaDisplayName(entry)}
      </h2>

      {actions}
    </header>
  )
}
