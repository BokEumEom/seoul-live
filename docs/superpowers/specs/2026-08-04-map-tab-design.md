# 지도 탭 — Google 지도 연동 설계

작성일: 2026-08-04
상태: 설계 확정
선행 문서: [2026-08-03-seoul-live-design.md](./2026-08-03-seoul-live-design.md)

## 1. 목표와 범위

1차에서 비활성으로 둔 「지도」 탭을 Google 지도로 연다. 명소 30곳의 혼잡도를 지도 위 마커로 보여주고, 마커를 누르면 그 명소 요약과 「혼잡예보」로 가는 경로를 준다.

### 이 문서가 다루는 것 (지도 코어)

| 항목 | 내용 |
|---|---|
| 지도 | Google Maps JavaScript API, 서울 전역 초기 뷰 |
| 마커 | 명소 30곳, 혼잡도 4단계 색상, 줌에 따라 라벨 표시 전환 |
| 바텀시트 | 마커 탭 시 명소명·혼잡도·갱신 시각·길찾기·혼잡예보 이동 |
| 내 위치 | 현재 위치 마커와 재조정 FAB |
| 폴백 | 키 미설정·스크립트 로드 실패 시의 안내 화면 |

### 이번 범위에서 제외 (근거 포함)

| 제외 항목 | 근거 |
|---|---|
| 검색 바 | 검색할 대상이 없다. 1차에서 상단바 햄버거·검색 아이콘을 뺀 것과 같은 이유 — 넣으면 죽은 UI가 된다 |
| 목적 프리셋 칩 (아이와 나들이/데이트/지금 핫플) | PLAN.md 2차의 독립 기능. 「내 주변」의 `CategoryFilter`와 필터 로직이 겹쳐 공용화가 따라붙는다 |
| 레이어 버튼 | 전환할 레이어가 없다 |
| 주차장 현황·예상 대기 카드 | `citydata_ppltn`에 없는 필드다. `citydata`로 API를 갈아타야 하고 그건 3차 범위다 |
| 마커 클러스터링 | 의존성이 하나 더 는다. 30곳 규모에서는 줌별 라벨 전환으로 충분하다 (§4) |
| 121곳 확장 | 쿼터 문제. 활용갤러리 등록이 선행 조건 |

## 2. 핵심 제약

설계를 좌우한 사실들이다. 앱인토스 공식 문서(`llms-full.txt`, 2026-08-04 조회)와 각 패키지의 `peerDependencies`로 확인했다.

### 2.1 iframe을 쓸 수 없다 → Embed API 탈락

> iframe은 사용할 수 없어요. iframe을 사용하면 앱인토스 기능이 정상 동작하지 않고, 내부 보안 심사에서도 반려돼요. 단, YouTube 영상 콘텐츠를 삽입하는 용도는 예외적으로 iframe 사용이 가능해요.

Google Maps Embed API는 iframe이다. **선택지에서 빠진다.** 남는 것은 Maps JavaScript API와 Static Maps API 둘뿐이다.

### 2.2 TDS는 도입하지 않는다

`@toss/tds-mobile@2.5.1`의 `peerDependencies`는 `react: ^16.8.3 || ^17 || ^18`이다. 이 프로젝트는 React 19.2.8이고, 최신 TDS도 19를 지원하지 않는다. 공식 설치 안내 자체가 `react@^18 react-dom@^18`을 함께 설치하라고 명시한다.

TDS는 필수가 아니다 — 스캐폴딩이 Y/N으로 묻고, 문서도 일관되게 "TDS를 사용하는 경우"라고 조건부로 쓴다. 이 앱의 디자인 토큰은 `stitch_ui/seoul_flow/DESIGN.md` → `src/index.css`의 Material Design 3 계열 체계이고, 지도 탭도 여기에 맞춘다.

**단, 심사 체크리스트에 조건 없이 걸린 항목이 하나 있다**: "사용자 안내나 확인이 필요한 경우 TDS 모달을 사용해요." 현재 앱에 모달이 없어 당장 걸리지 않지만, 확인 다이얼로그를 추가하는 시점에 재검토해야 한다.

