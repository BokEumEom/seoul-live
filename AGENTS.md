# AGENTS.md

서울 라이브(Seoul Live) — 서울시 실시간 도시데이터로 명소 혼잡도를 보여주는 앱인토스 미니앱.

이 파일이 에이전트 지침의 정본이다. `CLAUDE.md`는 이 파일을 가리키기만 한다.

## 명령어

```bash
npm run dev          # 개발 서버 (목업 데이터)
npm test             # 테스트 1회 실행
npm run test:watch   # 테스트 감시 모드
npm run test:coverage # 커버리지 (임계값 lines/statements/functions 80%, branches 75%)
npm run lint         # ESLint
npm run build:vite   # 타입검사 + 번들 (앱인토스 없이)
npm run build        # 위 + ait build
npm run deploy       # ait deploy
```

작업을 마쳤다고 보고하기 전에 `npm test`와 `npx tsc -b`를 반드시 통과시킬 것.

## 반드시 알아야 할 제약

이 제약들이 아키텍처를 결정했다. 모르고 코드를 고치면 되돌리게 된다.

### 서울 OpenAPI는 HTTPS를 지원하지 않는다

`openapi.seoul.go.kr`은 **8088 포트의 평문 HTTP만** 열려 있다. 80·443은 닫혀 있고 8088로 TLS를 시도하면 핸드셰이크가 실패한다.

토스 미니앱은 HTTPS로 로드되므로 브라우저가 mixed content로 요청을 차단한다. **클라이언트에서 직접 호출하는 경로는 존재하지 않는다.** `api/`의 Vercel Function이 중계하는 것은 선택이 아니라 동작 조건이다.

### 하루 1,000회 호출 제한

일반인증키는 하루 1,000회다. 활용갤러리에 등록하면 해제된다.

`citydata_ppltn`은 `AREA_NM`이 필수라 **명소 1곳당 1회 호출**이 든다. 파라미터를 빼면 500이 난다. 공식 문서도 "한 번에 1개 장소씩만 호출 가능"이라고 명시한다 — 일괄 조회로 우회할 방법은 없다.

| 명소 수 | 갱신 주기 | 하루 호출량 | 판정 |
| --- | --- | --- | --- |
| 30곳 | 1시간 | 720회 | 통과 |
| 30곳 | 10분 | 4,320회 | 초과 |
| 121곳 | 5분 | 34,848회 | 초과 |

갤러리 등록 전에는 30곳 / 1시간으로 운영한다. TTL은 프록시의 `CACHE_TTL_SECONDS` 환경변수로 조절한다.

**「더보기」가 이 한도를 나눠 쓴다.** `api/cityinfo.ts`는 `citydata` 서비스를 따로 부르므로 혼잡도의 720회/일에 **더해진다**(최악 30곳 × 24 = 720회). 합치면 한도를 넘는다. 전용 손잡이가 `CITYINFO_CACHE_TTL_SECONDS`이고, 비워두면 `CACHE_TTL_SECONDS`로 떨어진다. 근거는 `api/_lib/seoul.ts`의 `cityInfoCacheTtlSeconds` 주석과 STATE.md의 "더보기는 호출량을 늘린다".

두 서비스를 하나로 합치자는 생각이 다시 나오면: `citydata`는 응답이 훨씬 크다. 30곳을 한 번에 받는 `citydata-bulk`에 얹으면 인구만 필요한 「내 주변」·「지도」까지 매번 큰 응답을 받는다. 그래서 나눠 뒀다.

**클라이언트 캐시로는 이 문제를 풀 수 없다.** 캐시가 기기마다 따로 있어서 사용자 수에 비례해 호출량이 는다. 서버 측 공용 캐시가 필요하다.

### API 응답에 좌표가 없다

`citydata_ppltn`은 위경도를 주지 않는다. 거리순 정렬과 카테고리 필터를 위해 `src/data/areas.ts`의 정적 카탈로그를 **손으로 관리**한다.

**`areas.ts`의 `name`이 곧 API 호출 키다.** 오타가 나면 그 명소만 조용히 실패한다.

공식 121곳 목록과의 대조는 끝났다(`official-areas.ts`, `areas.test.ts`가 고정). 남은 건 괄호 주변 공백뿐이고, 그건 실제 호출로만 확정된다.

### sample 키로는 실데이터 검증이 불가능하다

인증키 자리에 `sample`을 넣으면 **지역명과 무관하게 항상 광화문·덕수궁**이 돌아온다. 강남역·홍대입구역으로 호출해도 결과가 같다. 공식 명세도 "샘플key를 통해서는 주요 121장소 중 '광화문·덕수궁' 지역만 조회 가능"이라고 명시한다(`서울시+실시간+도시데이터.xls`). 그래서 목업을 쓴다.

### 서울 API 에러 코드는 두 종류다

