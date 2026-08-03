const SEOUL_API_BASE = 'http://openapi.seoul.go.kr:8088'
const SERVICE = 'citydata_ppltn'
const FETCH_TIMEOUT_MS = 8_000

export function cacheTtlSeconds(): number {
  const raw = Number(process.env.CACHE_TTL_SECONDS)
  // Cache-Control의 s-maxage(delta-seconds)는 정수여야 한다(RFC 9111 §1.2.2). 예전에
  // Number.isFinite만 썼을 때는 '300.5' 같은 값이 통과해 `s-maxage=300.5`를 만들었는데,
  // 이걸 거부하는 CDN/파서는 디렉티브 자체가 없는 것으로 취급한다 — 즉 캐시가 통째로
  // 꺼진다. 쿼터 전략 전체가 이 헤더 하나에 걸려 있고 사람이 대시보드에 손으로 넣는
  // 값이라 실수하기 쉬우므로 정수만 받는다.
  return Number.isInteger(raw) && raw > 0 ? raw : 3_600
}

export function apiKey(): string {
  const key = process.env.SEOUL_API_KEY
  if (!key) {
    throw new Error('SEOUL_API_KEY not configured')
  }
  return key
}

// 인증키는 URL 경로 세그먼트다. fetch가 네트워크 실패("fetch failed")나 URL 파싱 실패
// ("Failed to parse URL from ...")로 던지는 에러의 message에는 시도한 URL 전체가
// 그대로 실려오는 구현이 있다 — 그러면 키가 예외 메시지를 타고 로그로 샌다.
// 여기서 한 번 걸러 키 문자열을 치환해두면, 이 함수를 호출하는 곳(citydata.ts,
// citydata-bulk.ts)이 무슨 짓을 하든(그대로 console.error 등) 키가 새지 않는다.
function redactApiKey(message: string, key: string): string {
  return key ? message.split(key).join('[REDACTED]') : message
}

export async function fetchArea(areaName: string): Promise<unknown> {
  const key = apiKey()
  const url = `${SEOUL_API_BASE}/${key}/json/${SERVICE}/1/5/` + encodeURIComponent(areaName)

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    if (!response.ok) {
      throw new Error(`Seoul API responded ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // 의도적으로 원본 에러를 cause로 붙이지 않는다. 이 catch가 걸러야 하는 바로 그
    // 위험(인증키가 담긴 URL)이 원본 error.message에 있을 수 있고, cause로 붙이면
    // console.error/util.inspect가 체인을 따라가며 그대로 출력해 위의 redactApiKey()가
    // 무의미해진다. redactApiKey를 거친 message만 새 에러에 담는다.
    // eslint-disable-next-line preserve-caught-error
    throw new Error(redactApiKey(message, key))
  }
}
