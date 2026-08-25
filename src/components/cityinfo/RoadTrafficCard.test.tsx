import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RoadTraffic } from '../../domain/cityInfo'
import { NEUTRAL_TONE_CLASS, TONE_CLASS } from '../common/toneClass'
import { RoadTrafficCard } from './RoadTrafficCard'

function traffic(overrides: Partial<RoadTraffic> = {}): RoadTraffic {
  return {
    index: '서행',
    speed: 18.4,
    message: '광화문 일대가 서행하고 있어요.',
    updatedAt: '2026-08-07 09:00',
    ...overrides,
  }
}

describe('RoadTrafficCard', () => {
  // **2026-08-21에 색이 붙었다**(`roadIndexTone`). 세 값을 한꺼번에 세는
  // 이유는 하나만 보면 톤 표를 통째로 지우고 그 하나만 남겨도 통과해서다.
  //
  // 톤 값을 여기 옮겨 적지 않고 `TONE_CLASS`에서 읽는다 — 옮겨 적으면
  // 색을 고칠 때 테스트도 함께 고치게 되어 아무것도 못 죽인다(`tokens.test.ts`가
  // 같은 이유로 `index.css`를 읽는다).
  it.each([
    ['원활', 'calm'],
    ['서행', 'busy'],
    ['정체', 'crowded'],
  ] as const)('%s는 %s 톤으로 그린다', (index, tone) => {
    render(<RoadTrafficCard traffic={traffic({ index })} />)
    expect(screen.getByText(index)).toHaveClass(TONE_CLASS[tone])
  })

  // **모르는 값에는 색이 안 붙는다.** 명세에 값 목록이 없다는 사실은 그대로라
  // (`seoul_realdata.md`), 색을 붙이기로 한 근거가 이 성질에 통째로 걸려
  // 있다 — 처음 보는 값에 **틀린 색**이 붙으면 안 되고, 안 붙는 것은 괜찮다.
  it('모르는 지표에는 톤을 붙이지 않는다', () => {
    render(<RoadTrafficCard traffic={traffic({ index: '일시정지' })} />)
    const badge = screen.getByText('일시정지')
    expect(badge).toHaveClass(NEUTRAL_TONE_CLASS)
    for (const tone of Object.values(TONE_CLASS)) {
      expect(badge).not.toHaveClass(tone)
    }
  })

  it('지표와 평균 속도를 보여준다', () => {
    render(<RoadTrafficCard traffic={traffic()} />)
    // **맨 값이다.** 접두어를 붙이던 시절의 이유(값 `원활`이 혼잡도 헤드라인과
    // 다퉜다)는 2026-08-20에 사라졌고, 지금은 절 이름이 「도로소통」이라
    // 붙이면 같은 말을 두 번 한다 — 근거는 `RoadTrafficCard`의 주석.
    expect(screen.getByText('서행')).toBeInTheDocument()
    expect(screen.getByText('18.4')).toBeInTheDocument()
    expect(screen.getByText(/km\/h/)).toBeInTheDocument()
  })

  // **속도가 지표보다 크다.** 지표는 세 낱말 중 하나라 알약이면 충분하고,
  // 속도는 연속값이라 크기가 곧 뜻이다 — 시안 `_4`의 배치이고, 뒤집히면
  // 카드가 예전 모양(「도로 서행」이 제목, 속도가 곁글씨)으로 돌아간다.
  it('속도를 지표보다 크게 적는다', () => {
    render(<RoadTrafficCard traffic={traffic()} />)

    expect(screen.getByText('18.4')).toHaveClass('text-display-lg')
  })

  // 지표 문자열의 종류를 모르므로 화면도 아는 척하지 않는다. 명세에 없는 값이
  // 와도 그대로 나와야 한다 — 아는 값만 그리면 처음 보는 값에서 지표가 사라진다.
  //
  // **사전에 없는 키는 `t()`가 그대로 돌려준다.** 그래서 번역을 붙인 뒤에도
  // 이 성질이 살아 있다 — 영어 화면에서는 한국어로 남지만 자리와 뜻은 지킨다.
  it('처음 보는 지표 문자열도 그대로 보여준다', () => {
    render(<RoadTrafficCard traffic={traffic({ index: '매우혼잡' })} />)
    expect(screen.getByText('매우혼잡')).toBeInTheDocument()
  })

  // 속도를 못 읽었을 때 0으로 떨어뜨리면 "0km/h"가 되어 완전 정체로 읽힌다.
  // 주차장의 「실시간 미제공」과 같은 자리다 — 모르는 것은 모른다고 적는다.
  it('속도를 못 읽으면 0이 아니라 아무것도 쓰지 않는다', () => {
    render(<RoadTrafficCard traffic={traffic({ speed: null })} />)
    expect(screen.queryByText(/km\/h/)).not.toBeInTheDocument()
    expect(screen.queryByText(/평균/)).not.toBeInTheDocument()
    expect(screen.getByText('서행')).toBeInTheDocument()
  })

  // 파서는 지표와 메시지 중 **하나만** 있어도 항목을 만든다. 지표가 빈 채로 오면
  // 제목 자리가 빈 줄로 남아 카드에 구멍이 생긴다.
  //
  // 속도를 남겨 바깥 가드를 통과시킨 채로 시험한다. 둘 다 비우면 줄 자체가
  // 안 그려져 **바깥 가드만 확인되고 지표 가드는 시험되지 않는다.**
  // **빈 배지는 글자가 없어서 글자로는 못 잡는다.** 가드를 지워도
  // `queryByText`로는 아무 일이 없어 보인다(2026-08-25 변이 실험에서 실제로
  // 살아남았다) — 화면에는 **글자 없는 회색 알약**이 카드 위쪽에 남는다.
  // 그래서 배지의 모양(톤 클래스)이 아예 없는지를 잰다.
  it('지표가 비어도 속도가 있으면 속도만 그린다', () => {
    const { container } = render(
      <RoadTrafficCard traffic={traffic({ index: '', speed: 24 })} />,
    )

    expect(screen.getByText('24')).toBeInTheDocument()
    expect(container.querySelector(`[class*="${NEUTRAL_TONE_CLASS.split(' ')[0]}"]`)).toBeNull()
    for (const tone of Object.values(TONE_CLASS)) {
      expect(container.querySelector(`[class*="${tone.split(' ')[0]}"]`)).toBeNull()
    }
  })

  it('지표도 속도도 없으면 그 줄을 통째로 만들지 않는다', () => {
    render(<RoadTrafficCard traffic={traffic({ index: '', speed: null })} />)
    expect(screen.getByText('광화문 일대가 서행하고 있어요.')).toBeInTheDocument()
    expect(screen.queryByText(/km\/h/)).not.toBeInTheDocument()
  })

  it('안내 문구가 비면 그 자리를 만들지 않는다', () => {
    const { container } = render(<RoadTrafficCard traffic={traffic({ message: '' })} />)
    expect(container.textContent).not.toContain('서행하고 있어요')
  })

  it('기준 시각이 비면 그리지 않는다', () => {
    render(<RoadTrafficCard traffic={traffic({ updatedAt: '' })} />)
    expect(screen.queryByText(/기준/)).not.toBeInTheDocument()
  })

  it('기준 시각이 있으면 그린다', () => {
    render(<RoadTrafficCard traffic={traffic()} />)
    expect(screen.getByText(/기준 2026-08-07 09:00/)).toBeInTheDocument()
  })
})
