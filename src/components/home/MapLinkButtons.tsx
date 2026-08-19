import { t } from "../../i18n/t";
import {
  kakaoMapSearchUrl,
  naverMapSearchUrl,
  tmapRouteUrl,
} from "../../domain/mapLinks";
import type { AreaCatalogEntry } from "../../domain/types";
import { openExternalUrl } from "../../platform/links";
import { Icon, type IconName } from "../common/Icon";

// 길찾기 세 버튼. **시트 하단에 고정된 바다.**
//
// **앞선 판단이 틀려서 두 번 옮겼다. 그 과정을 남긴다.**
//
// 처음에는 히어로 바로 다음이었다(설계 §2.6). 그 다음에 맨 아래로 내렸는데,
// 근거는 「샘플(서울 인파레이더)이 혼잡도·차트·CCTV·주차·행사를 다 보여준 뒤
// 맨 끝에 놓는다 → 읽고 나서 갈지 정한다」였다. **그 관찰 자체가 틀렸다.**
//
// 틀린 이유가 배울 만하다: 그 결론을 `detail_page_sample.png`, 즉 **전체 페이지
// 스크린샷**(4,147px)에서 읽었다. 전체 페이지 캡처에서는 **고정 요소가 문서
// 맨 끝에 한 번 렌더된다** — 그걸 페이지 끝의 정적 요소로 봤다. 같은 앱의
// **뷰포트** 캡처(`seoul_detail.png`, 915px)를 보면 갈린다: 지도가 맨 위에
// 있는 **안 스크롤한** 화면인데 길찾기 셋이 화면 맨 아래에 있고, 그 바로
// 위에 「1시간 전 대비」 카드의 윗머리가 **잘려 깔려 있다.** 정적 요소라면
// 첫 화면에 나올 수가 없다.
//
// **전체 페이지 스크린샷으로 `position`을 판정하지 마라.** 고정과 「맨 끝」이
// 그 캡처에서 똑같이 생긴다 — 뷰포트 캡처를 한 장 더 봐야 갈린다.
//
// 고친 근거는 실측이다. 390×844 `광화문·덕수궁`에서 시트가 half에서 보이는
// 높이가 **449px**인데 내용 전체는 **5,395px**이고 카카오맵 버튼이 **5,369px**
// 지점에 있었다 — **주 CTA가 12화면 아래**다. 대가로 half의 449px 중 약 64px을
// 상시로 내준다(14%). 사용자가 그 값을 알고 고른 것이다(2026-08-19).
//
// **저장·공유는 함께 안 내려왔다.** 그 둘은 제목 줄에 아이콘으로 남는다
// (`ActionButtons`) — 자리를 거의 안 먹으므로 고정할 이유가 없다.

interface Props {
  readonly entry: AreaCatalogEntry;
  /**
   * 시트 하단에 붙여 둘까.
   *
   * **peek(16%)에서는 거짓이다.** 그 단계에서 시트가 보여주는 높이는 135px뿐인데
   * (390×844) 이 바가 64px을 먹으면 남는 것이 「목록으로」 한 줄이다 — 사용자가
   * 지도를 보려고 내려 둔 시트를 버튼이 차지하는 꼴이 된다.
   *
   * 거짓이면 **흐름 안의 마지막 요소로 돌아간다**(고정 이전과 같은 자리).
   * 조건부로 아예 안 그리지 않는 이유는 단계가 바뀔 때 내용 높이가 흔들리지
   * 않게 하려는 것이다 — peek에서는 어차피 스크롤 밖이라 보이지 않는다.
   */
  readonly pinned: boolean;
}

interface MapLink {
  readonly label: string;
  readonly icon: IconName;
  /** 카탈로그 항목을 통째로 받는다 — 티맵은 이름이 아니라 좌표로 목적지를 넘긴다. */
  readonly href: (entry: AreaCatalogEntry) => string;
  readonly className: string;
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
      label: t("카카오맵"),
      icon: "pin",
      href: (entry) => kakaoMapSearchUrl(entry.name),
      className: "bg-brand-kakao text-brand-ink",
    },
    {
      label: t("네이버"),
      icon: "map",
      href: (entry) => naverMapSearchUrl(entry.name),
      className: "bg-brand-naver text-brand-ink",
    },
    {
      // 티맵 로고 색을 토큰으로 들이지 않았다. 카카오·네이버는 시안이 브랜드
      // 배경을 쓰지만 셋째까지 색을 채우면 한 줄이 신호등이 된다 — 이것만
      // 테두리형으로 두어 「길찾기 둘 + 내비 하나」로 읽히게 했다.
      label: t("티맵"),
      icon: "navigation",
      href: (entry) => tmapRouteUrl(entry.name, entry),
      className:
        "border border-outline-variant bg-surface-container-lowest text-on-surface",
    },
  ];
}

const ACTION_BASE =
  "flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-action text-label-md font-semibold";

export function MapLinkButtons({ entry, pinned }: Props) {
  // href를 실제로 채운 <a>로 둔다. 브리지가 없을 때 열 주소가 여기 남아 있어야
  // 폴백이 성립하고, 스크린리더도 링크로 읽는다. 실제 열기는 openExternalUrl이
  // 맡으므로 기본 동작은 막는다 — 웹뷰에서 두 번 열리는 걸 방지한다.
  return (
    // **`sticky`이고 `fixed`가 아니다.** sticky는 흐름 안에 자기 자리를 남기므로
    // 맨 아래까지 굴리면 마지막 절(「근처 쾌적한 장소」) 뒤 제자리로 돌아간다 —
    // `fixed`로 하면 그 절의 마지막 줄이 **영영** 바 밑에 깔린다.
    //
    // 배경과 위쪽 선이 필수다. 내용이 이 바 아래로 흐르므로 투명하면 글자가
    // 버튼 사이로 비친다. 배경색은 시트 뿌리와 같은 토큰이라 이어져 보인다.
    //
    // `-mb-6`으로 상세 뿌리의 `pb-6`을 상쇄한다. 그게 없으면 sticky의 담는
    // 상자가 그 24px 위에서 끝나 **바가 시트 밑변에서 24px 떠 있다.**
    //
    // z-10은 위쪽 절들보다만 높으면 된다. 지도 마커(z-5·z-10)와 겨루지 않는다 —
    // 시트가 이미 지도 위 층이다.
    <div
      className={
        pinned
          ? "sticky bottom-0 z-10 -mb-6 border-t border-outline-variant bg-surface-container-lowest px-4 pt-3 pb-3"
          : "px-4"
      }
    >
      <div className="flex gap-3">
        {mapLinks().map((link) => (
          <a
            key={link.label}
            href={link.href(entry)}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              event.preventDefault();
              void openExternalUrl(link.href(entry));
            }}
            className={`${ACTION_BASE} ${link.className}`}
          >
            <Icon name={link.icon} className="size-5" />
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}
