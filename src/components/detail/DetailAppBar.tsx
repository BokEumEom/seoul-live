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
    // `sticky`가 아니라 흐름 안의 첫 자식이고, 스크롤 상자 밖이다
    // (`AreaDetailScreen`이 자리를 준다). 그래야 아래 탭 줄만 sticky로 붙어도
    // 두 층이 겹치는 계산을 안 해도 된다.
    //
    // **`pt-safe`가 노치를 피하는 자리다.** 전체 화면이라 지도처럼 「끝까지
    // 가는 것이 목적」인 층이 없다 — 이 바가 화면 맨 위다.
    <header className="flex items-center gap-1 border-b border-outline-variant bg-surface-container-lowest pt-safe">
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
