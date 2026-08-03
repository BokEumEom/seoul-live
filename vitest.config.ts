import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
