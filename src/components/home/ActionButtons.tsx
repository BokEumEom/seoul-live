import { areaDisplayName } from '../../i18n/areaName'
import { t } from '../../i18n/t'
import { useState } from 'react'
import type { AreaCatalogEntry } from '../../domain/types'
import { shareUrl } from '../../platform/appUrl'
import { shareMessage } from '../../platform/links'
import { Icon } from '../common/Icon'

interface Props {
  readonly entry: AreaCatalogEntry
  /** 저장 버튼이 눌린 상태인가. 즐겨찾기라는 사실은 부르는 쪽에만 있다 —
   *  여기서는 토글 버튼의 눌림 여부일 뿐이다. */
  readonly saved: boolean
  readonly onSave: () => void
}

// 저장·공유 두 버튼의 기하는 함께 움직인다. 색만 갈라 두어 높이나 반경을
// 고칠 때 한쪽만 고치는 일이 없게 한다(PopulationCard의 CHIP_BASE와 같은 이유).
// 길찾기 셋도 같은 값을 쓰지만 그쪽은 화면 맨 아래로 내려갔다(`MapLinkButtons`).
const ACTION_BASE =
  'flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-action text-label-md font-semibold'

export function ActionButtons({ entry, saved, onSave }: Props) {
  // 라벨이 「저장」→「저장됨」으로 바뀌어도 포커스가 머문 요소의 이름 변경은
  // iOS VoiceOver도 안드로이드 TalkBack도 다시 읽지 않는다. aria-pressed를
  // 쓰지 않기로 했으므로(같은 상태를 두 번 읽는다) 이 리전이 유일한 확인 수단이다.
  //
  // starred에서 파생하지 않고 클릭 때 채운다 — 파생하면 이미 저장한 곳을 열
  // 때 리전이 내용을 가진 채로 삽입돼 일부 스크린리더가 그대로 낭독한다.
  const [saveNotice, setSaveNotice] = useState('')

  // href를 실제로 채운 <a>로 둔다. 브리지가 없을 때 열 주소가 여기 남아 있어야
  // 폴백이 성립하고, 스크린리더도 링크로 읽는다. 실제 열기는 openExternalUrl이
  // 맡으므로 기본 동작은 막는다 — 웹뷰에서 두 번 열리는 걸 방지한다.
  return (
    <div className="flex flex-col gap-3 px-4">
      <div className="flex gap-3">
        {/* Google Maps의 Save 자리. 공유와 한 줄이라 행이 늘지 않는다. */}
        <button
          type="button"
          onClick={() => {
            setSaveNotice(
              t('{명소} {동작}', {
                명소: areaDisplayName(entry),
                동작: saved ? t('저장 해제') : t('저장됨'),
              }),
            )
            onSave()
          }}
          className={`${ACTION_BASE} border text-primary ${
            saved
              ? 'border-secondary-container bg-secondary-container'
              : 'border-outline-variant bg-surface-container-lowest'
          }`}
        >
          <Icon name={saved ? 'starFilled' : 'star'} className="size-5" />
          {saved ? t('저장됨') : t('저장')}
        </button>
        <button
          type="button"
          onClick={() => {
            // 지도 앱 링크(위 `href`)는 `entry.name`을 그대로 쓴다 — 그건
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
          className={`${ACTION_BASE} border border-outline-variant bg-surface-container-lowest text-on-surface`}
        >
          <Icon name="share" className="size-5" />
          {t('공유하기')}
        </button>
      </div>
      {/* 320px에서 「친구에게 공유하기」는 배정 폭 138px에 필요 폭 145px이라
          마지막 음절이 둘째 줄로 넘어갔다. 「공유하기」는 89px로 280px까지 한 줄이다. */}
      <span role="status" aria-live="polite" className="sr-only">
        {saveNotice}
      </span>
    </div>
  )
}
