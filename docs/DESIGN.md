---
name: Seoul Now
colors:
  primary: '#005bbf'
  on-primary: '#ffffff'
  primary-container: '#1a73e8'
  on-primary-container: '#ffffff'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc7ff'
  on-primary-fixed: '#001a41'
  on-primary-fixed-variant: '#004493'
  inverse-primary: '#adc7ff'
  surface-tint: '#005bc0'
  secondary: '#006d37'
  on-secondary: '#ffffff'
  secondary-container: '#6bfe9c'
  on-secondary-container: '#00743a'
  secondary-fixed: '#6bfe9c'
  secondary-fixed-dim: '#4ae183'
  on-secondary-fixed: '#00210c'
  on-secondary-fixed-variant: '#005228'
  tertiary: '#9e4300'
  on-tertiary: '#ffffff'
  tertiary-container: '#c55500'
  on-tertiary-container: '#0e0200'
  tertiary-fixed: '#ffdbcb'
  tertiary-fixed-dim: '#ffb691'
  on-tertiary-fixed: '#341100'
  on-tertiary-fixed-variant: '#783100'
  background: '#f9f9ff'
  on-background: '#191c23'
  surface: '#f9f9ff'
  surface-dim: '#d8d9e3'
  surface-bright: '#f9f9ff'
  surface-variant: '#e0e2ec'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3fd'
  surface-container: '#ecedf7'
  surface-container-high: '#e6e8f2'
  surface-container-highest: '#e0e2ec'
  inverse-surface: '#2d3038'
  inverse-on-surface: '#eff0fa'
  on-surface: '#191c23'
  on-surface-variant: '#414754'
  outline: '#727785'
  outline-variant: '#c1c6d6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  calm: '#006d37'
  calm-container: '#a8f5c2'
  normal: '#7d5800'
  normal-container: '#ffdea6'
  busy: '#9e4300'
  busy-container: '#ffdbcb'
  crowded: '#ba1a1a'
  crowded-container: '#ffdad6'
  on-calm-container: '#00522a'
  on-normal-container: '#5e4200'
  on-busy-container: '#783100'
  on-crowded-container: '#93000a'
  heat-calm: '#a8f5c2'
  heat-normal: '#d99a12'
  heat-busy: '#bf5300'
  heat-crowded: '#8f1414'
  brand-kakao-ink: '#998a00'
  brand-naver: '#03c75a'
  dark-background: '#101319'
  dark-on-background: '#e2e4ee'
  dark-surface: '#101319'
  dark-surface-dim: '#101319'
  dark-surface-bright: '#363a44'
  dark-surface-variant: '#434a58'
  dark-surface-container-lowest: '#181c24'
  dark-surface-container-low: '#1d212a'
  dark-surface-container: '#222732'
  dark-surface-container-high: '#2c313d'
  dark-surface-container-highest: '#373d49'
  dark-inverse-surface: '#e2e4ee'
  dark-inverse-on-surface: '#2d3038'
  dark-on-surface: '#e2e4ee'
  dark-on-surface-variant: '#c4c9d9'
  dark-outline: '#8f95a5'
  dark-outline-variant: '#434a58'
  dark-primary: '#adc7ff'
  dark-on-primary: '#002f65'
  dark-secondary: '#4ae183'
  dark-secondary-container: '#1f4d33'
  dark-error-container: '#93000a'
  dark-on-error-container: '#ffdad6'
  dark-calm: '#4ae183'
  dark-calm-container: '#0a3d24'
  dark-on-calm-container: '#8ff2b8'
  dark-normal: '#f0c04d'
  dark-normal-container: '#4a3407'
  dark-on-normal-container: '#ffdea6'
  dark-busy: '#ffb691'
  dark-busy-container: '#5c2a0c'
  dark-on-busy-container: '#ffdbcb'
  dark-crowded: '#ff8f8a'
  dark-crowded-container: '#6b1512'
  dark-on-crowded-container: '#ffdad6'
  dark-heat-calm: '#16452c'
  dark-heat-normal: '#7a5c0e'
  dark-heat-busy: '#c2761f'
  dark-heat-crowded: '#ffb0a8'
typography:
  display-lg:
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-xs:
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  card: 0.5rem
  action: 1rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 12px
  margin-mobile: 16px
  margin-desktop: 24px
  card-gap: 8px
---

# Seoul Now — 디자인 토큰 정본

