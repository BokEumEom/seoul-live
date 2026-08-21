import { domAnimation, LazyMotion, MotionConfig } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * 화면 전환 애니메이션의 뿌리. **두 겹이고 둘 다 이유가 있다.**
 *
 * **`MotionConfig reducedMotion="user"` — 접근성.** `index.css`에 이미
 * `prefers-reduced-motion` 처방이 있지만 그건 **CSS 전환만** 끈다. framer는
 * JS로 스타일을 매 프레임 쓰므로 그 미디어 쿼리가 닿지 않는다 — 이 줄이
 * 없으면 전정기관 장애가 있는 사용자에게 화면 절반이 밀려 들어오는 동작이
 * 그대로 재생된다. `"user"`는 위치·크기 변화만 끄고 페이드는 남기므로
 * 「무엇이 바뀌었나」는 여전히 보인다.
 *
 * **`LazyMotion features={domAnimation} strict` — 번들.** framer 전부를
 * 그냥 쓰면 34KB(gz)가 붙는데, 이 앱이 하는 것은 밀기와 페이드뿐이다.
 * `domAnimation`만 실으면 그 절반이고, 레이아웃 애니메이션·드래그·SVG
 * 경로처럼 안 쓰는 것이 안 들어온다.
 *
 * **`strict`가 그 절약을 강제한다.** 이 플래그가 없으면 누군가 `motion.div`를
 * 한 번 쓰는 순간 트리 셰이킹이 풀려 전부가 다시 들어오는데, **번들 크기는
 * 테스트가 안 잡는다.** `strict`는 `motion.*`를 만나면 던지므로 그 회귀가
 * 조용히 지나가지 않는다 — 앞으로 쓸 것은 언제나 `m.*`다.
 *
 * 실측(2026-08-21, `npm run build:vite` 뒤 gzip): `m` + `domAnimation`이
 * **192,030바이트**, `motion`을 그냥 쓰면 **205,036바이트**다 — 13KB, 6.8%.
 * 토스 미니앱은 남의 앱 안에서 열리는 웹뷰라 첫 바이트가 곧 체감 속도다.
 *
 * ---
 *
 * **이 프로바이더는 앱 루트가 아니라 애니메이션을 쓰는 화면마다 있다.**
 * 한 곳에 두고 싶은 모양이지만, `m.*`는 `LazyMotion` 없이 렌더되면 **기능이
 * 하나도 안 실려 `initial` 스타일에 그대로 얼어붙는다.** 확인했다:
 *
 *     <m.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} />
 *     → <div style="opacity: 0; transform: translateX(12px);">
 *
 * 그 스타일이 지워지지 않으므로 **내용이 통째로 안 보인다.** 루트에만 두면
 * 그 화면을 따로 렌더하는 곳(테스트가 그렇다)에서 조용히 빈 화면이 되고,
 * 앞으로 `m.*`를 쓰는 컴포넌트가 늘 때마다 같은 함정이 다시 놓인다.
 *
 * 화면이 스스로 들고 있으면 **혼자 렌더돼도 성립한다.** 중첩은 무해하다 —
 * 둘 다 컨텍스트일 뿐이고 기능은 한 번만 실린다.
 */
export function MotionProvider({ children }: { readonly children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  )
}
