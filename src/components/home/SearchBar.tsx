import { t } from '../../i18n/t'
import { Icon } from '../common/Icon'

interface Props {
  readonly value: string
  readonly onChange: (next: string) => void
}

// 검색만 한다. 「내 주변」은 지도 위 FAB(`RecenterButton`)이 흡수했다 —
// 지도가 화면 전체가 되면서 그것은 검색 줄에 얹을 일이 아니라 지도에 대고
// 하는 동작이 됐고, 지도 위에 떠 있어야 무엇에 대한 동작인지가 보인다.
export function SearchBar({ value, onChange }: Props) {
  return (
    <div className="flex items-center px-4 py-2">
      {/* 링은 입력이 아니라 이 상자가 받는다. 사용자가 조작한다고 느끼는 단위가
          아이콘·입력·지우기 버튼을 묶은 이 검색 필드 전체이기 때문이다 —
          안쪽 입력만 감싸면 링이 테두리 안에 갇혀 두 겹으로 보인다.
          그래서 입력의 `outline-none`은 그대로 둔다(index.css의 base 레이어
          규칙을 유틸리티가 이기므로 실제로 지워진다).

          `:focus-visible`이 아니라 `focus-within`인 것도 고른 것이다. 텍스트
          입력은 마우스·터치로 눌러 들어와도 「지금 여기에 쓴다」가 보여야 한다 —
          키보드일 때만 그리는 규칙은 버튼에 맞는 규칙이다. */}
      <div className="flex min-h-12 flex-1 items-center gap-2 rounded-card border border-outline-variant bg-surface-container-lowest px-3 shadow-floating focus-within:ring-2 focus-within:ring-primary">
        <Icon name="search" className="size-4 text-on-surface-variant" />
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("명소 검색")}
          aria-label={t("명소 검색")}
          className="min-w-0 flex-1 bg-transparent text-body-md text-on-surface outline-none"
        />
        {value !== '' && (
          <button
            type="button"
            aria-label={t("검색어 지우기")}
            onClick={() => onChange('')}
            // 손에 닿는 상자는 40px, 눈에 보이는 아이콘은 16px 그대로다.
            // 예전에는 패딩도 최소 높이도 없어서 버튼이 곧 아이콘 크기(16px)였다 —
            // WCAG 2.5.8의 24px에도 못 미쳤다. **하필 이 버튼이 빈 목록 문구의
            // 근거다**(HomeScreen의 `emptyMessage` 주석: 검색어를 지목하는 이유가
            // "지우는 버튼이 검색 바에 이미 있어 풀 길이 함께 있고"). 문서로
            // 적어 둔 탈출로가 16px 위에 서 있었다.
            //
            // `-mr-3`은 필드의 오른쪽 패딩(`px-3` = 12px)을 상쇄해 40px 상자의
            // 오른쪽 끝을 테두리에 붙인다. 그래야 아이콘 중심이 테두리에서
            // 20px — 늘리기 전과 **같은 자리**다. 상자를 그냥 키우면 아이콘이
            // 안쪽으로 밀려 시각적으로 어긋난다.
            //
            // 48px이 아니라 40px인 이유: 필드가 48px이라 48px 상자는 위아래로
            // 딱 맞아 여유가 없고, 아래 칩 줄과 겹칠 여지가 생긴다. 40px은 이
            // 저장소가 이미 쓰는 급이고(FilterChips·SortSegmented의 `min-h-10`)
            // WCAG 2.5.8은 통과한다.
            className="-mr-3 grid size-10 shrink-0 place-items-center text-on-surface-variant"
          >
            <Icon name="close" className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}
