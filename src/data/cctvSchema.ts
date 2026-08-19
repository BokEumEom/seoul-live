import type { CctvCamera } from '../domain/cctv'
import { asRow, coordsOrNull, text } from './rowReaders'

// CCTV 목록 응답을 카메라 배열로 옮긴다. **도시정보(`cityInfoSchema.ts`)와 같은
// 방향으로 관대하다** — 던지지 않고 빈 배열로 떨어진다. 여기는 이유가 하나 더
// 있다: 상류가 문서화된 API가 아니라(`api/_lib/seoulRtd.ts`) 응답 모양이 언제
// 바뀌어도 이상하지 않다. 그때 예외를 던지면 상세 화면이 통째로 깨지는데,
// CCTV는 부가 정보라 「지금은 없다」가 맞는 답이다.

/**
 * `<video src>`에 넣어도 되는 주소만 통과시킨다.
 *
 * 프록시가 이미 걸렀지만(`toProxiedStreamUrl`) 여기서 한 번 더 본다 — 이 값이
 * DOM에 그대로 들어가는 마지막 문턱이고, 프록시와 클라이언트는 따로 배포된다.
 * 평문 HTTP를 막는 것은 보안이자 동작 조건이다: HTTPS 미니앱에서 mixed
 * content로 차단되므로 통과시켜 봐야 검은 화면만 뜬다.
 */
function playableStreamUrl(raw: string): string {
  return raw.startsWith('https://') ? raw : ''
}

export function parseCctvResponse(body: unknown): readonly CctvCamera[] {
  if (!Array.isArray(body)) {
    return []
  }

  const seen = new Set<string>()

  return body.flatMap((entry: unknown): readonly CctvCamera[] => {
    const row = asRow(entry)
    if (row === null) {
      return []
    }

    // 이름이 이 항목의 본체다(재난문자의 `message`와 같은 규칙). 이름 없는
    // 카메라는 목록에서도 지도에서도 무엇인지 알 수 없다.
    const name = text(row, 'CCTVNAME')
    if (name === '') {
      return []
    }

    // **스트림이 없어도 버리지 않는다.** 샘플(서울 인파레이더)이 「서울광장
    // 608m 영상 없음」처럼 목록에 남기고 못 튼다고 적는다 — 실응답에도 그런
    // 행이 실제로 온다(광화문·덕수궁의 서울광장). 조용히 빼면 「왜 이 자리
    // CCTV는 안 보이지」에 화면이 답하지 못한다.
    const streamUrl = playableStreamUrl(text(row, 'src'))

    // 같은 스트림이 두 번 실려 오면 같은 영상이 두 줄이 된다. 이름이 아니라
    // 스트림으로 세는 이유는 그것이 「무엇을 보는가」의 정체이기 때문이다.
    // **빈 스트림은 중복으로 세지 않는다** — 「영상 없음」이 여럿일 수 있고
    // (서로 다른 카메라다) 빈 문자열끼리 겹친다고 지우면 목록이 사라진다.
    if (streamUrl !== '') {
      if (seen.has(streamUrl)) {
        return []
      }
      seen.add(streamUrl)
    }

    return [
      {
        name,
        // **X가 경도, Y가 위도다.** 따릉이(`SBIKE_X`)와 같은 함정이라
        // 이름 순서대로 넘기면 뒤집힌다 — 가드는 `rowReaders.ts`에 있다.
        coords: coordsOrNull(row, 'YCOORD', 'XCOORD'),
        streamUrl,
      },
    ]
  })
}
