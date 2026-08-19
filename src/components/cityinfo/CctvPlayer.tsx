import { useEffect, useRef, useState } from 'react'
import { t } from '../../i18n/t'

// HLS(m3u8) 한 편을 재생한다.
//
// **iframe이 아니다.** 앱인토스는 iframe을 금지하는데(`AGENTS.md`), 서울시
// 실시간 도시데이터 웹은 자기 지도에서 플레이어를 iframe으로 감싼다. 그걸 보고
// 「iframe 금지라 CCTV는 범위 밖」이라 결론 냈던 적이 있는데 **플레이어와 그
// 포장을 혼동한 것이었다** — 안쪽은 hls.js + `<video>`이고, 우리는 포장을 안
// 쓰면 그만이다.
//
// **hls.js를 동적으로 불러온다.** 번들이 50KB(gzip) 늘어나는데, CCTV를 한 번도
// 안 여는 사용자가 대부분이다. 정적으로 import하면 지도 첫 화면이 그만큼 늦어진다.
//
// 사파리(iOS WKWebView)는 `<video>`가 HLS를 직접 재생하므로 hls.js가 필요 없다.
// 안드로이드 웹뷰는 못 하므로 필요하다 — **둘 중 하나만 지원하면 절반이 깨진다.**

type Status = 'loading' | 'playing' | 'failed'

interface Props {
  readonly name: string
  readonly streamUrl: string
}

export function CctvPlayer({ name, streamUrl }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    const video = videoRef.current
    if (video === null) {
      return
    }

    setStatus('loading')
    // 언마운트·주소 변경 뒤에 늦게 도착한 결과가 상태를 되돌리는 것을 막는다.
    let cancelled = false
    // hls.js 인스턴스는 정리해 줘야 백그라운드에서 세그먼트를 계속 받는다.
    let destroy: (() => void) | undefined

    // **`canPlayType`만 보면 안 된다.** 크롬은 HLS를 재생하지 못하면서도
    // `application/vnd.apple.mpegurl`에 `"maybe"`를 돌려준다 — 실제 크롬으로
    // 재 보고 알았다(`readyState 0`, `videoWidth 0`인 채로 멈춰 있었다).
    // 그 말을 믿으면 **hls.js가 필요한 바로 그 환경(안드로이드 웹뷰)에서만**
    // 검은 화면이 된다. 아이폰에서는 멀쩡해서 눈치채기도 어렵다.
    //
    // 갈림길은 MSE다. 아이폰 사파리에는 `MediaSource`가 없고 대신 `<video>`가
    // HLS를 직접 재생한다 — 그때만 네이티브가 유일한 길이고, 덤으로 hls.js를
    // 아예 안 받는다. 그 밖(크롬·안드로이드 웹뷰)은 MSE가 있으므로 hls.js가
    // 답이다.
    const hasMse = typeof MediaSource !== 'undefined'
    if (!hasMse && video.canPlayType('application/vnd.apple.mpegurl') !== '') {
      video.src = streamUrl
      return () => {
        video.removeAttribute('src')
        video.load()
      }
    }

    void (async () => {
      try {
        const { default: Hls } = await import('hls.js')
        if (cancelled) {
          return
        }
        if (!Hls.isSupported()) {
          // MSE는 있는데 hls.js가 못 쓰는 환경. 마지막으로 네이티브를 물어본다 —
          // 여기까지 왔다면 `canPlayType`의 대답을 믿는 것 말고 남은 수가 없다.
          if (video.canPlayType('application/vnd.apple.mpegurl') !== '') {
            video.src = streamUrl
            return
          }
          setStatus('failed')
          return
        }
        // **살아 있는 방송이라 기본값이 안 맞는다.** hls.js의 기본은 녹화물
        // 기준이라 앞으로 많이 받아 두고 지나간 것도 들고 있는데, CCTV는
        // (1) 앞이라고 해 봐야 몇 초뿐이고 (2) 지나간 화면은 볼 이유가 없다.
        // 시트 안에서 도는 영상이 메모리를 계속 물고 있으면 곤란하다.
        //
        // 값은 서울시 자신의 플레이어(`/SeoulRtd/cctv`)에서 가져왔다 — 같은
        // 스트림을 몇 년째 서비스하는 쪽이 고른 값이라 짐작보다 낫다.
        const hls = new Hls({
          maxBufferLength: 10,
          backBufferLength: 0,
          // 라이브 끝에 붙어 있게 한다. 안 그러면 「실시간」이 몇십 초 뒤진다.
          liveSyncDurationCount: 2,
          enableWorker: true,
          fragLoadingTimeOut: 15_000,
          fragLoadingMaxRetry: 2,
        })
        destroy = () => {
          hls.destroy()
        }
        hls.on(Hls.Events.ERROR, (_event, data) => {
          // 복구 가능한 오류까지 실패로 접으면 잠깐 끊긴 영상이 영영 안 돌아온다.
          if (data.fatal && !cancelled) {
            setStatus('failed')
          }
        })
        hls.loadSource(streamUrl)
        hls.attachMedia(video)
      } catch (error) {
        // 동적 import 자체가 실패하는 경우(오프라인, 청크 유실).
        console.error('[cctv] 플레이어를 불러오지 못했습니다:', error)
        if (!cancelled) {
          setStatus('failed')
        }
      }
    })()

    return () => {
      cancelled = true
      destroy?.()
    }
  }, [streamUrl])

  return (
    <div className="relative overflow-hidden rounded-card bg-surface-container-high">
      {/* 16:9는 원본 해상도(1280×720)의 비율이다. 비율을 안 잡으면 첫 프레임이
          도착할 때 목록이 통째로 밀린다. */}
      <video
        ref={videoRef}
        // 자동재생·음소거·인라인은 셋이 한 묶음이다. iOS는 `muted`와
        // `playsInline`이 없으면 자동재생을 거부하고 전체화면으로 띄운다.
        autoPlay
        muted
        playsInline
        // 교통 CCTV에는 소리가 없다. 컨트롤을 띄우면 눌러도 아무 일이 없는
        // 음량 버튼이 생긴다.
        controls={false}
        aria-label={t('{시설} 실시간 영상', { 시설: name })}
        onPlaying={() => setStatus('playing')}
        onError={() => setStatus('failed')}
        className="aspect-video w-full bg-black object-cover"
      />
      {status !== 'playing' && (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
          <p className="text-label-sm text-on-surface-variant">
            {/* **실패를 「점검중」이라 단정하지 않는다.** 원인이 상류 점검일 수도,
                이 기기의 네트워크일 수도, 우리 프록시일 수도 있는데 셋을 구분할
                방법이 없다 — 모르면 모른다고 하는 규칙(`freshness`)과 같다. */}
            {status === 'loading' ? t('영상을 불러오는 중이에요') : t('지금은 영상을 불러올 수 없어요')}
          </p>
        </div>
      )}
    </div>
  )
}
