import { useState } from 'react'
import { kakaoMapSearchUrl, naverMapSearchUrl, tmapRouteUrl } from '../../domain/mapLinks'
import type { AreaCatalogEntry } from '../../domain/types'
import { openExternalUrl, shareMessage } from '../../platform/links'
import { Icon, type IconName } from '../common/Icon'

interface Props {
  readonly entry: AreaCatalogEntry
  /** 저장 버튼이 눌린 상태인가. 즐겨찾기라는 사실은 부르는 쪽에만 있다 —
   *  여기서는 토글 버튼의 눌림 여부일 뿐이다. */
  readonly saved: boolean
  readonly onSave: () => void
}

interface MapLink {
  readonly label: string
  readonly icon: IconName
  /** 카탈로그 항목을 통째로 받는다 — 티맵은 이름이 아니라 좌표로 목적지를 넘긴다. */
  readonly href: (entry: AreaCatalogEntry) => string
  readonly className: string
}

// 배경은 남의 브랜드 색이라 우리가 못 고친다 — 맞출 수 있는 것은 글자 쪽이다.
// 네이버에 흰 글자를 얹으면 2.25:1로 무너졌다(카카오는 원래 어두운 글자라
// 문제가 없었다). 둘 다 `text-on-surface`로 맞춘다: 네이버 7.63, 카카오 13.43.
// 값과 근거는 index.css의 `--color-brand-*` 주석에, 대비는 `tokens.test.ts`에.
// 라벨에서 「길찾기」를 뺐다. 셋이 한 줄에 서면서 320px에서 버튼 하나에 배정되는
// 폭이 138px → **87px**로 줄었는데 「카카오맵 길찾기」는 그 폭에 못 들어간다.
// 헤드리스 크롬 실측(320/360/390px): 배정 87/101/111px, 필요 75(카카오맵)·
// 63(네이버)·53(티맵)px. 셋 다 같은 top이고 높이가 48px 그대로라 줄바꿈이 없다.
// **라벨을 늘릴 때는 다시 재라** — 320px의 여유가 12px뿐이다.
const MAP_LINKS: readonly MapLink[] = [
  {
    label: '카카오맵',
    icon: 'pin',
    href: (entry) => kakaoMapSearchUrl(entry.name),
    className: 'bg-brand-kakao text-on-surface',
  },
  {
    label: '네이버',
    icon: 'map',
    href: (entry) => naverMapSearchUrl(entry.name),
    className: 'bg-brand-naver text-on-surface',
  },
  {
    // 티맵 로고 색을 토큰으로 들이지 않았다. 카카오·네이버는 시안이 브랜드
    // 배경을 쓰지만 셋째까지 색을 채우면 한 줄이 신호등이 된다 — 이것만
    // 테두리형으로 두어 「길찾기 둘 + 내비 하나」로 읽히게 했다.
    label: '티맵',
    icon: 'navigation',
    href: (entry) => tmapRouteUrl(entry.name, entry),
    className:
      'border border-outline-variant bg-surface-container-lowest text-on-surface',
  },
]

// 한 줄에 나란히 서는 네 버튼의 기하는 함께 움직인다. 색만 갈라 두어 높이나
// 반경을 고칠 때 한쪽만 고치는 일이 없게 한다(PopulationCard의 CHIP_BASE와 같은 이유).
const ACTION_BASE =
  'flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-action text-label-md font-semibold'

export function ActionButtons({ entry, saved, onSave }: Props) {
  // 라벨이 「저장」→「저장됨」으로 바뀌어도 포커스가 머문 요소의 이름 변경은
  // iOS VoiceOver도 안드로이드 TalkBack도 다시 읽지 않는다. aria-pressed를
  // 쓰지 않기로 했으므로(같은 상태를 두 번 읽는다) 이 리전이 유일한 확인 수단이다.
  //
  // starred에서 파생하지 않고 클릭 때 채운다 — 파생하면 이미 저장한 곳을 열
  // 때 리전이 내용을 가진 채로 삽입돼 일부 스크린리더가 그대로 낭독한다.
  const [saveNotice, setSaveNotice] = useState('')

  // href를 실제로 채운 <a>로 둔다. 브리지가 없을 때 열 주소가 여기 남아 있어야
  // 폴백이 성립하고, 스크린리더도 링크로 읽는다. 실제 열기는 openExternalUrl이
  // 맡으므로 기본 동작은 막는다 — 웹뷰에서 두 번 열리는 걸 방지한다.
  return (
    <div className="flex flex-col gap-3 px-4">
      <div className="flex gap-3">
        {MAP_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href(entry)}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              event.preventDefault()
              void openExternalUrl(link.href(entry))
            }}
            className={`${ACTION_BASE} ${link.className}`}
          >
            <Icon name={link.icon} className="size-5" />
            {link.label}
          </a>
        ))}
      </div>
      <div className="flex gap-3">
        {/* Google Maps의 Save 자리. 공유와 한 줄이라 행이 늘지 않는다. */}
        <button
          type="button"
          onClick={() => {
            setSaveNotice(`${entry.name} ${saved ? '저장 해제' : '저장됨'}`)
            onSave()
          }}
          className={`${ACTION_BASE} border text-primary ${
            saved
              ? 'border-secondary-container bg-secondary-container'
              : 'border-outline-variant bg-surface-container-lowest'
          }`}
        >
          <Icon name={saved ? 'starFilled' : 'star'} className="size-5" />
          {saved ? '저장됨' : '저장'}
        </button>
        <button
          type="button"
          onClick={() => {
            void shareMessage(`${entry.name} 실시간 혼잡도 - 서울 라이브`)
          }}
          className={`${ACTION_BASE} border border-outline-variant bg-surface-container-lowest text-on-surface`}
        >
          <Icon name="share" className="size-5" />
          공유하기
        </button>
      </div>
      {/* 320px에서 「친구에게 공유하기」는 배정 폭 138px에 필요 폭 145px이라
          마지막 음절이 둘째 줄로 넘어갔다. 「공유하기」는 89px로 280px까지 한 줄이다. */}
      <span role="status" aria-live="polite" className="sr-only">
        {saveNotice}
      </span>
    </div>
  )
}
