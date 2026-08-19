import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchCctvRows, toProxiedStreamUrl } from './seoulRtd.js'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

/** 세션 부트스트랩 → 목록 조회 순으로 두 번 응답하는 fetch를 만든다. */
function stubTwoStepFetch(rows: unknown, options?: { readonly cookie?: string }) {
  const cookie = options?.cookie ?? 'JSESSIONID=ABC123; Path=/SeoulRtd; HttpOnly'
  const spy = vi
    .fn()
    // 1) /SeoulRtd/map — 쿠키를 받아오는 요청
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'set-cookie': cookie }),
      text: async () => '<html></html>',
    })
    // 2) /SeoulRtd/api/cctv — 실제 목록
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => rows,
    })
  vi.stubGlobal('fetch', spy)
  return spy
}

describe('toProxiedStreamUrl', () => {
  // 이 함수가 이 기능 전체를 떠받친다. 원본 스트림은 평문 HTTP만 열려 있어
  // (https는 연결 자체가 안 된다) HTTPS 미니앱에서 mixed content로 차단된다.
  it('평문 HTTP 스트림을 서울시 HTTPS 프록시 주소로 바꾼다', () => {
    const url = toProxiedStreamUrl('http://210.179.218.51:1935/live/62.stream/playlist.m3u8')

    expect(url).toBe(
      'https://data.seoul.go.kr/SeoulRtd/cctv/proxy?src=' +
        encodeURIComponent('http://210.179.218.51:1935/live/62.stream/playlist.m3u8'),
    )
  })

  // 인코딩을 빼먹으면 원본 URL의 `:`·`/`가 그대로 쿼리에 섞여 서버가 잘라 읽는다.
  it('원본 주소를 쿼리 값으로 인코딩한다', () => {
    const url = toProxiedStreamUrl('http://host/a b?x=1&y=2')

    expect(url).toContain('src=http%3A%2F%2Fhost%2Fa%20b%3Fx%3D1%26y%3D2')
    // 인코딩됐다면 원본의 구분자가 쿼리 문자열에 날것으로 남지 않는다.
    expect(url.split('?src=')[1]).not.toContain('&y=2')
  })

  // 빈 값은 실응답에 실제로 섞여 온다(위치만 있고 스트림이 없는 카메라).
  // 프록시 주소로 감싸면 「재생할 수 있다」는 거짓 신호가 되어 검은 화면이 뜬다.
  it('빈 문자열은 빈 문자열로 둔다', () => {
    expect(toProxiedStreamUrl('')).toBe('')
    expect(toProxiedStreamUrl('   ')).toBe('')
  })

  // 이미 HTTPS면 감쌀 이유가 없다. 상류가 언젠가 HTTPS를 열면 프록시를
  // 한 단계 덜 타는 편이 낫다.
  it('이미 HTTPS인 주소는 그대로 둔다', () => {
    const https = 'https://example.com/live/playlist.m3u8'
    expect(toProxiedStreamUrl(https)).toBe(https)
  })

  // `javascript:` 같은 스킴이 화면의 <video src>에 그대로 들어가는 것을 막는다.
  // 상류가 우리 것이 아니므로 값의 종류를 단정할 수 없다.
  it('http/https가 아닌 스킴은 버린다', () => {
    expect(toProxiedStreamUrl('javascript:alert(1)')).toBe('')
    expect(toProxiedStreamUrl('//evil.example/x.m3u8')).toBe('')
  })
})