### 2.3 Maps JavaScript API 키는 숨길 수 없다

지도 타일과 스크립트를 브라우저가 직접 받아야 하므로 키가 클라이언트 번들에 들어간다. **프록시 뒤로 숨기는 것이 불가능하다.** Google의 공식 대응도 은닉이 아니라 제한이다.

| 수단 | 설정값 |
|---|---|
| HTTP 리퍼러 제한 | `https://seoul-live.web.tossmini.com/*` (실서비스)<br>`https://seoul-live.private-web.tossmini.com/*` (콘솔 QR 테스트)<br>`http://localhost:5173/*` (개발) |
| API 제한 | Maps JavaScript API 하나만 |
| 비용 방어 | Google Cloud 결제 상한·예산 알림 |

앞의 두 도메인은 앱인토스 SDK 3.x의 실제 웹 오리진이다(마이그레이션 문서의 CORS 안내에서 확인).

이것은 AGENTS.md의 "인증키를 코드에 넣지 마라"에 대한 **의도된 예외**다. `SEOUL_API_KEY`(서버 전용)와 성질이 다르다. AGENTS.md에 예외를 명시하지 않으면 다음 세션에 결함으로 오인돼 프록시 뒤로 옮기려는 시도가 나온다.

### 2.4 AdvancedMarker는 Map ID를 요구한다

> The `AdvancedMarker` can only be used on maps using cloud-based map styling (i.e. the `Map`-component has a `mapId` specified).

Map ID가 없으면 마커가 **아예 렌더되지 않는다.** 개발용으로 Google이 `DEMO_MAP_ID`를 제공한다("For testing, you can skip the step of creating and configuring a map ID, by using `mapId: 'DEMO_MAP_ID'`"). 출시 전에는 Cloud Console에서 발급한 자체 Map ID로 교체해야 한다.

### 2.5 바텀시트는 진입 시 열려 있으면 안 된다

심사 체크리스트:

> 미니앱에 진입하자마자 바텀시트가 자동으로 나타나지 않아요.
> 특정 화면 전환 시 바텀시트를 사용해서 사용자 행동을 강제로 유도하지 않아요.

시안 `stitch_ui/_1`은 바텀시트가 **열린 채로** 그려져 있다. 그대로 옮기면 반려된다. 지도 탭 진입 시 닫힘이 기본이고, 마커를 탭했을 때만 올라오며, 닫을 수 있어야 한다.

### 2.6 제스처 확대·축소는 지도에 한해 허용된다

> 지도처럼 꼭 필요한 경우를 제외하고, 제스처 기반 확대·축소 기능은 비활성화돼요.

지도 영역에서는 Google Maps가 자체 제스처를 처리한다(`gestureHandling: 'greedy'`). 나머지 화면의 정책은 그대로 둔다.

## 3. 라이브러리 선택

### 채택: `@vis.gl/react-google-maps@1.9.0`

```
peerDependencies: react: '>=16.8.0 || ^19.0 || ^19.0.0-rc'
dependencies: @googlemaps/js-api-loader, @types/google.maps, fast-equals
```

Google이 유지보수하는 React 래퍼다. React 19를 peer에 명시적으로 올려둔다 — TDS가 걸린 지점과 정확히 대조적이다. `<AdvancedMarker>`가 임의의 React 자식을 마커로 렌더하므로, 시안의 "알약 배지 + 핀" 마커를 `CongestionBadge`와 동일한 리터럴 클래스 맵 패턴으로 그릴 수 있다. 스크립트 로딩·정리·리렌더 동기화를 라이브러리가 맡는다.

### 기각: 직접 로더 (`@googlemaps/js-api-loader` + 명령형 API)

의존성은 가장 적다. 그러나 HTML 알약 마커를 그리려면 `AdvancedMarkerElement`에 DOM 노드를 넣어야 하고, 그 안에 React를 렌더하려면 **마커 30개마다 `createRoot`를 만들고 언마운트 때 정리**해야 한다. 그 정리 로직은 조용히 새는 종류의 결함이 나는 자리다. 결국 채택안이 해주는 일을 더 위험한 코드로 다시 쓰는 셈이다.

