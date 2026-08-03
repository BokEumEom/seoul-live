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
//
// 원본 키뿐 아니라 URL 인코딩된 형태도 치환한다 — 키에 URL에서 특별한 의미를
// 갖는 문자가 섞여 있으면(현재 실제로 그런 키가 있는지와 무관하게), 에러 메시지에
// 인코딩된 형태로 남을 수 있다. export하는 이유는 seoul.test.ts에서 "키가 포함된
// 메시지가 실제로 걸러지는지"를 직접 검증하기 위해서다 — 이 함수는 존재 이유가
// 곧 보안 요구사항이라 테스트 없이 두면 회귀를 잡을 방법이 없다.
export function redactApiKey(message: string, key: string): string {
  if (!key) {
    return message
  }
  return message.split(key).join('[REDACTED]').split(encodeURIComponent(key)).join('[REDACTED]')
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
    const name = error instanceof Error ? error.name : 'UnknownError'
    const message = error instanceof Error ? error.message : String(error)
    // 의도적으로 원본 에러를 cause로 붙이지 않는다. 이 catch가 걸러야 하는 바로 그
    // 위험(인증키가 담긴 URL)이 원본 error.message에 있을 수 있고, cause로 붙이면
    // console.error/util.inspect가 체인을 따라가며 그대로 출력해 위의 redactApiKey()가
    // 무의미해진다. redactApiKey를 거친 message만 새 에러에 담는다.
    // 다만 error.name(TypeError, AbortError 등)은 리댁션 후에도 그대로 남긴다 —
    // 타임아웃(AbortError)·DNS 실패(TypeError)·상류 HTTP 실패(일반 Error, 메시지에
    // 상태 코드 포함)를 로그만 보고 구분해야 502를 던질지 다른 처리를 할지 판단할
    // 수 있다. name 자체에는 키가 들어갈 수 없다(고정된 클래스 이름이다).
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`[${name}] ${redactApiKey(message, key)}`)
  }
}
