import { describe, expect, it } from 'vitest'
import { elapsed, type Freshness } from './freshness'

const RECEIVED_AT = 1_760_000_000_000
const at = (ageSeconds: number): Freshness => ({ ageSeconds, receivedAt: RECEIVED_AT })
/** 받은 뒤 이만큼 지난 「지금」. */
const after = (seconds: number): number => RECEIVED_AT + seconds * 1_000

describe('elapsed', () => {
  it('막 받은 값은 「방금」이다', () => {
    expect(elapsed(at(0), after(0))).toEqual({ unit: 'now' })
  })

  it('1분이 안 되면 「방금」이다', () => {
    // 초 단위까지 적으면 값이 계속 흔들리는데, 이 절의 숫자는 그만큼 자주
    // 바뀌지 않는다. 「59초 전」과 「방금」이 사용자에게 주는 정보가 같다.
    expect(elapsed(at(59), after(0))).toEqual({ unit: 'now' })
  })

  it('분 단위로 내림한다', () => {
    expect(elapsed(at(60), after(0))).toEqual({ unit: 'minutes', value: 1 })
    expect(elapsed(at(119), after(0))).toEqual({ unit: 'minutes', value: 1 })
  })

  // **CDN에 머문 시간만으로는 부족하다.** 도시정보의 `staleTime`이 30분이라
  // 받아 둔 응답이 클라이언트 캐시에 그만큼 더 앉아 있을 수 있다. 그 몫을
  // 안 더하면 42분 묵은 값에 「12분 전」이라 적는다 — 고치려던 반쪽 거짓말을
  // 크기만 줄여 되풀이하는 셈이다.
  it('받은 뒤 흐른 시간을 함께 센다', () => {
    expect(elapsed(at(12 * 60), after(30 * 60))).toEqual({ unit: 'minutes', value: 42 })
  })

  it('한 시간이 넘으면 시간 단위로 내림한다', () => {
    expect(elapsed(at(3_600), after(0))).toEqual({ unit: 'hours', value: 1 })
    expect(elapsed(at(3 * 3_600 - 1), after(0))).toEqual({ unit: 'hours', value: 2 })
  })

  it('모르면 모른다고 한다', () => {
    // **여기가 이 모듈의 존재 이유다.** `Age` 헤더가 안 보이는 상황이 실재한다
    // (프록시에 `Access-Control-Expose-Headers`가 아직 안 배포됐거나, CDN을
    // 안 거친 응답이거나). 그때 0으로 떨어뜨려 「방금」이라 적으면 최대 1시간
    // 묵은 값이 갓 받은 값으로 둔갑한다 — **지금보다 나빠진다.**
    expect(elapsed(null, after(0))).toEqual({ unit: 'unknown' })
  })

  // 기기 시계가 뒤로 가거나 CDN 시각과 어긋나면 「받은 뒤 흐른 시간」이 음수가 된다.
  //
  // **`ageSeconds`를 0으로 두고 시험하면 이 방어를 못 잡는다.** 음수를 그대로
  // 더해도 합이 여전히 1분 미만이라 어느 쪽이든 「방금」이 나온다 — 돌연변이가
  // 살아남아서 알았다. 나이가 있는 채로 시계가 뒤로 가야 차이가 드러난다.
  it('시계가 뒤로 가도 CDN이 준 나이를 깎지 않는다', () => {
    expect(elapsed(at(3_600), after(-1_800))).toEqual({ unit: 'hours', value: 1 })
  })
})