### 기각: Static Maps API + 자체 오버레이

외부 스크립트가 없고 `<img>` 한 장이다. **키를 Vercel 프록시 뒤로 숨길 수 있는 유일한 안**이라 AGENTS.md의 키 규칙과 정합하고, 좌표→픽셀 변환이 순수 함수(Web Mercator)라 완전히 테스트된다.

기각 사유는 **팬·줌이 없다**는 것이다. 지도 탭의 존재 이유가 돌려보며 훑는 것인데 그것이 사라진다. 이미지 요청마다 과금이라 캐시 설계도 따라붙는다.

**단, §10의 가정이 심사에서 부정되면 이 안이 대체안이다.**

### 길찾기는 Google로 넘기지 않는다

`src/platform/links.ts`가 카카오맵·네이버지도 딥링크로 여는 현재 동작을 유지한다. Google 지도는 **타일과 마커 표시 전용**이다. 한국에서 Google 지도는 경로 안내가 제한되므로 이 분리가 맞다.

## 4. 레이어 배치

```text
src/domain/map.ts           지도 표시용 순수 계산. React도 SDK도 모른다
src/platform/googleMaps.ts  Google Maps SDK 경계. 키·Map ID 해석과 가용성 판정
src/components/map/         props만 받는 지도 컴포넌트
src/screens/MapScreen.tsx   데이터 조회 + 조립
```

### 4.1 `src/platform/googleMaps.ts`

Google Maps SDK는 앱인토스 브리지와 성질이 같다 — jsdom에도 없고, 키가 없는 환경에도 없다. AGENTS.md가 브리지에 대해 "직접 부르는 코드가 흩어지면 브라우저에서 화면이 죽는다"고 적은 이유가 그대로 적용된다.

```ts
export function googleMapsApiKey(): string
export function googleMapsMapId(): string      // 미설정 시 'DEMO_MAP_ID'
export function isMapAvailable(): boolean      // 키가 비어 있지 않은가
```

이 파일이 `VITE_GOOGLE_MAPS_*`를 아는 **유일한 곳**이다. `client.ts`의 `isMockMode()`와 같은 형태다.

### 4.2 `src/domain/map.ts`

상수 둘만이면 도메인 모듈까지 만들 이유가 없다. 실제 이유는 **마커 겹침**이다.

카탈로그 30곳 중 강남역·가로수길·압구정로데오거리·청담동 명품거리가 반경 2km 안에 몰려 있다. 서울 전역이 들어오는 zoom 11에서는 알약 라벨이 서로를 덮는다. 클러스터링 라이브러리는 이번 범위를 넘으므로, 줌에 따라 표현을 바꾼다.

```ts
export const SEOUL_CENTER: Coords = { lat: 37.5665, lng: 126.978 }  // 서울시청
export const DEFAULT_ZOOM = 11                                 // 서울 전역이 들어온다
export const LABEL_MIN_ZOOM = 12

export function shouldShowMarkerLabel(zoom: number): boolean   // zoom >= LABEL_MIN_ZOOM
export function toMapMarkers(areas: readonly NearbyArea[]): readonly MapMarker[]
```

**초기 뷰는 위치 권한과 무관하게 항상 `SEOUL_CENTER` / `DEFAULT_ZOOM`이다.** 좌표가 있어도 자동으로 이동하지 않는다. 지도 탭의 목적이 서울 전역 조망이고, 자동 이동하면 서울 밖 사용자에게 마커가 하나도 없는 지도가 뜬다. 내 위치로의 이동은 재조정 FAB를 눌렀을 때만 일어난다.

```ts
export interface MapMarker {
  readonly entry: AreaCatalogEntry
  readonly level: CongestionLevel | null
}
```

**스냅샷이 실패한 명소도 마커를 그린다** — 회색 "정보 없음"으로. 「내 주변」이 이미 그렇게 하고(`CongestionBadge`의 `level === null` 분기), 지도에서만 사라지면 사용자는 그 명소가 존재하지 않는다고 오인한다.

### 4.3 `src/components/map/`