**이 파일이 색·타이포·모양의 유일한 출처다.** `src/index.css`에서 값을 직접
고치지 말고 여기를 고친 뒤 옮겨라. `src/tokens.test.ts`가 두 파일을 **양방향**
으로 대조한다 — 정본에만 있는 색도, 코드에만 있는 색도 죽는다.

손으로는 안 지켜졌다. 2026-08-12 감사에서 열 곳이 갈려 있었고, 그래서 기계가
지킨다.

## 어디서 왔나

프론트매터의 라이트 47색·타이포·모양은 `stitch_ui_ux/seoul_now/DESIGN.md`
(2026-08-20 시안)가 준 값 그대로다. 그 아래 **혼잡도·히트맵·브랜드 18색과
다크 39색은 시안에 없다** — 왜 우리가 갖고 있는지는 아래 각 절에 적었다.

## Brand & Style

**Corporate / Modern.** 정보 밀도가 높고 실시간이라, 장식보다 기능적 명료함이
먼저다. 도시 내비게이션 시스템의 어법을 빌린다.

성격은 **전문적이고, 도움이 되고, 믿을 만하게.** UI는 비켜서 있고 사용자가 도시의
맥박을 들여다보는 렌즈 노릇만 한다. "Flat 2.0" — 깨끗한 표면, 또렷한 구분선,
지도 중심 레이아웃. 무거운 그라디언트와 복잡한 그림자를 피하는 것은 취향이 아니라
**값이 5분마다 갈아 끼워지기 때문**이다.

## Colors

**Seoul Blue**가 뿌리다. 기술과 신뢰를 뜻하는 차분한 파랑이고, 활성 상태·주요
버튼·내비게이션 포커스에 쓴다.

### 중립이 차가운 쪽인 것은 갈아탄 것이다

예전 정본(Seoul Flow)의 중립은 **따뜻한 크림**(`#fffbf4`, 색상 ~38°)이었다.
근거는 「혼잡도 4색이 전부 따뜻한 계열이라 차가운 배경과 서로 밀어낸다」였고,
그 관찰 자체는 맞았다.

**이 정본은 같은 문제를 반대편에서 푼다.** 배경을 데이터 쪽으로 옮기는 대신
**데이터를 팔레트 안으로 들인다** — 혼잡도 4색을 임의의 초록·노랑·주황·빨강이
아니라 이 배색의 secondary(초록)·tertiary(주황)·error(빨강) 계열에서 뽑았다.
그러면 차가운 표면 위에서도 네 색이 남의 색으로 튀지 않는다.

### 혼잡도 4단계 — 시안에 없는 이유

시안 본문은 "A critical four-step scale (Green to Red)"라고 **말만 하고**
`colors:`에 값을 안 적었다. 서울 API가 주는 값이 4단계라 그 손실을 감당할 수
없어서 여기서 정한다.

| 단계 | 계열 | 핀·지도 | 배지 바탕 | 배지 글자 |
| --- | --- | --- | --- | --- |
| 여유 | secondary | `calm` | `calm-container` | `on-calm-container` |
| 보통 | (앰버) | `normal` | `normal-container` | `on-normal-container` |
| 약간 붐빔 | tertiary | `busy` | `busy-container` | `on-busy-container` |
| 붐빔 | error | `crowded` | `crowded-container` | `on-crowded-container` |

보통(앰버)만 이 배색에 대응 계열이 없다. tertiary(주황)를 밝혀 쓰면 「약간
붐빔」과 색상이 붙어 두 단계가 하나로 읽히므로 별도 색조를 뒀다.

**`on-*-container`는 두 일을 한다.** 배지 글자이면서 지도 마커 알약의 **배경**
이다. 값이 같아도 되는 이유는 두 요구가 어긋나지 않아서다 — 둘 다 그 색상의
어두운 끝을 원한다. 지금 배지 대비 7.2~7.4:1, 알약 흰 글자 9.3:1이다.

**`--color-calm` 같은 선명한 색을 배지 글자로 재사용하면 안 된다.** 한 토큰이
두 일을 맡던 때 네 배지가 전부 4.5:1 미달이었다(여유 3.32, 보통 2.86, 약간
붐빔 3.11, 붐빔 3.95). 지도 핀은 타일 위에서 튀어야 하고 배지는 옅은 바탕에
12px 글자를 얹어야 한다 — 요구가 반대다.

