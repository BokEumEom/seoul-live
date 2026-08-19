import { t } from '../../i18n/t'
import { kakaoMapSearchUrl, naverMapSearchUrl, tmapRouteUrl } from '../../domain/mapLinks'
import type { AreaCatalogEntry } from '../../domain/types'
import { openExternalUrl } from '../../platform/links'
import { Icon, type IconName } from '../common/Icon'

// 길찾기 세 버튼. **상세의 맨 아래다.**
//
// 예전에는 히어로 바로 다음이었다(설계 §2.6). 옮긴 근거는 샘플(서울
// 인파레이더)이다 — 그쪽은 혼잡도·차트·CCTV·주차·행사를 다 보여준 **뒤**
// 맨 끝에 「카카오맵 길찾기 / 네이버 길찾기 / 티맵 안내」를 놓는다.
// 화면의 순서가 곧 사용자의 순서라는 뜻이다: **읽고 나서 갈지 정한다.**
// 맨 위에 두면 아직 갈지 안 갈지도 모르는 사람에게 먼저 묻는 꼴이다.
//
// **저장·공유는 함께 안 내려왔다.** 그 둘은 위에 남는다 — 옛 판단(「저장이
// 폴드 밖으로 나가면 헤더의 별이 늘 보이던 것보다 못해진다」)이 길찾기와
// 달리 여기서는 그대로 유효하다. 저장은 화면을 다 읽기 전에도 하고 싶을
// 수 있지만, 길찾기는 다 읽은 뒤에 하는 일이다.

interface Props {
  readonly entry: AreaCatalogEntry
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
// 문제가 없었다). 둘 다 `text-brand-ink`로 맞춘다: 네이버 7.32, 카카오 12.90.
// **`text-on-surface`가 아닌 이유가 다크 모드다.** 그 토큰은 밤에 크림색으로
// 뒤집히는데, 배경인 카카오 노랑은 남의 자산이라 그대로다 — 노랑 위의 크림
// 글자는 1.2:1로 통째로 사라진다. `--color-brand-ink`는 어느 모드에서도 안 바뀐다.
// 값과 근거는 index.css의 `--color-brand-*` 주석에, 대비는 `tokens.test.ts`에.
// 라벨에서 「길찾기」를 뺐다. 셋이 한 줄에 서면서 320px에서 버튼 하나에 배정되는
// 폭이 138px → **87px**로 줄었는데 「카카오맵 길찾기」는 그 폭에 못 들어간다.
// 헤드리스 크롬 실측(320/360/390px): 배정 87/101/111px, 필요 75(카카오맵)·
// 63(네이버)·53(티맵)px. 셋 다 같은 top이고 높이가 48px 그대로라 줄바꿈이 없다.
// **라벨을 늘릴 때는 다시 재라** — 320px의 여유가 12px뿐이다.
//
// **상수 배열이 아니라 함수인 이유**는 `SortSegmented`에 한 벌 있다 — 모듈
// 최상위의 `t()`는 import 시점의 언어로 굳는다. 이 셋은 사전에 항목이 있는데도
// (KakaoMap·Naver·TMAP) 영어 화면에서 한국어로 남아 있었다.
function mapLinks(): readonly MapLink[] {
  return [
    {
      label: t('카카오맵'),
      icon: 'pin',
      href: (entry) => kakaoMapSearchUrl(entry.name),
      className: 'bg-brand-kakao text-brand-ink',
    },
    {
      label: t('네이버'),
      icon: 'map',
      href: (entry) => naverMapSearchUrl(entry.name),
      className: 'bg-brand-naver text-brand-ink',
    },
    {
      // 티맵 로고 색을 토큰으로 들이지 않았다. 카카오·네이버는 시안이 브랜드
      // 배경을 쓰지만 셋째까지 색을 채우면 한 줄이 신호등이 된다 — 이것만
      // 테두리형으로 두어 「길찾기 둘 + 내비 하나」로 읽히게 했다.
      label: t('티맵'),
      icon: 'navigation',
      href: (entry) => tmapRouteUrl(entry.name, entry),
      className:
        'border border-outline-variant bg-surface-container-lowest text-on-surface',
    },
  ]
}

const ACTION_BASE =
  'flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-action text-label-md font-semibold'

export function MapLinkButtons({ entry }: Props) {
  // href를 실제로 채운 <a>로 둔다. 브리지가 없을 때 열 주소가 여기 남아 있어야
  // 폴백이 성립하고, 스크린리더도 링크로 읽는다. 실제 열기는 openExternalUrl이
  // 맡으므로 기본 동작은 막는다 — 웹뷰에서 두 번 열리는 걸 방지한다.
  return (
    <div className="flex gap-3 px-4">
      {mapLinks().map((link) => (
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
  )
}