describe('fetchCctvRows', () => {
  it('세션을 먼저 받아 온 뒤 목록을 조회한다', async () => {
    const spy = stubTwoStepFetch([])

    await fetchCctvRows('경복궁')

    expect(spy).toHaveBeenCalledTimes(2)
    const [bootstrapUrl] = spy.mock.calls[0] as [string]
    const [listUrl] = spy.mock.calls[1] as [string]
    expect(bootstrapUrl).toContain('/SeoulRtd/map')
    expect(listUrl).toContain('/SeoulRtd/api/cctv')
  })

  // **부트스트랩 URL에 hotspotNm이 없으면 세션이 명소에 묶이지 않아 목록이 302를
  // 준다.** 쿠키는 멀쩡히 받아 오기 때문에 「쿠키가 있으니 됐다」고 착각하기 쉽다 —
  // 조사할 때 실제로 여기서 한 번 헤맸다.
  it('부트스트랩 URL에도 명소 이름을 싣는다', async () => {
    const spy = stubTwoStepFetch([])

    await fetchCctvRows('광화문·덕수궁')

    const [bootstrapUrl] = spy.mock.calls[0] as [string]
    expect(bootstrapUrl).toContain(`hotspotNm=${encodeURIComponent('광화문·덕수궁')}`)
  })

  it('받은 JSESSIONID를 목록 요청의 쿠키로 보낸다', async () => {
    const spy = stubTwoStepFetch([])

    await fetchCctvRows('경복궁')

    const [, init] = spy.mock.calls[1] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers.Cookie).toContain('JSESSIONID=ABC123')
    // 부수 속성(Path·HttpOnly)까지 그대로 보내면 서버가 쿠키 이름으로 읽는다.
    expect(headers.Cookie).not.toContain('HttpOnly')
  })

  it('Referer와 X-Requested-With를 함께 보낸다', async () => {
    const spy = stubTwoStepFetch([])

    await fetchCctvRows('경복궁')

    const [, init] = spy.mock.calls[1] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers.Referer).toContain('/SeoulRtd/')
    expect(headers['X-Requested-With']).toBe('XMLHttpRequest')
  })

  it('행의 src를 HTTPS 프록시 주소로 바꿔 돌려준다', async () => {
    stubTwoStepFetch([
      {
        src: 'http://210.179.218.51:1935/live/63.stream/playlist.m3u8',
        STRMID: 'L010020',
        XCOORD: '126.972',
        YCOORD: '37.576',
        CCTVNAME: '경복궁역',
      },
    ])

    const rows = await fetchCctvRows('경복궁')

    expect(rows).toHaveLength(1)
    const row = rows[0] as Record<string, unknown>
    expect(row.src).toContain('https://data.seoul.go.kr/SeoulRtd/cctv/proxy')
    // 나머지 필드는 손대지 않는다 — 파싱은 클라이언트의 관대한 리더가 맡는다.
    expect(row.CCTVNAME).toBe('경복궁역')
    expect(row.XCOORD).toBe('126.972')
  })

  // 상류가 302를 주면 본문은 HTML이다. 그대로 json()을 부르면 SyntaxError가
  // 나면서 원인이 「JSON 파싱 실패」로 둔갑해 진단이 어려워진다.
  it('목록이 302면 던진다', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'set-cookie': 'JSESSIONID=X' }),
          text: async () => '',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 302,
          headers: new Headers(),
          json: async () => ({}),
        }),
    )

    await expect(fetchCctvRows('경복궁')).rejects.toThrow(/302/)
  })

  // 리다이렉트를 자동으로 따라가면 302가 200 + HTML로 둔갑해 위 방어가 무력해진다.
  it('리다이렉트를 따라가지 않는다', async () => {
    const spy = stubTwoStepFetch([])

    await fetchCctvRows('경복궁')

    const [, listInit] = spy.mock.calls[1] as [string, RequestInit]
    expect(listInit.redirect).toBe('manual')
  })

  // 배열이 아닌 응답(오류 객체 등)을 그대로 흘리면 클라이언트가 map을 부르다 죽는다.
  it('배열이 아니면 빈 배열로 접는다', async () => {
    stubTwoStepFetch({ error: 'nope' })

    await expect(fetchCctvRows('경복궁')).resolves.toEqual([])
  })

  // **이 경로는 서울 OpenAPI가 아니다.** 인증키를 쓰지 않으므로 하루 1,000회
  // 한도를 나눠 쓰지 않는다 — 그 사실을 테스트로 못박는다.
  it('서울 OpenAPI 인증키를 쓰지 않는다', async () => {
    vi.stubEnv('SEOUL_API_KEY', 'secret-key-123')
    const spy = stubTwoStepFetch([])

    await fetchCctvRows('경복궁')

    const everything = JSON.stringify(spy.mock.calls)
    expect(everything).not.toContain('secret-key-123')
    expect(everything).not.toContain('openapi.seoul.go.kr')
  })
})
