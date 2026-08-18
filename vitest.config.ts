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

/** 같은 파일 집합을 경로와 함께 준다. 위 함수와 거르는 규칙이 같아야 한다. */
function listSourceFiles(
  dir: string,
): readonly { readonly path: string; readonly source: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return listSourceFiles(path)
    }
    if (!/\.tsx?$/.test(entry.name) || entry.name.includes('.test.')) {
      return []
    }
    return [{ path, source: readFileSync(path, 'utf8') }]
  })
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
    // 앱 셸의 정적 HTML. 번들러가 안 만지는 파일이라 어떤 컴포넌트 테스트도
    // 닿지 않는데, `viewport-fit=cover` 한 줄이 빠지면 안전영역 처리가 통째로
    // 죽는다. `src`는 브라우저용 tsconfig라 테스트에서 `node:fs`를 못 쓰므로
    // (`types: ["vite/client"]`) 여기서 주입한다 — `__INDEX_CSS__`와 같은 방식이다.
    __INDEX_HTML__: JSON.stringify(readFileSync('index.html', 'utf8')),
    __DESIGN_MD__: JSON.stringify(
      readFileSync('stitch_ui/seoul_flow/DESIGN.md', 'utf8'),
    ),
    __SRC_SOURCES__: JSON.stringify(readSourceFiles('src')),
    // 화면 파일만. 「감싸지 않은 한국어」 검사가 쓴다 — `src/data`의 명소
    // 카탈로그와 목업, `src/domain`의 API 값은 화면 글자가 아니라 데이터라
    // 함께 보면 전부 걸린다.
    __UI_SOURCES__: JSON.stringify(
      readSourceFiles('src/components') + readSourceFiles('src/screens'),
    ),
    // 위와 같은 파일들을 **경로와 함께 따로** 준다. 「모듈 최상위에서 `t()`를
    // 부르지 않는다」 검사가 원문을 파일 단위로 파싱해야 해서다 — 한 덩어리로
    // 이으면 어느 파일이 걸렸는지 말할 수 없고, 파서에게도 서로 다른 모듈을
    // 한 모듈로 보여주게 된다.
    __UI_FILES__: JSON.stringify([
      ...listSourceFiles('src/components'),
      ...listSourceFiles('src/screens'),
    ]),
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
