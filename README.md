# 서울 라이브 (Seoul Live)

서울시 실시간 도시데이터로 명소 혼잡도를 보여주는 토스 미니앱.

나가기 전에 목적지가 붐비는지 확인한다. 명소별 혼잡도가 여유·보통·약간 붐빔·붐빔으로 뜨고, 내 위치 근처 명소가 거리순으로 나온다. 시간별 예측으로 "지금은 붐빔, 21시엔 여유 예상"까지 알려준다.

화면은 넷이다.

| 탭 | 내용 |
| --- | --- |
| **내 주변** | GPS 기반 명소 목록. 거리순·혼잡도순 정렬, 카테고리 필터, 여유로운 곳 추천 |
| **지도** | Google Maps 위 혼잡도 마커. 목적 프리셋(아이와 나들이 / 데이트 / 지금 핫플)으로 거른다 |
| **혼잡예보** | 명소 상세. 시간별 예측 차트, 한산해지는 시각, 길찾기·공유 |
| **더보기** | 명소 한 곳의 도시 정보 — 주차장·따릉이·날씨·대기·문화행사·재난문자 |

데이터는 서울시가 KT 기지국 신호 기반으로 5분마다 갱신하는 [실시간 도시데이터](https://data.seoul.go.kr)를 쓴다.

## 시작하기

```bash
npm install
cp .env.example .env    # VITE_USE_MOCK=true 면 목업으로 실행된다
npm run dev
```

인증키 없이도 목업 데이터로 전체 화면이 동작한다.

## 명령어

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm test` | 테스트 1회 실행 |
| `npm run test:watch` | 테스트 감시 모드 |
| `npm run test:coverage` | 커버리지 (lines 80% 임계) |
| `npm run lint` | ESLint |
| `npm run build:vite` | 타입검사 + 번들 |
| `npm run build` | 위 + `ait build` |
| `npm run deploy` | `ait deploy` |

## 구조

```
src/domain/       순수 함수와 타입. React도 네트워크도 모른다
src/data/         스키마·네트워크·목업. 여기서만 fetch 한다
src/platform/     토스 네이티브 브리지와 Google Maps SDK 경계. 브리지가 없을 때의 폴백도 여기
src/app/          Provider(쿼리·위치). 위치는 앱 수준에서 한 번만 잡는다
src/hooks/        React 훅
src/components/   props만 받는다
src/screens/      화면 조립
api/              Vercel Function — 서울 API HTTPS 중계와 캐시
```

플랫폼 설정은 `apps-in-toss.config.ts`에서 관리한다.

## 왜 중계 서버가 필요한가

서울 OpenAPI는 **8088 포트의 평문 HTTP만** 제공한다. 80·443 포트는 닫혀 있다.

토스 미니앱은 HTTPS로 로드되므로 브라우저가 mixed content로 요청을 차단한다. 클라이언트에서 직접 호출할 방법이 없다. `api/`의 Vercel Function이 중계한다.

중계 서버는 캐시 역할도 한다. 인증키는 하루 1,000회 제한이 있고 명소 1곳당 1회 호출이 드는데, 클라이언트 캐시는 기기마다 따로라 사용자 수에 비례해 호출량이 는다. CDN 엣지 캐시로 호출량을 갱신 주기에만 묶어둔다.

## 실데이터 전환

1. [data.seoul.go.kr](https://data.seoul.go.kr)에서 일반 인증키를 발급받는다
2. **활용갤러리에 앱을 등록한다** — 하루 1,000회 제한이 풀린다
3. Vercel 환경변수에 `SEOUL_API_KEY`를 넣는다
4. `CACHE_TTL_SECONDS`를 설정한다 — 갤러리 등록 전 `3600`, 후 `300`
5. `CITYINFO_CACHE_TTL_SECONDS`를 정한다 — 「더보기」 전용 TTL. 비워두면 위 값으로 떨어진다. 「더보기」는 `citydata`를 따로 부르므로 혼잡도와 하루 한도를 나눠 쓴다([AGENTS.md](./AGENTS.md)의 계산 참고)
6. `.env`에서 `VITE_USE_MOCK=false`, `VITE_API_BASE_URL`을 배포된 프록시 주소로

인증키 자리에 `sample`을 넣으면 지역명과 무관하게 항상 광화문·덕수궁만 돌아온다. 실데이터 검증에는 쓸 수 없다.

## 문서

| 문서 | 내용 |
| --- | --- |
| [AGENTS.md](./AGENTS.md) | 개발 규칙, 아키텍처 제약 — 코드 고치기 전에 읽을 것 |
| [STATE.md](./STATE.md) | 현재 진행 상황, 다음 할 일 |
| [PLAN.md](./PLAN.md) | 제품 방향, 차수별 기능 |
| `docs/superpowers/specs/` | 설계 문서 |
| `docs/superpowers/plans/` | 구현 계획 |
