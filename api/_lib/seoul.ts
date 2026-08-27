const SEOUL_API_BASE = 'http://openapi.seoul.go.kr:8088'
const FETCH_TIMEOUT_MS = 8_000

// 우리가 쓰는 두 서비스. `citydata`는 인구·주차장·따릉이·날씨·문화행사·재난문자를
// 한 번에 주고, `citydata_ppltn`은 그중 인구만 준다. 명소당 호출 1회는 어느 쪽이든
// 같지만 응답 크기가 크게 달라, 인구만 필요한 목록 화면은 계속 좁은 쪽을 쓴다.
//
// **2026-08-27, 상세 프록시(citydata.ts)를 지우면서 이 타입을 `citydata` 하나로
// 좁히는 것도 검토했지만 하지 않았다.** citydata-bulk.ts(목록 화면)가 여전히
// `fetchArea(name)`을 두 번째 인자 없이 불러 아래 기본값(`citydata_ppltn`)에
// 기댄다 — 지우면 목록 화면이 조용히 `citydata`(몇 배 큰 응답)로 갈아타 버린다.
// 그 호출자는 fetchAreaSnapshots·useAreaSnapshots와 함께 Task 7에서 지워진다.
// 그때 이 타입도 `citydata` 하나로 좁히고 두 번째 인자 자체를 없애면 된다.
export type SeoulService = 'citydata_ppltn' | 'citydata'

export function cacheTtlSeconds(): number {
  const raw = Number(process.env.CACHE_TTL_SECONDS)
  // Cache-Control의 s-maxage(delta-seconds)는 정수여야 한다(RFC 9111 §1.2.2). 예전에
  // Number.isFinite만 썼을 때는 '300.5' 같은 값이 통과해 `s-maxage=300.5`를 만들었는데,
  // 이걸 거부하는 CDN/파서는 디렉티브 자체가 없는 것으로 취급한다 — 즉 캐시가 통째로
  // 꺼진다. 쿼터 전략 전체가 이 헤더 하나에 걸려 있고 사람이 대시보드에 손으로 넣는
  // 값이라 실수하기 쉬우므로 정수만 받는다.
  return Number.isInteger(raw) && raw > 0 ? raw : 3_600
}

/**
 * 도시정보(`citydata`)용 TTL.
 *
 * **2026-08-27부터 혼잡도와 같은 값이다.** 예전에는 3시간이었는데, 그건
 * 혼잡도(`citydata_ppltn`, 24회/일/명소)와 도시정보(8회/일/명소)가 같은
 * 하루 1,000회를 나눠 쓰던 시절의 배분이다. 상세가 `citydata` 한 번으로
 * 합쳐지면서 **나눌 것이 없어졌다** — 이 호출 하나가 혼잡도까지 준다.
 *
 * 손잡이는 남겨 둔다. 활용갤러리 등록으로 한도가 풀리면 더 짧게 잡을 수 있다.
 */
export function cityInfoCacheTtlSeconds(): number {
  const raw = Number(process.env.CITYINFO_CACHE_TTL_SECONDS)
  // 정수만 받는 이유는 cacheTtlSeconds와 같다(RFC 9111 §1.2.2).
  if (Number.isInteger(raw) && raw > 0) {
    return raw
  }
  return cacheTtlSeconds()
}

// CCTV 목록(SeoulRtd)용 TTL. **위 둘과 달리 하루 1,000회 한도와 무관하다** —
// 인증키를 쓰지 않는 상류다(`seoulRtd.ts`). 그래도 길게 잡는 이유는 둘이다:
// 카메라의 자리와 스트림 주소는 거의 안 바뀌고(움직이는 값은 영상 자체이지
// 목록이 아니다), **캐시가 빗나갈 때마다 남의 서버에 요청이 두 번 나간다**
// (세션 부트스트랩 + 목록). 1시간이면 30곳 전체가 하루 720회인데, 그건 우리
// 쿼터가 아니라 상대 서버에 대한 예의 문제다.
const DEFAULT_CCTV_TTL_SECONDS = 60 * 60

export function cctvCacheTtlSeconds(): number {
  const raw = Number(process.env.CCTV_CACHE_TTL_SECONDS)
  // 정수만 받는 이유는 cacheTtlSeconds와 같다(RFC 9111 §1.2.2).
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_CCTV_TTL_SECONDS
}

// 명소 전체 혼잡도(SeoulRtd)용 TTL. **CCTV와 같은 상류인데 값이 정반대다** —
// 저기는 거의 안 바뀌는 목록이라 1시간이고, 여기는 **움직이는 값 그 자체**다.
//
// **5분인 근거는 상류의 실제 갱신 주기다.** 서울시 인구 데이터는 5분마다
// 갱신되고(공식 응답의 `PPLTN_TIME`이 5분 단위로 떨어진다), 2026-08-20에 이
// 엔드포인트를 1분 간격으로 재 봤더니 그 주기로 값이 바뀌었다. 더 짧게 잡으면
// 같은 값을 다시 받을 뿐이고, 더 길게 잡으면 우리만 묵은 값을 본다.
//
// **인증키를 안 쓰므로 하루 1,000회 한도와 무관하다.** 그래서 공식 API를 쓰던
// 시절의 1시간(쿼터를 아끼려고 고른 값)을 여기까지 끌고 올 이유가 없다 —
// 그 1시간은 우리 형편이었지 데이터의 성질이 아니었다.
//
// 5분이어도 상류 부하는 TTL당 한 번이다. 파라미터가 없어 CDN 캐시 키가 하나로
// 수렴하기 때문이다(`api/hotspots.ts`).
const DEFAULT_HOTSPOTS_TTL_SECONDS = 5 * 60

export function hotspotsCacheTtlSeconds(): number {
  const raw = Number(process.env.HOTSPOTS_CACHE_TTL_SECONDS)
  // 정수만 받는 이유는 cacheTtlSeconds와 같다(RFC 9111 §1.2.2).
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_HOTSPOTS_TTL_SECONDS
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
// 여기서 한 번 걸러 키 문자열을 치환해두면, 이 함수를 호출하는 곳(cityinfo.ts,
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

export async function fetchArea(
  areaName: string,
  service: SeoulService = 'citydata_ppltn',
): Promise<unknown> {
  const key = apiKey()
  const url = `${SEOUL_API_BASE}/${key}/json/${service}/1/5/` + encodeURIComponent(areaName)

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
