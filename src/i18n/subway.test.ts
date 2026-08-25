import { afterEach, describe, expect, it } from 'vitest'
import { reset, setLanguage } from '../hooks/languageStore'
import { subwayArrivalText, subwayDirectionText, subwayLineText } from './subway'

describe('subwayLineText', () => {
  afterEach(() => {
    reset()
  })

  it('한국어에서는 원문 그대로다', () => {
    expect(subwayLineText('3호선')).toBe('3호선')
  })

  it('숫자 호선을 영어로 바꾼다', () => {
    setLanguage('en')
    expect(subwayLineText('3호선')).toBe('Line 3')
    expect(subwayLineText('1호선')).toBe('Line 1')
  })

  // **모르는 것은 건드리지 않는다.** 경의중앙선·신분당선·공항철도처럼 숫자가
  // 아닌 노선이 실제로 있고, 그 로마자 표기는 이 앱에 근거가 없다.
  it('숫자가 아닌 노선은 그대로 둔다', () => {
    setLanguage('en')
    expect(subwayLineText('경의중앙선')).toBe('경의중앙선')
    expect(subwayLineText('신분당선')).toBe('신분당선')
  })
})

describe('subwayDirectionText', () => {
  afterEach(() => {
    reset()
  })

  it('한국어에서는 원문 그대로다', () => {
    expect(subwayDirectionText('대화행')).toBe('대화행')
  })

  // **역 이름은 한국어로 남는다.** 서울 지하철 역명의 로마자 표기는 이 앱에
  // 없는 데이터라, 지어내느니 「To 대화」로 두는 편이 낫다 — 주차장·행사
  // 이름을 그대로 두는 것과 같은 규칙이다.
  it('「~행」을 영어 어순으로 바꾸고 역 이름은 남긴다', () => {
    setLanguage('en')
    expect(subwayDirectionText('대화행')).toBe('To 대화')
    expect(subwayDirectionText('청량리행')).toBe('To 청량리')
  })

  it('「행」으로 끝나지 않으면 그대로 둔다', () => {
    setLanguage('en')
    expect(subwayDirectionText('내선순환')).toBe('내선순환')
    expect(subwayDirectionText('')).toBe('')
  })

  // **「상행」은 「상역으로 간다」가 아니다.** `BOUND_FOR`에 맡기면 「To 상」이라는
  // 없는 말이 나온다 — 처음 짤 때 실제로 그렇게 만들었다.
  //
  // 행선지 규칙에서 빼는 것과 **번역하지 않는 것은 다른 결정**이다. 2026-08-25에
  // 뒤를 뒤집었다(근거는 `subway.ts`의 `NOT_A_DESTINATION`).
  it('방향어(상행·하행)를 행선지로 오해하지 않는다', () => {
    setLanguage('en')
    expect(subwayDirectionText('상행')).not.toContain('To ')
    expect(subwayDirectionText('하행')).not.toContain('To ')
  })

  // 방향어는 **고유명사가 아니라 갈래 이름**이라 옮긴다. 역 이름과 달리
  // 로마자 표기를 지어내는 일이 아니다.
  it('방향어를 영어로 바꾼다', () => {
    setLanguage('en')
    expect(subwayDirectionText('상행')).toBe('Upbound')
    expect(subwayDirectionText('하행')).toBe('Downbound')
  })

  it('한국어에서는 방향어도 원문 그대로다', () => {
    expect(subwayDirectionText('상행')).toBe('상행')
    expect(subwayDirectionText('하행')).toBe('하행')
  })
})

describe('subwayArrivalText', () => {
  afterEach(() => {
    reset()
  })

  it('한국어에서는 원문 그대로다', () => {
    expect(subwayArrivalText('9분 후 (동대입구)')).toBe('9분 후 (동대입구)')
    expect(subwayArrivalText('전역 출발')).toBe('전역 출발')
  })

  // 아래 다섯은 2026-08-13·08-18 실응답에서 본 것이다. 명세에 값 목록이 없어
  // **본 것만** 다룬다.
  it('실측한 문구를 영어로 바꾼다', () => {
    setLanguage('en')
    expect(subwayArrivalText('전역 출발')).toBe('Left prev. station')
    expect(subwayArrivalText('전역 도착')).toBe('At prev. station')
    expect(subwayArrivalText('9분 후 (동대입구)')).toBe('in 9 min (동대입구)')
    expect(subwayArrivalText('4분 30초 후 (무악재)')).toBe('in 4m 30s (무악재)')
    expect(subwayArrivalText('[24]번째 전역 (수원)')).toBe('24 stations away (수원)')
  })

  it('괄호가 없어도 바꾼다', () => {
    setLanguage('en')
    expect(subwayArrivalText('9분 후')).toBe('in 9 min')
    expect(subwayArrivalText('[3]번째 전역')).toBe('3 stations away')
  })

  // **이게 이 파일의 안전장치다.** 처음 보는 문구가 오면 손대지 않는다 —
  // 반쯤 맞는 자리를 잡아 틀린 영어를 만드느니 한국어가 낫다. 도메인이
  // 이 필드를 파싱하지 않기로 한 것과 같은 판단이다(`domain/cityInfo.ts`).
  it('처음 보는 문구는 그대로 둔다', () => {
    setLanguage('en')
    expect(subwayArrivalText('곧 도착')).toBe('곧 도착')
    expect(subwayArrivalText('출발 예정')).toBe('출발 예정')
    expect(subwayArrivalText('9분 뒤 도착 예정')).toBe('9분 뒤 도착 예정')
    expect(subwayArrivalText('')).toBe('')
  })

  // 부분일치로 잡으면 「전역 출발했습니다」가 「Left prev. station」이 된다.
  it('부분일치로 잡지 않는다', () => {
    setLanguage('en')
    expect(subwayArrivalText('전역 출발 지연')).toBe('전역 출발 지연')
  })
})
