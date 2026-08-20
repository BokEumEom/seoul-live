import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fetchArea } from './api/_lib/seoul.js'
import { isAllowedAreaName } from './api/_lib/allowed-areas.js'
import { mapWithConcurrency } from './api/_lib/concurrency.js'
import { fetchCctvRows, fetchHotspotRows } from './api/_lib/seoulRtd.js'

/** 배포의 api/citydata-bulk.ts와 같은 값. 근거는 그 파일과 concurrency.ts 주석. */
const UPSTREAM_CONCURRENCY = 8

/**
 * 개발 서버에서 `/api/*`를 대신 처리한다. **개발 전용이고 배포에는 안 들어간다** —
 * 배포에서는 `api/`의 Vercel 함수가 같은 경로를 맡는다.
 *
 * 이게 없으면 로컬에서 실데이터를 볼 방법이 Vercel CLI(`vercel dev`)뿐인데,
 * 그것 때문에 전역 설치를 요구하고 싶지 않다. 서울 API는 HTTPS도 CORS도 없어서
 * 브라우저가 직접 부를 수도 없다.
 *
 * **인증키는 여기(Node 쪽)에만 머문다.** `import.meta.env`로 읽지 않으므로
 * 클라이언트 번들에 들어가지 않는다 — 키를 `VITE_` 접두사로 두면 안 되는 이유가
 * 이것이다. Vite는 `VITE_`로 시작하는 것만 클라이언트에 노출하고, 우리는 그
 * 목록에서 서울 인증키를 빼둔다.
 *
 * 캐시 헤더는 흉내 내지 않는다. 로컬에는 CDN이 없어 의미가 없고, 오히려 방금
 * 고친 값이 캐시에 묶여 헷갈린다. **대신 호출이 그대로 하루 1,000회에 잡힌다.**
 */
function seoulApiDevServer(env: Record<string, string>): Plugin {
  return {
    name: 'seoul-api-dev-server',
    apply: 'serve',
    configureServer(server) {
      // fetchArea가 process.env에서 읽는다. .env의 값을 그쪽으로 옮겨준다.
      if (env.SEOUL_API_KEY) {
        process.env.SEOUL_API_KEY = env.SEOUL_API_KEY
      }

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '', 'http://localhost')
        if (!url.pathname.startsWith('/api/')) {
          next()
          return
        }

        const send = (status: number, body: unknown): void => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(body))
        }

        // **명소 전체 혼잡도도 인증키 검사보다 먼저다** — CCTV와 같은 상류다.
        // 이게 아래 가드 뒤에 있으면 키 없이 화면만 만지는 개발에서 **목록과
        // 지도가 통째로 죽는다**(CCTV는 한 절이 비는 정도였다).
        if (url.pathname === '/api/hotspots') {
          try {
            send(200, { rows: await fetchHotspotRows() })
          } catch (error) {
            // 배포(api/hotspots.ts)와 같은 판단 — 혼잡도는 본체라 502로 올린다.
            console.error('[dev api] /api/hotspots', error)
            send(502, { error: '혼잡도 정보를 가져오지 못했습니다.' })
          }
          return
        }

        // **CCTV는 인증키 검사보다 먼저다.** 상류가 서울 OpenAPI가 아니라
        // 인증키를 안 쓰기 때문이다(`api/_lib/seoulRtd.ts`) — 아래 가드 뒤에
        // 두면 키 없이 화면만 만지는 개발에서 CCTV만 500으로 죽는다.
        if (url.pathname === '/api/cctv') {
          const area = url.searchParams.get('area') ?? ''
          if (!isAllowedAreaName(area)) {
            send(400, { error: '알 수 없는 명소입니다.' })
            return
          }
          try {
            send(200, await fetchCctvRows(area))
          } catch (error) {
            // 배포(api/cctv.ts)와 같은 판단 — 부가 정보라 화면을 깨지 않는다.
            console.error('[dev api] /api/cctv', error)
            send(200, [])
          }
          return
        }

        if (!process.env.SEOUL_API_KEY) {
          send(500, { error: 'SEOUL_API_KEY가 .env에 없습니다.' })
          return
        }

        try {
          // 일괄 조회. 배포의 api/citydata-bulk.ts와 같은 봉투(이름을 키로)를 만든다.
          if (url.pathname === '/api/citydata-bulk') {
            const names = (url.searchParams.get('areas') ?? '')
              .split(',')
              .map((name) => name.trim())
              .filter((name) => name !== '' && isAllowedAreaName(name))

            // 동시 연결을 배포와 같은 8개로 묶는다. 서울 API는 레거시라
            // 30개를 한꺼번에 열면 연결 거부·스로틀링을 부른다 — 개발에서만
            // 다르게 두면 로컬에서 안 나던 실패가 배포에서만 난다.
            const settled = await mapWithConcurrency(names, UPSTREAM_CONCURRENCY, fetchArea)
            const results = names.map((name, index) => {
              const outcome = settled[index]
              // 한 곳이 실패해도 나머지는 살린다(배포 쪽과 같은 규칙).
              return [name, outcome.status === 'fulfilled' ? outcome.value : null] as const
            })
            // **봉투를 `{ results }`로 감싼다.** 배포의 api/citydata-bulk.ts가
            // 그렇게 주고 클라이언트의 parseBulkEnvelope가 그 모양만 받는다.
            // 평평하게 주면 스키마에서 걸려 30곳이 전부 「정보 없음」이 된다.
            send(200, { results: Object.fromEntries(results) })
            return
          }

          const area = url.searchParams.get('area') ?? ''
          if (!isAllowedAreaName(area)) {
            send(400, { error: '알 수 없는 명소입니다.' })
            return
          }

          if (url.pathname === '/api/citydata') {
            send(200, await fetchArea(area))
            return
          }
          if (url.pathname === '/api/cityinfo') {
            send(200, await fetchArea(area, 'citydata'))
            return
          }
          next()
        } catch (error) {
          // fetchArea가 이미 키를 치환해서 던진다. 그래도 응답에는 안 싣는다.
          console.error('[dev api]', url.pathname, error)
          send(502, { error: '서울 API 조회에 실패했습니다.' })
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 세 번째 인자를 ''로 두면 VITE_ 접두사가 없는 것까지 읽는다. 이 값은 Node
  // 쪽에서만 쓰고 클라이언트로 넘기지 않는다.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss(), seoulApiDevServer(env), pwa()],
  }
})

