import { t } from '../../../i18n/t'
import { AccidentList } from '../../cityinfo/AccidentList'
import { AlertBanner } from '../../cityinfo/AlertBanner'
import { InfoSection } from '../../cityinfo/InfoSection'
import { CityInfoBoundary } from '../CityInfoBoundary'

interface Props {
  readonly areaName: string
}

/**
 * 안전 탭 — 재난문자 · 사고 통제.
 *
 * **재난문자는 이 탭에만 있지 않다.** 발령되면 요약 탭 맨 위에도 같은 배너가
 * 뜬다(`SummaryPanel`) — 사용자가 찾아 읽는 값이 아니라 지금 당장 알아야 하는
 * 내용이라 탭 뒤에 숨기면 안 된다. 이 탭은 그 배너를 보고 **자세히 보러**
 * 오는 자리이고, 사고 통제까지 함께 놓아 「이 근처가 지금 안전한가」에 한
 * 화면으로 답한다.
 *
 * 시안(stitch_ui_ux/_9)의 「심각도 높음 / 주의 / 안내」 3단 배지는 안 그린다 —
 * 서울 API의 재난문자에는 등급 필드가 없고(`category`·`step`이 전부다) 사고
 * 통제에도 없다. 짐작해서 「심각도 높음」을 붙이면 앱이 하지 않은 판단을 한
 * 것으로 읽힌다.
 */
export function SafetyPanel({ areaName }: Props) {
  return (
    <CityInfoBoundary
      areaName={areaName}
      has={(info) => info.alerts.length > 0 || info.accidents.length > 0}
      empty={t('지금 이 근처에 전해진 사고·재난 소식이 없어요.')}
    >
      {(info) => (
        <div className="flex flex-col gap-3">
          <AlertBanner alerts={info.alerts} />

          {info.accidents.length > 0 && (
            <InfoSection
              title={t('사고·통제')}
              icon="warning"
              count={info.accidents.length}
            >
              <AccidentList accidents={info.accidents} />
            </InfoSection>
          )}
        </div>
      )}
    </CityInfoBoundary>
  )
}
