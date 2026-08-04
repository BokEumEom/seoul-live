# AGENTS.md

서울 라이브(Seoul Live) — 서울시 실시간 도시데이터로 명소 혼잡도를 보여주는 앱인토스 미니앱.

이 파일이 에이전트 지침의 정본이다. `CLAUDE.md`는 이 파일을 가리키기만 한다.

## 명령어

```bash
npm run dev          # 개발 서버 (목업 데이터)
npm test             # 테스트 1회 실행
npm run test:watch   # 테스트 감시 모드
npm run test:coverage # 커버리지 (임계값 lines 80%)
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

**클라이언트 캐시로는 이 문제를 풀 수 없다.** 캐시가 기기마다 따로 있어서 사용자 수에 비례해 호출량이 는다. 서버 측 공용 캐시가 필요하다.

### API 응답에 좌표가 없다

`citydata_ppltn`은 위경도를 주지 않는다. 거리순 정렬과 카테고리 필터를 위해 `src/data/areas.ts`의 정적 카탈로그를 **손으로 관리**한다.

**`areas.ts`의 `name`이 곧 API 호출 키다.** 오타가 나면 그 명소만 조용히 실패한다. 인증키 발급 후 공식 장소 목록과 대조 검증할 것.

### sample 키로는 실데이터 검증이 불가능하다

인증키 자리에 `sample`을 넣으면 **지역명과 무관하게 항상 광화문·덕수궁**이 돌아온다. 강남역·홍대입구역으로 호출해도 결과가 같다. 그래서 목업을 쓴다.

### 숫자가 전부 문자열로 온다

`"AREA_PPLTN_MIN": "42000"` 형태다. 시각도 `"2026-08-03 16:00"`이라는 비표준 형식이다(ISO 아님, 타임존 없음). 둘 다 `src/data/schema.ts`가 흡수한다.

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
- 목업↔실데이터 분기는 `src/data/client.ts` **한 곳에서만** 일어난다.
- `api/`는 정규화하지 않는다. 원본을 그대로 넘기고 클라이언트가 파싱한다. 정규화 로직이 두 곳에 생기는 것을 막으려는 것이다.

## 혼잡도 4단계

서울 API가 실제로 주는 값은 `여유`, `보통`, `약간 붐빔`, `붐빔` 네 가지다. 디자인 시안은 3색이었지만 정보 손실을 피해 4단계를 그대로 산다.

`congestionTone()`이 돌려주는 `calm`/`normal`/`busy`/`crowded`는 `src/index.css`의 Tailwind 토큰(`bg-calm`, `bg-crowded-container` 등)과 1:1로 대응한다. **도메인은 CSS 클래스 문자열을 만들지 않는다** — Tailwind v4는 정적 추출이라 `` `bg-${tone}` `` 같은 동적 조합은 빌드에서 사라진다.

`isUncrowded()`는 `여유`+`보통`이고 `congestionTone() === 'calm'`은 `여유`뿐이다. 범위가 다르다.

## 스타일

- **Tailwind v4.** `tailwind.config.js`가 없다. 토큰은 `src/index.css`의 `@theme` 블록에 있다.
- `stitch_ui/`는 디자인 시안이라 `@source not`으로 스캔에서 제외돼 있다. 여기 클래스를 늘려도 번들에 반영되지 않는다.
- 디자인 토큰의 출처는 `stitch_ui/seoul_flow/DESIGN.md`다.

## 작업 규칙

- **TDD.** 실패하는 테스트 먼저, 실패 확인, 구현, 통과 확인, 커밋.
- **불변성.** 객체를 변경하지 말고 새로 만든다. 배열은 `.sort()` 대신 `.toSorted()`를 쓴다 — TanStack Query 캐시 배열을 제자리 정렬하면 캐시가 오염된다.
- **파일은 작게.** 200~400줄이 보통, 800줄이 상한.
- **인증키를 코드에 넣지 마라.** 서버는 `process.env.SEOUL_API_KEY`, 클라이언트는 프록시를 통해서만 접근한다. 에러 메시지에 원본 예외를 담지 마라 — 키가 샐 수 있다.
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
| `stitch_ui/` | 화면 시안 4종 + 디자인 토큰 |

앱인토스 플랫폼 문서는 세션마다 새로 받아야 한다. `.claude/skills/apps-in-toss/`의 라우팅 규칙을 따를 것. 예전에 받아둔 사본을 믿지 마라.