/**
 * 웹 배포(`seoul-live-now.vercel.app`)를 설치 가능한 앱으로 만든다.
 *
 * **토스 미니앱과 같은 `dist`를 쓴다.** `npm run build`가 `vite build` 한 번을
 * 돌고 그 결과를 `ait build`가 그대로 포장하므로, 여기서 만드는 매니페스트와
 * 서비스워커 파일은 `.ait` 안에도 들어간다. 파일이 들어가는 것 자체는 몇 KB라
 * 문제가 아니지만 **등록은 하면 안 된다** — 토스 웹뷰 안에서 서비스워커가
 * 옛 번들을 붙들면 사용자에게는 되돌릴 방법이 없다. 그래서 `injectRegister: null`
 * 로 자동 주입을 끄고, 등록은 `src/platform/pwa.ts`가 환경을 보고 직접 한다.
 */
function pwa(): Plugin[] {
  return VitePWA({
    // **자동 주입을 끈다.** 켜 두면 index.html에 등록 코드가 무조건 박혀
    // 토스 웹뷰에서도 서비스워커가 살아난다. 위 주석의 이유로 안 된다.
    injectRegister: null,
    // 새 배포가 있으면 받아서 곧바로 갈아탄다. 이 앱에는 지킬 입력 상태가 없고
    // (필터·즐겨찾기는 localStorage에 있다), 낡은 번들이 바뀐 API 응답을
    // 파싱하다 조용히 「정보 없음」이 되는 쪽이 새로고침 한 번보다 나쁘다.
    registerType: 'autoUpdate',
    // 개발 서버에서는 끈다. 켜면 서비스워커가 `/api/*`를 가로채 위 개발용
    // 미들웨어와 겹치고, 방금 고친 코드가 캐시에 묶여 헷갈린다.
    devOptions: { enabled: false },
    includeAssets: ['icon.svg', 'apple-touch-icon.png'],
    manifest: {
      name: '서울 라이브',
      short_name: '서울라이브',
      description: '서울 주요 명소의 실시간 인파를 지도에서 봅니다.',
      lang: 'ko',
      dir: 'ltr',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      // 지도와 시트가 세로 화면을 전제로 짜여 있다(시트 비율이 화면 높이 기준).
      orientation: 'portrait',
      // 상태 표시줄 색이다. 화면 맨 위는 지도 위에 뜬 흰 검색 바라 표면색이 맞다.
      // 파랑(`--color-primary`)을 넣으면 검색 바와 경계가 생겨 오히려 튄다.
      // 매니페스트에는 색을 한 벌만 적을 수 있다(다크용 필드가 없다).
      // 설치 화면과 스플래시가 이 값을 쓰므로 라이트 표면색으로 둔다 —
      // 주소창 쪽 다크 대응은 index.html의 `theme-color` 두 줄이 한다.
      theme_color: '#fffbf4',
      background_color: '#fffbf4',
      icons: [
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        {
          // **한 그림이 둘을 겸한다.** `icon.svg`가 이미 마스커블 안전지대
          // (가운데 80%) 안에 핀을 넣고 바탕을 꽉 채우고 있어서, 안드로이드가
          // 어떤 모양으로 잘라도 핀이 안 잘린다 — 그 근거는 그 파일에 있다.
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      // SPA다. 어떤 경로로 들어와도 셸을 내준다.
      navigateFallback: 'index.html',
      // **`/api/*`는 셸로 대체하면 안 된다.** 오프라인에서 API 요청에 index.html을
      // 돌려주면 JSON 파서가 `<!doctype`에서 터져, 「못 받았다」가 「깨졌다」가 된다.
      navigateFallbackDenylist: [/^\/api\//],
      runtimeCaching: [
        {
          // 혼잡도 조회. **네트워크가 먼저다** — 「지금 붐빔」이 이 앱의 전부라
          // 캐시를 먼저 주면 앱이 거짓말을 한다. 캐시는 오프라인일 때의 마지막
          // 기억으로만 쓴다. 화면이 「마지막 업데이트 HH:MM」을 함께 보여주므로
          // 낡은 값이 조용히 지나가지 않는다.
          // **같은 오리진으로 좁힌다.** 경로만 보면 아무 서드파티의 `/api/`도
          // 걸린다. 서비스워커가 사는 곳은 웹 배포뿐이고(토스 웹뷰에서는 등록
          // 자체를 안 한다) 거기서는 `/api/*`가 같은 오리진의 Vercel 함수다 —
          // 절대 URL(`VITE_API_BASE_URL`)은 토스 빌드에서만 쓴다.
          urlPattern: ({ url, sameOrigin }) =>
            sameOrigin && url.pathname.startsWith('/api/'),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'seoul-api',
            // 상류가 죽어 있을 때 무한정 기다리지 않는다. 3초면 마지막 기억을 낸다.
            networkTimeoutSeconds: 3,
            expiration: {
              // 명소 30곳 + 일괄 + 상세 몇 개. 넉넉히 잡아도 이 정도다.
              maxEntries: 60,
              // 서버가 CDN에 거는 `s-maxage`와 같은 값이다. 이보다 오래된 기억은
              // 오프라인에서도 보여줄 값어치가 없다.
              maxAgeSeconds: 60 * 60,
            },
            cacheableResponse: { statuses: [200] },
          },
        },
      ],
      // **구글 지도는 캐시하지 않는다.** 타일과 SDK는 서드파티 opaque 응답이라
      // 용량을 못 재고, 구글 지도 약관이 타일 저장을 제한한다. 오프라인에서
      // 지도는 비고, 그건 `MapUnavailableNotice`가 이미 설명하는 상태다.
      globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      // **hls.js는 미리 받지 않는다(500KB).** CCTV를 여는 사람만 받으라고
      // 동적 import로 갈라 뒀는데(`CctvPlayer.tsx`), 프리캐시가 그걸 도로
      // 무효로 만든다 — 첫 방문에 모두가 받게 되어 갈라 둔 의미가 없어진다.
      // 실제로 빌드 결과에서 확인하고 넣은 줄이다: 청크는 갈렸는데
      // `sw.js`의 프리캐시 목록에 그 파일이 들어 있었다.
      //
      // 오프라인 대비를 잃지 않는다 — **라이브 영상은 어차피 네트워크가
      // 있어야 한다.** 받아 둬 봐야 틀 것이 없다.
      globIgnores: ['**/hls-*.js'],
    },
  }) as Plugin[]
}
