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

// **`pinned` 스위치는 없어졌다**(2026-08-20). 상세가 시트를 벗어나 전체 화면이
// 되면서 「시트가 135px만 보이는 peek 단계」라는 상태 자체가 사라졌다 — 그
// 스위치가 있던 이유가 그 단계 하나였다. 언제나 붙어 있다.
interface Props {
  readonly entry: AreaCatalogEntry;
}

interface MapLink {
  readonly label: string;
  readonly icon: IconName;
  /** 카탈로그 항목을 통째로 받는다 — 티맵은 이름이 아니라 좌표로 목적지를 넘긴다. */
  readonly href: (entry: AreaCatalogEntry) => string;
  /**
   * **아이콘 글리프에만 걸리는 색.** 상자는 셋이 `ACTION_BASE` 하나를 나눠 쓴다.
   *
   * `Icon`이 `fill="currentColor"`라 색은 이 자리에서만 갈린다 — `<a>`에 걸면
   * 라벨까지 브랜드 색이 되어 대비 규정 안으로 다시 들어온다.
   */
  readonly iconClassName: string;
}

// **세 버튼이 같은 스타일이다. 브랜드 색은 아이콘에만 있다.**
//
// 예전에는 카카오를 노랑으로, 네이버를 초록으로 **칠했다.** 그러면 시트 밑에
// 남의 브랜드 색 두 덩이가 상시로 깔려 한 줄이 신호등이 된다 — 이 파일 주석이
// 티맵을 테두리형으로 남긴 이유로 이미 그 걱정을 적어 뒀는데, 정작 둘은
// 칠해 놓고 있었다.
//
// 샘플(서울 인파레이더)을 픽셀로 재 보니 **셋 다 같은 중립 배경**이다
// (`rgb(239,239,236)` + 테두리 `rgb(219,219,218)`), 브랜드 색은 화살표 글리프
// 하나에만 들어간다. 그쪽이 맞다:
//
// 1. **정보를 나르는 것은 라벨이다.** 「카카오맵」이라 적혀 있으면 배경까지
//    노랑일 필요가 없다. 색은 훑을 때 찾는 단서로만 쓰면 족하다.
// 2. **다크 모드가 저절로 풀린다.** 노랑·초록은 남의 자산이라 밤에도 안 바뀌는데
//    그 위의 글자는 바뀌어야 해서 `text-brand-ink`라는 토큰을 따로 박아 뒀었다.
//    배경이 우리 토큰이면 `text-on-surface`가 두 모드에서 알아서 맞는다 —
//    그 토큰은 쓸 자리가 없어져 **지웠다.**
// 3. **셋의 무게가 같아진다.** 지도 앱 선택은 취향이라 우리가 하나를 밀 이유가
//    없다. 칠해 두면 칠한 쪽이 커 보인다.
//
// **옮기면서 하나가 딸려 왔다: 배경으로 멀쩡하던 색이 전경에서 무너진다.**
// 카카오 노랑(`#fee500`)은 배경일 때 어두운 글자를 얹어 12.90:1이었는데,
// 같은 값을 흰 표면 위 아이콘으로 놓으면 **1.28:1**이라 통째로 사라진다.
// 그래서 카카오만 색상을 유지한 채 명도를 내린 값(`brand-kakao-ink`)을 쓴다.
// 네이버 초록은 2.25:1로 3:1에 못 미치지만 초록이라는 것은 읽혀서 손대지
// 않았다. 값과 근거는 `index.css`의 `--color-brand-*` 주석에 있다.
//
// **아이콘 색 자체는 대비 규정 밖이다** — 라벨이 같은 말을 하므로 색은 장식이다
// (WCAG 1.4.1: 색만으로 정보를 전하지 않는다). 카카오를 3:1까지 올린 것은
// 규정이 아니라 **훑을 때 단서로 쓰이려면 일단 보여야 하기 때문**이다.
// `tokens.test.ts`의 「글자 대비」 검사가 브랜드 색에서 손을 떼고 아이콘
// 가시성 검사로 바뀐 것이 이 구분이다.
//
// 라벨에서 「길찾기」를 뺐다. 셋이 한 줄에 서면서 320px에서 버튼 하나에 배정되는
// 폭이 138px → **87px**로 줄었는데 「카카오맵 길찾기」는 그 폭에 못 들어간다.
// 헤드리스 크롬 실측(320/360/390px): 배정 87/101/111px, 필요 75(카카오맵)·
// 63(네이버)·53(티맵)px. 셋 다 같은 top이고 높이가 48px 그대로라 줄바꿈이 없다.
// **라벨을 늘릴 때는 다시 재라** — 320px의 여유가 12px뿐이다.
//
// **상수 배열이 아니라 함수인 이유**는 `i18n/t.ts`에 한 벌 있다 — 모듈
// 최상위의 `t()`는 import 시점의 언어로 굳는다. 이 셋은 사전에 항목이 있는데도
// (KakaoMap·Naver·TMAP) 영어 화면에서 한국어로 남아 있었다.
function mapLinks(): readonly MapLink[] {
  return [
    {
      label: t("카카오맵"),
      icon: "pin",
      href: (entry) => kakaoMapSearchUrl(entry.name),
      // **진짜 카카오 노랑이 아니다.** `#fee500`은 흰 표면에서 1.28:1이라
      // 아이콘이 사라진다 — 배경일 때는 멀쩡하던 색이 전경이 되면서 무너진
      // 것이다. 색상만 남기고 명도를 내린 우리 값이다(index.css의 주석).
      iconClassName: "text-brand-kakao-ink",
    },
    {
      label: t("네이버"),
      icon: "map",
      href: (entry) => naverMapSearchUrl(entry.name),
      // 이쪽은 실제 브랜드 값 그대로다. 2.25:1로 3:1에 못 미치지만 초록이라는
      // 것은 읽힌다 — 손대지 않는 쪽이 맞다.
      iconClassName: "text-brand-naver",
    },
    {
      // **티맵 로고 색은 토큰으로 안 들였다.** 셋째 브랜드 색을 하나 더 들이는
      // 값보다 얻는 것이 적다 — 라벨이 이미 「티맵」이라 적혀 있다. 아이콘이
      // 라벨과 같은 색을 쓰므로 셋의 무게는 그대로 같다.
      label: t("티맵"),
      icon: "navigation",
      href: (entry) => tmapRouteUrl(entry.name, entry),
      iconClassName: "text-on-surface",
    },
  ];
}

