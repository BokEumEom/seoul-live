import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * `src/` 아래 컴포넌트 원문을 한 덩어리로 읽는다. **테스트 파일은 뺀다** —
 * 거기 적힌 클래스명은 화면이 아니라 단언이라, 세면 「쓰지 않는 색인데
 * 테스트에만 나오는 것」이 쓰이는 것으로 잡힌다.
 *
 * 다크 모드 완결성 검사가 이걸 쓴다: 화면에서 쓰는 색 토큰인데 다크 값이
 * 없으면 밤에 그 자리만 라이트 색이 남는다.
 */
function readSourceFiles(dir: string): string {
  return readdirSync(dir, { withFileTypes: true })
    .map((entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        return readSourceFiles(path)
      }
      if (!/\.tsx?$/.test(entry.name) || entry.name.includes('.test.')) {
        return ''
      }
      return readFileSync(path, 'utf8')
    })
    .join('\n')
}

export default defineConfig({
  plugins: [react()],
  // `tokens.test.ts`가 색 토큰의 대비를 실제 파일에서 읽어 계산한다. 토큰 값을
  // 테스트에 리터럴로 옮겨 적으면 색을 고칠 때 테스트도 함께 고치게 되어 아무것도
  // 못 죽이기 때문이다.
  //
  // **주입하는 이유가 둘이다.** (1) vitest는 CSS 임포트를 통째로 스텁 처리해서
  // `import css from './index.css?raw'`가 빈 문자열을 준다 — 확인했다. (2) 테스트
  // 안에서 `node:fs`를 부르면 `tsconfig.app.json`이 브라우저 번들용이라
  // (`types: ["vite/client"]`) `tsc -b`가 죽고, 거기에 node 타입을 열면 앱 코드가
  // 브라우저에 못 가는 API를 부를 길이 생긴다. 이 파일은 tsc 프로젝트 밖이라
  // node API를 여기서 쓰는 것이 경계를 넘지 않는다.
  //
  // 값은 전환 시점에 문자열로 박힌다. `vitest run`은 매번 새로 읽지만 **watch
  // 중에 index.css를 고치면 이 값은 낡은 채로 남는다** — 색을 만졌으면 러너를
  // 다시 띄워라.
  define: {
    __INDEX_CSS__: JSON.stringify(readFileSync('src/index.css', 'utf8')),
    __DESIGN_MD__: JSON.stringify(
      readFileSync('stitch_ui/seoul_flow/DESIGN.md', 'utf8'),
    ),
    __SRC_SOURCES__: JSON.stringify(readSourceFiles('src')),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      // api/**도 포함한다 — 프록시가 인증 없는 오픈 릴레이가 될 뻔한 게(C1) 바로
      // 이 디렉터리였다. src/**만 커버리지 압력을 받으면 보안이 걸린 코드가
      // 계속 사각지대에 남는다.
      include: ['src/**/*.{ts,tsx}', 'api/**/*.ts'],
      exclude: [
        'src/test/**',
        'src/**/*.test.{ts,tsx}',
        'src/main.tsx',
        'api/**/*.test.ts',
      ],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
})
