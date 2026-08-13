import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fetchArea } from './api/_lib/seoul.js'
import { isAllowedAreaName } from './api/_lib/allowed-areas.js'
import { mapWithConcurrency } from './api/_lib/concurrency.js'

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
    plugins: [react(), tailwindcss(), seoulApiDevServer(env)],
  }
})