// 셋이 나눠 쓰는 상자. **예전에는 티맵만 이 모양이었다** — 카카오·네이버는
// 브랜드 배경을 칠하고 있었다. 지금은 셋이 같다.
const ACTION_BASE =
  "flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-action border border-outline-variant bg-surface-container-lowest text-label-md font-semibold text-on-surface";

export function MapLinkButtons({ entry }: Props) {
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
    // `-mb-6`으로 스크롤 상자의 `pb-6`을 상쇄한다. 그게 없으면 sticky의 담는
    // 상자가 그 24px 위에서 끝나 **바가 화면 밑변에서 24px 떠 있다.**
    //
    // `pb-safe-3`가 홈 인디케이터를 피한다. 시트 안에 있던 시절에는 시트가
    // 대신 피해 줬는데, 전체 화면에서는 이 바가 화면 맨 아래다.
    //
    // z-10은 위쪽 절들보다만 높으면 된다. 탭 줄(z-10)과 같은 층이지만 둘은
    // 화면의 위아래 끝이라 겹칠 일이 없다.
    <div className="sticky bottom-0 z-10 -mb-6 border-t border-outline-variant bg-surface-container-lowest px-4 pt-3 pb-safe-3">
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
            className={ACTION_BASE}
          >
            <Icon name={link.icon} className={`size-5 ${link.iconClassName}`} />
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}