`RESULT` 봉투로 오는 에러를 전부 "재시도해도 소용없음"으로 묶으면 안 된다. `ERROR-500`(서버 오류)과 `ERROR-600`(DB 연결 오류)은 상대 서버가 흔들린 것이라 잠시 뒤 성공할 수 있다. 나머지(`INFO-100` 무효한 키, `INFO-200` 데이터 없음, `ERROR-3xx` 요청 인자 오류, `ERROR-601` SQL 오류)는 같은 요청이면 같은 결과다. `src/data/queries.ts`의 `TRANSIENT_SEOUL_CODES`가 이 구분을 담는다.

### 숫자가 전부 문자열로 온다

`"AREA_PPLTN_MIN": "42000"` 형태다. 시각도 `"2026-08-03 16:00"`이라는 비표준 형식이다(ISO 아님, 타임존 없음). 둘 다 `src/data/schema.ts`가 흡수한다.

### 앱인토스는 iframe을 금지한다

"iframe을 사용하면 앱인토스 기능이 정상 동작하지 않고, 내부 보안 심사에서도 반려돼요. 단, YouTube 영상 콘텐츠를 삽입하는 용도는 예외." 지도에 Google Maps **Embed API**를 쓸 수 없는 이유이고, JavaScript API를 쓰는 이유다. CCTV 영상 같은 후속 기능을 검토할 때도 이 조항이 먼저다.

## 레이어 규칙

```text
src/domain/   순수 함수와 타입. React도 네트워크도 모른다.
src/data/     스키마·네트워크·목업. 여기서만 fetch 한다.
src/platform/ 토스 네이티브 브리지. 브리지가 없을 때의 폴백도 여기 있다.
src/hooks/    React 훅. 도메인 로직을 화면에 잇는다.
src/components/  props만 받는다. 데이터 페칭을 하지 않는다.
src/screens/  데이터를 가져와 컴포넌트에 내려준다.
api/          Vercel Function. 서울 API 중계와 캐시만 한다.
```

- `src/domain/`에서 React를 import하지 마라. 이 격리 덕에 렌더러 없이 단위 테스트가 된다.
- 컴포넌트는 `fetch`를 직접 부르지 않는다. `src/data/queries.ts`의 훅만 쓴다.
- 앱인토스 SDK는 `src/platform/`과 위치 훅에서만 import 한다. 토스 웹뷰 밖(개발 서버·테스트)에는 네이티브 브리지가 없어서, 브리지를 직접 부르는 코드가 흩어지면 브라우저에서 화면이 죽는다.
- **위치는 `src/app/LocationProvider`가 앱 수준에서 한 번만 잡는다.** 화면 안에서 `useCurrentLocation`을 직접 부르지 마라 — 화면이 언마운트될 때마다 GPS가 다시 켜지고, 권한을 아직 안 정한 사용자에게는 팝업이 반복해서 뜬다. 화면은 `useLocation()`으로 받아 쓴다.
- 목업↔실데이터 분기는 `src/data/client.ts` **한 곳에서만** 일어난다.
- `api/`는 정규화하지 않는다. 원본을 그대로 넘기고 클라이언트가 파싱한다. 정규화 로직이 두 곳에 생기는 것을 막으려는 것이다.
- **Google Maps SDK는 `src/screens/MapScreen.tsx`에서만 import 한다.** 키·Map ID는 `src/platform/googleMaps.ts`가 유일하게 안다. 토스 브리지와 같은 이유다 — jsdom에도 없고 키가 없는 환경에도 없어서, 흩어지면 "키가 없으면 무슨 일이 나는가"를 화면마다 따로 처리하게 된다. `CongestionMarker`가 SDK를 import하지 않는 것도 같은 이유다 — 그래야 색상·라벨 규칙을 지도 목업 없이 테스트할 수 있다.
- **`cityInfoSchema.ts`가 관대한 건 실수가 아니다.** 혼잡도(`schema.ts`)는 필드 단위 zod 스키마로 엄격하게 파싱하고, 도시정보(`cityInfoSchema.ts`)는 봉투만 검증한 뒤 나머지를 `null`·빈 배열로 흘려보낸다. 방향이 정반대인 이유는 두 가지다 — (1) `citydata` 응답을 실제로 본 적이 없다(인증키가 없어 필드 이름을 명세의 출력명 표에서만 읽었다), (2) 도시정보는 부가 정보라 일부가 비는 게 정상인데 엄격한 스키마는 주차장 한 곳의 필드 하나 때문에 날씨까지 날린다. 혼잡도는 값이 곧 화면의 존재 이유라 틀린 값을 보여주느니 실패해야 한다. **"일관성"을 이유로 한쪽에 맞추지 마라.**
- **바텀시트는 진입 시 열려 있으면 안 된다.** 앱인토스 심사 항목이다("미니앱에 진입하자마자 바텀시트가 자동으로 나타나지 않아요"). 시안 `stitch_ui/_1`은 열린 채로 그려져 있으니 그대로 옮기지 마라. `AreaSheet`는 선택된 명소가 없으면 `null`을 돌려준다.

## 혼잡도 4단계

서울 API가 실제로 주는 값은 `여유`, `보통`, `약간 붐빔`, `붐빔` 네 가지다. 디자인 시안은 3색이었지만 정보 손실을 피해 4단계를 그대로 산다.

