// 서울시 「실시간 도시데이터」 웹(SeoulRtd)이 자기 지도에서 쓰는 CCTV 엔드포인트를
// 중계한다. **서울 OpenAPI(openapi.seoul.go.kr:8088)가 아니다** — 인증키를 쓰지
// 않으므로 하루 1,000회 한도를 나눠 쓰지 않는다.
//
// **문서화된 API가 아니다.** 공식 OpenAPI 목록에 CCTV가 없고(명세 282행에 0회),
// 이것은 SeoulRtd의 프런트엔드(`js/api/cctv-api.js`)가 부르는 내부 경로다.
// 그래서 언제든 바뀌거나 막힐 수 있다 — 호출부는 **실패를 「CCTV 없음」으로
// 흡수**해야지 화면을 깨면 안 된다(`api/cctv.ts`가 그렇게 한다).
const SEOUL_RTD_BASE = 'https://data.seoul.go.kr/SeoulRtd'
const FETCH_TIMEOUT_MS = 8_000

/**
 * 재생할 수 있는 HTTPS 주소로 바꾼다. 못 바꾸면 빈 문자열이다.
 *
 * **이 함수가 기능 전체를 떠받친다.** 원본(UTIC 도시교통정보센터)은 평문 HTTP만
 * 열려 있고 https로는 연결 자체가 안 된다(실측: `HTTP 000`). 토스 미니앱은
 * HTTPS로 로드되므로 브라우저가 mixed content로 차단한다 — 서울 OpenAPI가 8088
 * 평문이라 프록시가 필요했던 것과 **같은 벽이고, 이번엔 서울시가 이미 뚫어 뒀다.**
 *
 * 빈 문자열을 감싸지 않는 이유는 실응답에 위치만 있고 스트림이 없는 카메라가
 * 섞여 오기 때문이다(반포한강공원). 감싸면 「재생할 수 있다」는 거짓 신호가 되어
 * 검은 화면이 뜬다.
 *
 * http/https가 아닌 값을 버리는 것은 상류가 우리 것이 아니라서다. 이 값은
 * 최종적으로 화면의 `<video src>`에 들어가므로 스킴을 확인하지 않으면
 * `javascript:` 같은 것이 그대로 실린다.
 */
export function toProxiedStreamUrl(raw: string): string {
  const src = raw.trim()
  if (src === '') {
    return ''
  }
  if (src.startsWith('https://')) {
    // 상류가 언젠가 HTTPS를 열면 프록시를 한 단계 덜 탄다.
    return src
  }
  if (!src.startsWith('http://')) {
    return ''
  }
  return `${SEOUL_RTD_BASE}/cctv/proxy?src=${encodeURIComponent(src)}`
}

/**
 * `Set-Cookie`에서 JSESSIONID 한 쌍만 뽑는다.
 *
 * `Path`·`HttpOnly` 같은 부수 속성을 함께 보내면 서버가 그것들을 쿠키 이름으로
 * 읽는다. 이름=값 하나만 필요하다.
 */
function sessionCookie(headers: Headers): string {
  // undici는 Set-Cookie가 여럿일 때 getSetCookie()로만 온전히 준다. get()은
  // 합쳐진 문자열이라 값 안의 쉼표와 구분되지 않는다 — 있으면 그쪽을 먼저 쓴다.
  const raw =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie().join('; ')
      : (headers.get('set-cookie') ?? '')
  const matched = raw.match(/JSESSIONID=([^;,\s]+)/)
  return matched === null ? '' : `JSESSIONID=${matched[1]}`
}

async function get(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    // **자동으로 따라가면 안 된다.** 세션이 안 잡히면 상류가 302로 HTML 페이지를
    // 주는데, 따라가면 200 + HTML이 되어 아래의 상태 코드 검사가 무력해지고
    // 실패가 「JSON 파싱 오류」로 둔갑한다.
    redirect: 'manual',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
}

/**
 * 한 명소의 CCTV 행을 받아 온다. `src`만 HTTPS 프록시 주소로 바꾸고 나머지
 * 필드는 손대지 않는다 — 파싱은 클라이언트의 관대한 리더(`cctvSchema.ts`)가
 * 맡는다(도시정보와 같은 경계).
 *
 * **요청이 두 번이다.** 목록 엔드포인트에 세션 게이트가 있어서, `hotspotNm`을
 * 실은 지도 페이지를 먼저 받아 JSESSIONID를 얻어야 한다. `hotspotNm` 없이
 * 부트스트랩하면 **쿠키는 멀쩡히 받아 오는데 목록은 302다** — 「쿠키가 있으니
 * 됐다」고 착각하기 딱 좋은 자리다.
 */
export async function fetchCctvRows(areaName: string): Promise<readonly unknown[]> {
  const encoded = encodeURIComponent(areaName)

  const bootstrap = await get(`${SEOUL_RTD_BASE}/map?hotspotNm=${encoded}`, {})
  const cookie = sessionCookie(bootstrap.headers)

  const listed = await get(`${SEOUL_RTD_BASE}/api/cctv?hotspotNm=${encoded}`, {
    headers: {
      Cookie: cookie,
      // 셋 다 있어야 통과한다. 하나라도 빼고 부르면 302를 받는다.
      Referer: `${SEOUL_RTD_BASE}/map`,
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json',
    },
  })

  if (!listed.ok) {
    throw new Error(`SeoulRtd CCTV responded ${listed.status}`)
  }

  const body: unknown = await listed.json()
  // 오류 객체가 200으로 오는 경우를 대비한다. 배열이 아닌 것을 그대로 흘리면
  // 클라이언트가 순회하다 죽는다.
  if (!Array.isArray(body)) {
    return []
  }

  return body.map((row: unknown) => {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      return row
    }
    const record = row as Record<string, unknown>
    const src = typeof record.src === 'string' ? record.src : ''
    return { ...record, src: toProxiedStreamUrl(src) }
  })
}