| 파일 | 역할 |
|---|---|
| `CongestionMarker.tsx` | `<AdvancedMarker>` 내용물. `TONE_MARKER_CLASS` 리터럴 맵 — `CongestionBadge`와 같은 이유(Tailwind v4 정적 추출) |
| `AreaSheet.tsx` | 바텀시트. `area === null`이면 렌더하지 않는다 (§2.5) |
| `MapUnavailableNotice.tsx` | 키 미설정 / 스크립트 로드 실패 |
| `RecenterButton.tsx` | 내 위치 FAB. 좌표가 없으면 비활성 |

`CongestionMarker`의 톤 클래스는 도메인이 만들지 않는다. Tailwind v4는 정적 추출이라 `` `bg-${tone}` `` 같은 동적 조합이 빌드에서 사라진다 — 기존 `TONE_CLASS`와 동일한 제약이다.

### 4.4 `src/screens/MapScreen.tsx`

`useAreaSnapshots(AREA_NAMES)`를 그대로 쓴다. **추가 API 호출이 없다.**

「내 주변」과 queryKey가 같아(`['areas', areaNames]`) TanStack Query 캐시를 공유하고, 서버 쪽도 `api/citydata-bulk.ts`가 이름을 중복 제거·정렬하므로 같은 CDN 캐시 항목에 떨어진다. **하루 1,000회 쿼터에 미치는 영향이 0이다.** 지도 탭을 지금 붙일 수 있는 근거 중 이것이 가장 중요하다.

내 위치는 `useLocation()`으로 받는다. `LocationProvider`가 앱 수준에서 한 번만 잡는 규칙 그대로이며, 지도 화면이 GPS를 새로 켜지 않는다.

선택 상태는 `selectedAreaName: string | null` 하나이고 바텀시트를 구동한다.

## 5. `App.tsx` — 탭 상태를 실제로 보유한다

현재는 탭을 유추한다.

```ts
const activeTab: TabKey = selectedArea === null ? 'nearby' : 'forecast'
```

탭이 셋이 되면 이 유추가 무너진다. 실제 상태로 바꾼다.

```ts
const [tab, setTab] = useState<TabKey>('nearby')
const [selectedArea, setSelectedArea] = useState<string | null>(null)
```

**혼잡예보에서 뒤로 가면 직전 탭으로 돌아간다.** 지도에서 마커를 눌러 들어갔으면 지도로, 목록에서 들어갔으면 목록으로. 현재 코드는 무조건 「내 주변」으로 간다.

`BottomTabBar`의 `map`은 `enabled: true`가 된다. `more`는 비활성을 유지한다.

## 6. 키가 없을 때의 동작

**혼잡도 데이터는 목업으로 도는데 지도 타일만 실제 키를 요구한다.** 개발 중 정상 상태가 `VITE_USE_MOCK=true` + `VITE_GOOGLE_MAPS_API_KEY=<데모키>`라는 섞인 조합이라는 뜻이다. `.env.example`에 적지 않으면 다음 사람이 "목업 모드인데 왜 키가 필요한가"에서 막힌다.

| 상황 | 동작 |
|---|---|
| `isMapAvailable() === false` | `MapUnavailableNotice` — "고장"이 아니라 "키 미설정"으로 읽히는 문구 |
| 스크립트 로드 실패 (오프라인·차단) | 같은 컴포넌트, 다른 문구 |

어느 쪽이든 「내 주변」·「혼잡예보」는 정상 동작한다. 지도 탭의 실패가 앱 전체를 막지 않는다.

## 7. 환경변수

```bash
# Google Maps JavaScript API 키. 지도 탭에서만 쓴다.
# 이 키는 클라이언트 번들에 들어간다 — 숨길 수 없는 게 정상이고 버그가 아니다.
# 보호는 은닉이 아니라 Google Cloud 콘솔의 제한으로 한다:
#   HTTP 리퍼러 — https://seoul-live.web.tossmini.com/*
#                 https://seoul-live.private-web.tossmini.com/*
#                 http://localhost:5173/*
#   API 제한   — Maps JavaScript API 하나만
# 비워두면 지도 탭이 "키 미설정" 안내를 띄운다. 나머지 화면은 정상 동작한다.
VITE_GOOGLE_MAPS_API_KEY=

# 지도 스타일 ID. AdvancedMarker(혼잡도 마커)가 Map ID를 요구한다 — 없으면
# 마커가 아예 렌더되지 않는다. 개발 중에는 비워두면 DEMO_MAP_ID를 쓴다.
# 출시 전에는 Cloud Console에서 발급한 자체 Map ID로 반드시 교체한다.
VITE_GOOGLE_MAPS_MAP_ID=
```

