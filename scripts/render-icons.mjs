// `public/icon.svg`를 PWA가 요구하는 PNG 크기들로 렌더한다.
//
// **왜 스크립트인가.** 이 저장소에는 sharp도 ImageMagick도 없고, 아이콘 하나를
// 위해 네이티브 의존성을 들이고 싶지 않다. 헤드리스 크롬은 이미 실측에 쓰고
// 있으므로 렌더러가 하나 더 늘지 않는다 — 게다가 **브라우저가 그리는 그대로**라
// 실제로 사용자에게 보일 픽셀과 같다.
//
// **빌드에 걸지 않았다.** 아이콘은 디자인을 고칠 때만 바뀌는데 매 빌드에 크롬을
// 띄우면 CI가 느려지고 크롬이 없는 환경에서 빌드가 깨진다. 결과 PNG는 저장소에
// 넣는다. `public/icon.svg`를 고쳤으면 이 스크립트를 돌리고 함께 커밋해라.
//
//   node scripts/render-icons.mjs
//
// 크롬은 스크립트가 직접 띄우고 끝나면 죽인다.

import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 9333

/**
 * 어느 크기로 무엇을 만들 것인가.
 *
 * - 192·512: 웹 매니페스트의 표준 두 크기. 512 하나로도 규격은 만족하지만,
 *   안드로이드가 목록·알림에서 작은 것을 따로 찾으므로 192를 함께 둔다.
 * - 180: 애플 터치 아이콘. iOS는 `maskable`을 모르고 제 모양으로만 자르므로
 *   바탕이 꽉 찬 정사각형이 맞다.
 */
const SIZES = [
  { size: 192, file: 'pwa-192x192.png' },
  { size: 512, file: 'pwa-512x512.png' },
  { size: 180, file: 'apple-touch-icon.png' },
]

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ]
  return candidates.find((path) => path !== undefined && path !== '')
}

async function connect(url) {
  const socket = new WebSocket(url)
  let nextId = 0
  const pending = new Map()
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id !== undefined && pending.has(message.id)) {
      pending.get(message.id)(message)
      pending.delete(message.id)
    }
  }
  await new Promise((resolve) => {
    socket.onopen = resolve
  })
  return {
    socket,
    send: (method, params = {}) =>
      new Promise((resolve) => {
        const id = ++nextId
        pending.set(id, resolve)
        socket.send(JSON.stringify({ id, method, params }))
      }),
  }
}

async function waitForChrome() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      if (response.ok) return await response.json()
    } catch {
      // 아직 안 떴다.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('크롬이 디버깅 포트를 열지 않았습니다.')
}

async function main() {
  const chromePath = findChrome()
  if (chromePath === undefined) {
    throw new Error(
      '크롬을 찾지 못했습니다. CHROME_PATH 환경변수로 실행 파일을 알려주세요.',
    )
  }

  const svg = await readFile(join(ROOT, 'public/icon.svg'), 'utf8')
  // `background: transparent`가 아니라 아이콘이 스스로 바탕을 채운다. 그래도
  // 페이지 여백이 섞이지 않게 body의 여백을 0으로 두고 딱 그 크기만 잘라낸다.
  const page = (size) =>
    `<!doctype html><meta charset="utf-8"><style>
       html,body{margin:0;padding:0;background:transparent}
       svg{display:block;width:${size}px;height:${size}px}
     </style>${svg}`

  const chrome = spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--user-data-dir=/tmp/seoul-live-icon-render',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  try {
    const targets = await waitForChrome()
    const target = targets.find((entry) => entry.type === 'page')
    const client = await connect(target.webSocketDebuggerUrl)
    await client.send('Page.enable')

    for (const { size, file } of SIZES) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: size,
        height: size,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await client.send('Page.navigate', {
        url: `data:text/html;charset=utf-8,${encodeURIComponent(page(size))}`,
      })
      // 렌더가 끝난 프레임을 찍는다. navigate 직후에 찍으면 빈 화면이 나온다.
      await new Promise((resolve) => setTimeout(resolve, 400))
      const shot = await client.send('Page.captureScreenshot', {
        format: 'png',
        clip: { x: 0, y: 0, width: size, height: size, scale: 1 },
      })
      const bytes = Buffer.from(shot.result.data, 'base64')
      await writeFile(join(ROOT, 'public', file), bytes)
      process.stdout.write(`${file} (${size}x${size}) ${bytes.length}바이트\n`)
    }
    client.socket.close()
  } finally {
    chrome.kill()
  }
}

main().catch((error) => {
  process.stderr.write(`아이콘 렌더 실패: ${error.message}\n`)
  process.exitCode = 1
})
