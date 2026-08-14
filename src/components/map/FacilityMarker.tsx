interface Props {
  readonly name: string
}

// 주차장·따릉이 줄의 아이콘을 눌렀을 때 지도에 찍히는 핀.
//
// **`CongestionMarker`와 모양을 나눠 둔다.** 그쪽은 혼잡도를 색으로 말하는
// 알약이라 색이 곧 값이다. 이 핀은 값이 아니라 자리를 가리키는 것이라 혼잡도
// 4색 중 어느 것을 써도 「이 주차장이 붐빈다」로 잘못 읽힌다. 그래서 팔레트의
// 강조색(파랑)을 쓴다 — 4색 어디에도 없어서 값과 헷갈리지 않는다.
//
// 이름을 함께 적는 이유: 명소 핀들이 이미 떠 있는 지도에 점 하나가 더 생기면
// 어느 것이 방금 누른 것인지 알 수 없다.
export function FacilityMarker({ name }: Props) {
  return (
    <div className="flex flex-col items-center">
      <span className="max-w-40 truncate rounded-full bg-primary px-2.5 py-1 text-label-sm font-semibold text-on-primary shadow-floating">
        {name}
      </span>
      {/* 알약 아래 꼬리. 알약만 있으면 정확히 어느 점을 가리키는지 모호하다. */}
      <span
        aria-hidden="true"
        className="size-2 -translate-y-1 rotate-45 rounded-xs bg-primary"
      />
    </div>
  )
}