### 히트맵 램프 — 별도인 이유

요일×시간 히트맵은 **글자 없는 20px 칸**이 나란히 놓인다. 핀은 색상으로 갈리면
되지만 히트맵은 **명도가 단조로** 떨어져야 한다. 배지·핀 토큰을 재사용하면 네
단계가 사실상 둘로 읽힌다(예전 램프의 이웃 대비 최소값 1.02).

지금 값은 여유~붐빔 전체 대비를 세 구간에 **등비로 나눠** 역산한 것이다 —
이웃 대비 1.92 / 1.92 / 1.96.

「관측 없음」은 여기 없다. 그건 값이 아니라 값의 부재라 어떤 회색도 다섯째
단계처럼 읽힌다. 채우지 않고 테두리로 표현한다.

### 브랜드 색 둘

길찾기 버튼의 **아이콘 글리프 하나에만** 쓴다. 상자는 셋 다 중립 토큰이다.

- `brand-naver`는 실제 값 그대로다.
- **`brand-kakao-ink`는 진짜 카카오 노랑이 아니다.** `#fee500`은 흰 표면에서
  1.28:1이라 아이콘이 통째로 사라진다 — 배경일 때 멀쩡하던 색이 전경이 되며
  무너진 것이다. 색상(54°)만 두고 명도를 내려 3.51:1로 올린 **우리 값**이다.
  남의 로고가 아니라 우리 화살표에 칠하는 색이라 조정할 수 있다.

### Backgrounds & Borders

- 카드·주요 조작면은 **순백**(`surface-container-lowest`)이다. 표면(`surface`)이
  아주 옅은 파랑이라 카드가 그 위에 떠 보인다.
- 시안 본문의 "1px #EEEEEE 카드 테두리"는 우리 쪽에서 **`outline-variant`**로
  그린다. `#eeeeee`는 흰 배경과 1.14:1이라 저대비 화면·햇빛 아래에서 사라지고,
  이름 없는 색이 코드에 흩어지면 「이 색은 어디서 왔나」를 물을 자리가 없다.

## Dark

**시안에는 다크 토큰이 하나도 없다. 우리는 유지한다** — 밤에 지도를 보는 앱이고,
이미 화면 전체가 다크에 맞춰져 있다(`:root[data-theme='dark']`).

중립은 라이트와 **같은 차가운 색상**에 명도만 뒤집었다. 회색을 그냥 어둡게 하면
낮과 밤이 다른 앱처럼 보인다.

- **기기 설정이 아니라 `data-theme`를 본다.** 다크는 *지원*하는 것이지 기본이
  아니다. 이 앱의 얼굴은 밝은 쪽이다.
- **밤에는 카드가 배경보다 밝다.** Material 3의 다크 램프는 `-lowest`가 표면보다
  어둡지만 우리는 그 토큰을 「카드 바탕」으로 쓴다 — 글자 그대로 따르면 밤에만
  본문 자리가 구멍처럼 파인다(390px 실측에서 보였다). 쓰임을 따라 방향을 맞춘다.
- **파랑은 그대로 못 쓴다.** `#005bbf`는 어두운 표면에서 1.4:1이다. 라이트의
  `inverse-primary`와 같은 값(`#adc7ff`)으로 갈아 끼운다.
- **히트맵 램프는 방향이 뒤집힌다.** 어두운 배경에서 붐빌수록 어두워지면 「붐빔」이
  배경에 잠긴다. 다크에서는 붐빌수록 밝아진다.
- **브랜드 색 둘은 안 갈아 끼운다.** 그 색이 곧 단서라서다. 어두운 표면에서
  카카오 4.87:1 / 네이버 7.58:1로 오히려 밝은 쪽보다 잘 보인다.

## Typography

시안은 헤드라인에 **Plus Jakarta Sans**, 본문에 **Be Vietnam Pro**를 지정한다.
**우리는 웹폰트를 쓰지 않는다.** 시안 본문도 한글은 폴백하라고 적어 두었는데,
이 앱은 화면의 거의 전부가 한글이라 그 폴백이 예외가 아니라 기본이 된다 —
229KB를 받아 두 서체가 한 줄 안에서 갈리는 것을 이미 겪었다.

