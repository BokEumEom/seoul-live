# 서울 라이브 (Seoul Live)

서울시 실시간 도시데이터로 명소 혼잡도를 보여주는 토스 미니앱.

나가기 전에 목적지가 붐비는지 확인한다. 명소별 혼잡도가 여유·보통·약간 붐빔·붐빔으로 뜨고, 내 위치 근처 명소가 거리순으로 나온다. 시간별 예측으로 "지금은 붐빔, 21시엔 여유 예상"까지 알려준다.

**화면은 하나다. 지도가 전부다.**

| 영역 | 내용 |
| --- | --- |
| **지도** | 뷰포트를 꽉 채운다. Google Maps 위 혼잡도 마커 + 그 위에 떠 있는 검색 바와 필터 칩(★ 내 장소 / 아이와 나들이 / 데이트 / 지금 핫플), 우하단 「내 주변」 버튼 |
| **바텀시트** | 지도를 덮는다. 손잡이로 3단(살짝 열림 16% / 절반 46% / 전체 92%) 조절. 안에서 목록 → 명소 상세 → 오늘의 서울이 갈아 끼워진다 |
| **명소 상세** | 시간별 예측 차트, 길찾기·저장·공유, 인구 구성(성별·연령·상주비율), 도시 정보(주차장·따릉이·날씨·문화행사·재난문자) |
| **오늘의 서울** | 시트 맨 위 요약 스트립을 누르면 열린다 — 혼잡도 분포, 붐빔·여유 TOP, 카테고리별 평균, 재난문자 모음, 여유로운 곳 추천 |

즐겨찾기는 「★ 내 장소」 필터 칩이다. 이 기기에 저장된다.

**하단 탭바도 앱 자체 상단바도 없다.** 토스가 미니앱에 네이티브 헤더를 주고, 지도 위 검색 바가 그 층을 이미 쓴다. 제목은 스크린리더용 `sr-only` h1 「서울 라이브」로만 남아 있다. 시트를 전체(92%)로 펼치면 검색 바·칩·「내 주변」 버튼이 함께 물러난다 — 그 열이 손잡이를 통째로 덮어서, 그대로 두면 시트를 다시 내릴 수 없다.

데이터는 서울시가 KT 기지국 신호 기반으로 5분마다 갱신하는 [실시간 도시데이터](https://data.seoul.go.kr)를 쓴다.

## 시작하기

```bash
npm install
cp .env.example .env    # VITE_USE_MOCK=true 면 목업으로 실행된다
npm run dev
```

인증키 없이도 목업 데이터로 전체 화면이 동작한다. 인증키가 있으면 `VITE_USE_MOCK=false`로 실데이터를 쓴다 — 개발 서버가 `/api/*`를 직접 중계하므로 Vercel CLI 없이도 된다.

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
src/hooks/        React 훅. 즐겨찾기는 favoritesStore가 모듈에 한 벌만 든다
src/components/   props만 받는다
                  home/ 시트·검색·칩·상세 · list/ 목록 · today/ 오늘의 서울
                  cityinfo/ 도시 정보 · map/ 지도 · forecast/ 예측 차트 · common/
src/screens/      데이터를 가져와 컴포넌트에 내려준다
                  HomeScreen(화면 전체) · TodayScreen(시트 안 뷰)
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
5. `CITYINFO_CACHE_TTL_SECONDS`를 정한다 — 명소 상세의 도시 정보 전용 TTL. **비워두면 3시간**(혼잡도를 그보다 길게 잡았으면 그 값)이다. 도시 정보는 `citydata`를 따로 부르므로 혼잡도와 하루 한도를 나눠 쓴다 — 갤러리 등록 전에는 3시간이 한도를 지키는 값이다([AGENTS.md](./AGENTS.md)의 계산 참고). 등록 후에는 `3600`으로 줄여도 된다
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