AGENTS.md의 키 규칙에 §2.3의 예외를 함께 명시한다.

## 8. 테스트

목업 없이 검증하는 것:

| 대상 | 검증 |
|---|---|
| `domain/map.test.ts` | `shouldShowMarkerLabel`의 경계값(11/12), `toMapMarkers`가 스냅샷 `null`인 명소도 포함하는 것 |
| `platform/googleMaps.test.ts` | 키 해석, Map ID 기본값 `DEMO_MAP_ID`, `isMapAvailable`의 빈 문자열 처리 |
| `components/map/CongestionMarker.test.tsx` | 4단계 톤 클래스, `level === null`의 회색 표현, 라벨 표시 전환 |
| `components/map/AreaSheet.test.tsx` | `area === null`이면 렌더하지 않음, 닫기·혼잡예보 이동 콜백 |

목업이 필요한 것:

`screens/MapScreen.test.tsx`에서 `@vis.gl/react-google-maps`를 `vi.mock`으로 대체한다. `App.test.tsx`가 토스 SDK에 쓰는 방식과 같다. 검증 대상은 마커 개수, 마커 클릭 시 시트가 열리는 것, 진입 시 시트가 닫혀 있는 것(§2.5), 키가 없으면 Notice가 뜨는 것이다.

AGENTS.md의 변이 테스트 규칙을 적용한다 — 새 테스트를 쓴 뒤 구현을 일부러 한 줄 깨뜨려 그 테스트가 실제로 실패하는지 확인한다. 이 프로젝트에서 "항상 참인 테스트"를 두 번 잡은 방법이다.

커버리지 임계값(라인·구문·함수 80%, 브랜치 75%)을 유지한다.

## 9. 파일 크기

AGENTS.md 기준으로 200~400줄이 보통, 800줄이 상한이다. `MapScreen.tsx`가 지도·마커·시트·FAB·폴백을 모두 안으면 상한에 접근한다. 그래서 §4.3처럼 컴포넌트를 넷으로 쪼개고, `MapScreen`은 데이터 조회와 조립만 맡는다.

## 10. 미해결 가정

**앱인토스가 서드파티 SDK의 동적 스크립트 로딩을 허용하는지 문서로 확정하지 못했다.**

심사 체크리스트에 "외부에서 전달받은 코드를 실행하는 기능은 사용할 수 없어요 (예: `eval` 등)"가 있다. Google Maps JS API는 스크립트를 동적으로 주입한다.

이 조항이 `eval` 계열의 자체 원격 코드 실행을 겨냥한 것이고 서드파티 SDK 로딩은 대상이 아니라고 읽는다. 근거는 두 가지다 — 같은 체크리스트가 지도를 제스처 확대·축소의 예외로 명시적으로 인정하고 있고(§2.6), 이 앱이 이미 Google Fonts를 CDN에서 받고 있다.

**다만 문서로 확정한 사실은 아니다.** 심사에서 걸리면 §3의 Static Maps 안이 대체안이다. STATE.md의 미해결 가정에 남긴다.

## 11. 출시 전 필수 (지도 관련)

- [ ] Google Cloud 프로젝트에서 Maps JavaScript API 활성화
- [ ] API 키에 HTTP 리퍼러 제한 적용 (§2.3의 세 도메인)
- [ ] API 키에 API 제한 적용 (Maps JavaScript API만)
- [ ] 결제 예산 알림 설정
- [ ] `DEMO_MAP_ID` → 자체 Map ID로 교체 (§2.4)
- [ ] 토스 실기기에서 지도 제스처와 바텀시트 동작 확인