`system-ui`가 먼저인 것은 **고른 것**이다. 핵심 정보가 큰 숫자라(「추정 인구
88,000~90,000명」) 자형이 가장 다듬어진 플랫폼 기본 서체로 그리는 편이 낫다.
iOS는 San Francisco + Apple SD Gothic Neo, 안드로이드는 Roboto + Noto Sans KR로
떨어지는데 둘 다 같은 제조사가 짝지어 설계한 조합이라 메트릭이 맞는다.

### 스케일이 한 단계 작아졌다

시안의 "모바일에서 헤드라인은 24px을 넘기지 말 것 — 지도 면적을 지켜라"를
따랐다. 예전 스케일의 32/24/20이 24/20/16이 됐다. **본문 16px은 안 줄였다** —
시안의 `body-lg`가 16px이고, 걸으면서 읽는 화면에서 14px 본문은 다르게 잰다.

새로 생긴 둘은 카드용이다: `body-sm`(12/400)은 카드 캡션, `label-xs`(10/700)는
카드 머리의 아이콘+라벨 줄이다.

## Layout & Spacing

지도가 주 인터페이스라 **떠 있는 오버레이**가 중앙 정렬 칼럼을 대신한다.

- **4px 규칙.** 모든 간격과 크기는 4의 배수다.
- 검색 바와 필터 칩은 모바일에서 위·좌우 16px 띄워 뜬다.
- **바텀시트 3단.** Collapsed(손잡이 + 요약 한 줄) / Half / Full.
  - 시안은 40% / 95%다. **우리 값은 16% / 56% / 92%**이고 `domain/sheet.ts`가
    갖는다 — 이 앱의 시트에는 요약 스트립과 필터 칩 줄이 함께 살아서 40%면
    목록 첫 행이 안 나온다.
- **정보 그리드.** 실시간 지표는 카드 안 **2열 그리드**에 8px 간격으로 앉는다.

## Elevation & Depth

깊이는 **색조 층**과 아주 옅은 **주변 그림자**로 낸다.

- **Level 0 (지도)** — 바닥.
- **Level 1 (카드·시트)** — 순백 표면 + 아주 부드러운 그림자
  (`0 4px 12px / 5%`). 지도에서 들어 올리되 어수선해지지 않게.
- **Level 2 (떠 있는 것)** — 검색 바, 활성 마커. 조금 더 또렷하게
  (`0 4px 8px / 12%`). 다크에서는 검은 그림자가 안 보이므로 짙게 바꾼다.
- **테두리.** 그림자가 있어도 카드에는 1px 테두리를 함께 둔다. 밝은 지도 위에서
  흰 카드의 가장자리는 그림자만으로 안 선다.

## Shapes

**Rounded.** 조작하는 것은 알약 쪽으로 기운다.

- 카드·시트 상단 모서리 **8px**(`card`).
- 검색 바·카테고리 칩은 **알약**(`full`).
- 액션 상자는 **16px**(`action`).
- 히트맵 칸처럼 아주 작은 모서리는 **4px**(`sm`). Tailwind 기본 `rounded-sm`이
  마침 같은 값이지만 그건 우리 값이 아니라 우연이다 — 프레임워크가 기본을 바꾸면
  칸 모양이 조용히 달라진다.
- 상태 점·라이브 표시는 언제나 정원.

## Components

- **떠 있는 검색 바.** 알약, 1px 테두리, 순백 배경. 왼쪽 검색 아이콘.
- **카테고리 필터.** 가로로 훑는 알약 칩. 비활성은 흰 바탕 + 테두리, 활성은
  Seoul Blue 바탕 + 흰 글자.
- **바텀시트.** 상단 모서리 16px, 가운데 손잡이(32×4), 순백 배경.
- **정보 카드.** 8px 모서리의 흰 사각형. 머리는 `label-xs`(아이콘 + 라벨),
  값은 `headline-sm`, 캡션은 `body-sm`.
- **지도 마커.** 상태색 원 + 흰 아이콘/글자. 선택되면 1.2배로 커지고 흰 테두리가
  두꺼워진다.
- **상태 배지.** 상태색 바탕에 흰 글자인 촘촘한 알약. 카드 안에서 지금 혼잡도를
  말한다.
- **목록.** 세로 패딩 12px의 촘촘한 행, 1px 구분선.
- **상세 화면.** 전체 화면 + 상단 앱 바(뒤로/제목/저장/공유) + 가로로 훑는 탭 줄.
  요약 탭은 2열 카드 그리드이고 각 카드가 해당 도메인 탭의 입구다.
