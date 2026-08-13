import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './platform/pwa.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 화면을 먼저 그리고 나서 등록한다. 이 호출은 기다리지 않는다 — 서비스워커는
// 덤이고, 실패해도 조용히 넘어간다(그 판단의 근거는 `platform/pwa.ts`에 있다).
// 토스 웹뷰 안에서는 그 파일이 알아서 건너뛴다.
void registerServiceWorker()
