import { areaDisplayName } from '../../i18n/areaName'
import { t } from '../../i18n/t'
import { useState } from 'react'
import type { AreaCatalogEntry } from '../../domain/types'
import { instagramTagUrl } from '../../domain/socialLinks'
import { shareUrl } from '../../platform/appUrl'
import { openExternalUrl, shareMessage } from '../../platform/links'
import { Icon } from '../common/Icon'

interface Props {
  readonly entry: AreaCatalogEntry
  /** 저장 버튼이 눌린 상태인가. 즐겨찾기라는 사실은 부르는 쪽에만 있다 —
   *  여기서는 토글 버튼의 눌림 여부일 뿐이다. */
  readonly saved: boolean
  readonly onSave: () => void
}

// 즐겨찾기·인스타그램·공유. **제목 줄 오른쪽에 아이콘으로 선다**(`AreaHero`가
// 자리를 준다).
//
// 예전에는 「저장」·「공유하기」 두 개가 글자를 달고 폭을 반씩 나눠 갖는 한
// 줄이었다(설계 §2.6의 Google Maps 액션 행). 바꾼 근거는 샘플(서울
// 인파레이더)이다 — 그쪽은 셋 다 제목과 같은 줄에 아이콘으로 두고, 그렇게
// 해서 **48px짜리 행 하나와 그 위아래 여백 24px, 합계 72px을 아낀다.** 시트
// 안에서 세로는 가장 귀한 자원이고, 그만큼 예측 차트가 폴드 안으로 올라온다.
//
// **아이콘만 남아도 상태는 글자로 말한다.** 접근성 이름이 「저장」↔「저장됨」으로
// 바뀌고 `aria-pressed`는 여전히 안 쓴다 — 둘 다 쓰면 스크린리더가 같은 상태를
// 두 번 읽는다. 눈으로 보는 쪽은 별의 윤곽/채움이 그 자리를 한다.
//
// 「길찾기」 셋은 여기 없다. 맨 아래로 내려갔다(`MapLinkButtons`) — 저장은 다
// 읽기 전에도 하고 싶을 수 있지만 길찾기는 다 읽은 뒤에 하는 일이라서다.

// 셋의 기하가 함께 움직인다. 48px은 이 저장소가 아이콘뿐인 버튼에 쓰는
// 크기다(`ThemeToggle`과 같다) — 글자가 없으면 타깃을 줄일 이유가 더 없다.
// 테두리도 배경도 없다: 셋이 붙어 서는데 상자를 그리면 제목 옆이 버튼 띠가 된다.
const ICON_ACTION =
  'grid size-12 shrink-0 place-items-center rounded-full text-on-surface-variant'

export function ActionButtons({ entry, saved, onSave }: Props) {
  // 라벨이 「저장」→「저장됨」으로 바뀌어도 포커스가 머문 요소의 이름 변경은
  // iOS VoiceOver도 안드로이드 TalkBack도 다시 읽지 않는다. aria-pressed를
  // 쓰지 않기로 했으므로(같은 상태를 두 번 읽는다) 이 리전이 유일한 확인 수단이다.
  //
  // starred에서 파생하지 않고 클릭 때 채운다 — 파생하면 이미 저장한 곳을 열
  // 때 리전이 내용을 가진 채로 삽입돼 일부 스크린리더가 그대로 낭독한다.
  const [saveNotice, setSaveNotice] = useState('')

  // 태그로 옮길 수 없는 이름이면 빈 문자열이 온다 — 그때는 버튼을 안 그린다.
  // 근거는 `domain/socialLinks.ts`.
  const instagram = instagramTagUrl(entry.name)

  return (
    // 48px 타깃 안에서 글리프는 24px이라 양옆에 12px씩 빈 곳이 생긴다. 그대로
    // 두면 마지막 아이콘과 그 오른쪽 배지 사이가 12px 더 벌어져 배지만 떨어져
    // 보이고, 배지가 없는 동안(혼잡도 도착 전)에는 글리프가 본문 정렬선보다
    // 12px 안쪽에 서서 혼자 들여쓴 것처럼 보인다. `-mr-3`이 그 여백을 되돌린다.
    <div className="-mr-3 flex shrink-0 items-center">
      <button
        type="button"
        aria-label={saved ? t('저장됨') : t('저장')}
        onClick={() => {
          setSaveNotice(
            t('{명소} {동작}', {
              명소: areaDisplayName(entry),
              동작: saved ? t('저장 해제') : t('저장됨'),
            }),
          )
          onSave()
        }}
        className={`${ICON_ACTION} ${saved ? 'text-primary' : ''}`}
      >
        <Icon name={saved ? 'starFilled' : 'star'} className="size-6" />
      </button>

      {/* href를 실제로 채운 <a>로 둔다. 브리지가 없을 때 열 주소가 여기 남아
          있어야 폴백이 성립하고, 스크린리더도 링크로 읽는다. 실제 열기는
          openExternalUrl이 맡으므로 기본 동작은 막는다 — 웹뷰에서 두 번
          열리는 걸 방지한다(`MapLinkButtons`와 같은 규칙).

          **「인스타그램」이라고만 하지 않는다.** 아이콘뿐인 버튼의 이름은
          목적지가 아니라 무슨 일이 일어나는지를 말해야 한다 — 앱 밖으로
          나간다는 사실이 이름에 없으면 뒤로 못 돌아온다고 느낀다. */}
      {instagram !== '' && (
        <a
          href={instagram}
          target="_blank"
          rel="noreferrer"
          aria-label={t('인스타그램에서 사진 보기')}
          onClick={(event) => {
            event.preventDefault()
            void openExternalUrl(instagram)
          }}
          className={ICON_ACTION}
        >
          <Icon name="instagram" className="size-6" />
        </a>
      )}

      <button
        type="button"
        aria-label={t('공유하기')}
        onClick={() => {
          // 지도 앱 링크(`MapLinkButtons`)는 `entry.name`을 그대로 쓴다 — 그건
          // 검색어라 한국어여야 카카오맵이 찾는다. 사람이 읽는 이 문장만
          // 화면 언어를 따른다.
          //
          // **주소를 함께 보낸다.** 예전에는 문장만 나갔고, 받은 사람은
          // 앱을 열 수도 그 명소로 갈 수도 없었다 — 기능이 있는 것처럼
          // 보이는데 아무 데도 안 닿았다. 링크에는 언제나 `entry.name`이
          // 실린다(`areaDisplayName`이 아니다): 주소는 사람이 읽는 문장이
          // 아니라 **앱이 되읽는 키**라, 영어 화면에서 공유한 링크를 한국어
          // 화면에서 열어도 같은 명소여야 한다.
          const url = shareUrl({ kind: 'area', name: entry.name })
          void shareMessage(
            `${t('{명소} 실시간 혼잡도 - 서울 라이브', {
              명소: areaDisplayName(entry),
            })}\n${url}`,
          )
        }}
        className={ICON_ACTION}
      >
        <Icon name="share" className="size-6" />
      </button>

      <span role="status" aria-live="polite" className="sr-only">
        {saveNotice}
      </span>
    </div>
  )
}
