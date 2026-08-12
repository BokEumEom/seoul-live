import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SkeletonList } from './SkeletonCard'

describe('SkeletonList', () => {
  // 예전에는 `role` 없는 `<div>`에 `aria-label="불러오는 중"`만 얹혀 있었다.
  // role 없는 div는 암묵 role이 `generic`이고 ARIA 1.2에서 generic은 이름을
  // 받을 수 없어("Name from author: prohibited") 브라우저가 그 라벨을 버린다 —
  // 즉 로딩 중이라는 사실이 소리 채널에 **아예 없었다.**
  //
  // 이 저장소는 같은 규칙을 이미 두 곳에 주석으로 적어 두고(`AreaListItem`의
  // 즐겨찾기 표시, `HomeScreen`의 포커스 상자) 여기만 놓쳤다.
  //
  // **jsdom은 name-prohibited를 모형화하지 않아** 「라벨이 버려진다」쪽은
  // 테스트로 못 잡는다. 잡을 수 있는 것은 이름을 받을 수 있는 role이 붙어
  // 있는가와, 읽을 글자가 실제로 있는가다.
  it('불러오는 중이라는 사실이 소리 채널에도 남는다', () => {
    render(<SkeletonList />)

    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중')
  })
})
