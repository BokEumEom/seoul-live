import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { BikeStation } from '../../domain/cityInfo'
import { BikeList } from './BikeList'

function station(name: string, bikes: number | null, racks: number | null = 10): BikeStation {
  return { name, bikes, racks }
}

describe('BikeList', () => {
  // 주차장과 반대 방향이다 — 자전거는 남아 있어야 좋다. parkingTone을 그대로
  // 재사용했다면 자전거가 많이 남은 대여소가 "붐빔"으로 보였을 것이다.
  it('자전거가 없으면 대여 불가로, 모르면 정보 없음으로 쓴다', () => {
    render(<BikeList stations={[station('없음', 0), station('모름', null)]} />)

    expect(screen.getByText('대여 불가')).toBeInTheDocument()
    expect(screen.getByText('정보 없음')).toBeInTheDocument()
  })

  it('남은 대수를 대 단위로 쓴다', () => {
    render(<BikeList stations={[station('있음', 7)]} />)

    expect(screen.getByText('7대')).toBeInTheDocument()
  })

  it('거치대 수를 함께 쓴다', () => {
    render(<BikeList stations={[station('있음', 7, 15)]} />)

    expect(screen.getByText('거치대 15대')).toBeInTheDocument()
  })

  it('거치대 수를 모르면 그 줄을 만들지 않는다', () => {
    render(<BikeList stations={[station('있음', 7, null)]} />)

    expect(screen.queryByText(/거치대/)).not.toBeInTheDocument()
  })

  it('남은 대수가 많은 순으로 다섯 곳만 보여준다', () => {
    const stations = Array.from({ length: 8 }, (_, index) =>
      station(`대여소${index}`, index),
    )

    render(<BikeList stations={stations} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByText('대여소7')).toBeInTheDocument()
    expect(screen.queryByText('대여소2')).not.toBeInTheDocument()
    expect(screen.getByText('외 3곳')).toBeInTheDocument()
  })
})
