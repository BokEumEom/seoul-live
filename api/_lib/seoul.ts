const SEOUL_API_BASE = 'http://openapi.seoul.go.kr:8088'
const FETCH_TIMEOUT_MS = 8_000

// 우리가 쓰는 두 서비스. `citydata`는 인구·주차장·따릉이·날씨·문화행사·재난문자를
// 한 번에 주고, `citydata_ppltn`은 그중 인구만 준다. 명소당 호출 1회는 어느 쪽이든
// 같지만 응답 크기가 크게 달라, 인구만 필요한 목록 화면은 계속 좁은 쪽을 쓴다.
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

// 도시정보(citydata)용 TTL을 혼잡도와 따로 둔다. 두 서비스가 같은 하루 1,000회
// 한도를 나눠 쓰기 때문이다.
//
//   혼잡도    30곳 ÷ TTL 1시간 = 720회/일 (고정)
//   도시정보  본 명소 수 ÷ TTL. 상세를 열면 자동으로 조회되므로 최악은 30곳이다.
//
// **예전에는 이 값이 없으면 혼잡도와 같은 TTL로 떨어졌다.** 그때는 도시정보가
// 접힌 채로 시작해서 사용자가 「더보기」를 눌러야만 나갔기 때문에 최악을
// 상정할 필요가 적었다. 지금은 상세를 열면 자동으로 나가므로 혼잡도의 1시간을
// 따라가면 720회가 되고, 혼잡도의 720회와 합쳐 1,440회로 한도를 넘는다.
//
//   3시간 → 30곳 × 8 = 240회/일. 합계 960회로 한도 안이다.
//
// 대신 주차 여유 면수와 지하철 도착이 그만큼 묵는다 — 그래서 그 두 절은
// 화면에 관측 시각을 같이 적는다. 활용갤러리에 등록해 한도가 풀리면 이
// 손잡이는 의미가 없어지고 1시간으로 되돌리면 된다.
const DEFAULT_CITYINFO_TTL_SECONDS = 3 * 60 * 60

export function cityInfoCacheTtlSeconds(): number {
  const raw = Number(process.env.CITYINFO_CACHE_TTL_SECONDS)
  // 정수만 받는 이유는 cacheTtlSeconds와 같다(RFC 9111 §1.2.2).
  if (Number.isInteger(raw) && raw > 0) {
    return raw
  }
  // 혼잡도보다 짧게 캐시하지 않는다. 도시정보는 같은 한도를 쓰면서 더 느리게
  // 변하므로(날씨는 정시, 문화행사는 하루 단위) 더 자주 받을 이유가 없다.
  return Math.max(DEFAULT_CITYINFO_TTL_SECONDS, cacheTtlSeconds())
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