`congestionTone()`이 돌려주는 `calm`/`normal`/`busy`/`crowded`는 `src/index.css`의 Tailwind 토큰(`bg-calm`, `bg-crowded-container` 등)과 1:1로 대응한다. **도메인은 CSS 클래스 문자열을 만들지 않는다** — Tailwind v4는 정적 추출이라 `` `bg-${tone}` `` 같은 동적 조합은 빌드에서 사라진다.

`isUncrowded()`는 `여유`+`보통`이고 `congestionTone() === 'calm'`은 `여유`뿐이다. 범위가 다르다.

## 스타일

- **Tailwind v4.** `tailwind.config.js`가 없다. 토큰은 `src/index.css`의 `@theme` 블록에 있다.
- `stitch_ui/`는 디자인 시안이라 `@source not`으로 스캔에서 제외돼 있다. 여기 클래스를 늘려도 번들에 반영되지 않는다.
- **디자인 토큰의 출처는 `stitch_ui/seoul_flow/DESIGN.md` 하나다.** `index.css`에서 값을 직접 고치지 말고 그 파일을 고친 뒤 옮긴다.
- **글자 크기는 토큰으로 쓴다** — `text-sm`·`text-lg` 같은 Tailwind 기본값 대신 `text-label-md`·`text-headline-sm`처럼 시안 스케일을 쓴다. 기본값을 섞으면 시안에 없는 크기가 화면마다 늘어난다.
- 아이콘은 `src/components/common/Icon.tsx`에 필요한 것만 둔다. 쓰이지 않게 된 아이콘은 지운다.

## 작업 규칙

- **TDD.** 실패하는 테스트 먼저, 실패 확인, 구현, 통과 확인, 커밋.
- **통과한 테스트를 믿지 마라.** 새 테스트를 쓴 뒤에는 구현을 일부러 한 줄 깨뜨려 그 테스트가 실제로 실패하는지 확인한다. 이 프로젝트에서 이미 두 번, 무엇을 해도 통과하는 "항상 참인 테스트"를 이 방법으로 잡았다(`toSorted`를 `sort`로 바꿔도 통과하던 불변성 테스트, 구현과 무관하게 통과하던 "없는 명소는 조회 안 함" 테스트).
- **불변성.** 객체를 변경하지 말고 새로 만든다. 배열은 `.sort()` 대신 `.toSorted()`를 쓴다 — TanStack Query 캐시 배열을 제자리 정렬하면 캐시가 오염된다.
- **파일은 작게.** 200~400줄이 보통, 800줄이 상한.
- **인증키를 코드에 넣지 마라.** 서버는 `process.env.SEOUL_API_KEY`, 클라이언트는 프록시를 통해서만 접근한다. 에러 메시지에 원본 예외를 담지 마라 — 키가 샐 수 있다.
- **예외: Google Maps 키는 클라이언트에 있는 게 정상이다.** 지도 타일과 스크립트를 브라우저가 직접 받아야 해서 프록시 뒤로 옮길 수 없다. 이걸 결함으로 오인해 서버로 옮기려 하지 마라 — 옮기면 지도가 아예 뜨지 않는다. 보호는 은닉이 아니라 Google Cloud 콘솔의 HTTP 리퍼러 제한(`*.web.tossmini.com`)과 API 제한으로 한다. 근거는 `docs/superpowers/specs/2026-08-04-map-tab-design.md` §2.3.
- **`console.log` 금지.** 진단이 필요하면 `console.error`를 쓴다.

## 계획 문서를 다룰 때

`docs/superpowers/plans/`의 코드 블록은 **출발점이지 받아쓰기 대상이 아니다.** 실제로 계획서의 `formatDistance`에 경계 버그가 있었고(997m가 "1000m"으로 표시됨) 그대로 옮겨져 리뷰에서야 잡혔다. 결함이 보이면 옮기지 말고 지적할 것.

## 참고 문서

| 문서 | 내용 |
| --- | --- |
| `STATE.md` | 현재 진행 상황, 다음 할 일, 막힌 것 |
| `PLAN.md` | 제품 방향과 차수별 기능 |
| `docs/superpowers/specs/` | 설계 문서 (아키텍처 결정과 근거) |
| `docs/superpowers/plans/` | 태스크 단위 구현 계획 |
| `OPEN_API/` | 서울 열린데이터광장 공식 샘플 코드 |
| `서울시+실시간+도시데이터.xls` | `citydata` 서비스 공식 명세. 확장자와 달리 실제로는 HTML이다 — `pandas.read_excel`이 아니라 HTML 테이블로 파싱할 것. 출력 필드 전체 목록과 에러 코드 표가 여기 있다 |
| `stitch_ui/` | 화면 시안 4종 + 디자인 토큰 |

앱인토스 플랫폼 문서는 세션마다 새로 받아야 한다. `.claude/skills/apps-in-toss/`의 라우팅 규칙을 따를 것. 예전에 받아둔 사본을 믿지 마라.
