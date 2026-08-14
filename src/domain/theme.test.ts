import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, parseThemeSetting, resolveTheme } from './theme'

describe('DEFAULT_THEME', () => {
  it('밝게가 기본이다', () => {
    // **이 한 줄이 이 파일의 존재 이유다.** 예전에는 `prefers-color-scheme`만
    // 보고 기기 설정을 그대로 따랐는데, 그러면 폰이 어두운 사용자에게 다크가
    // 기본이 된다. 하려던 것은 다크 모드를 **지원**하는 것이지 기본으로
    // 삼는 것이 아니다.
    expect(DEFAULT_THEME).toBe('light')
  })
})

describe('resolveTheme', () => {
  it('밝게를 고르면 기기가 어두워도 밝다', () => {
    // 사용자가 명시적으로 정한 것을 기기 설정이 뒤집으면 고른 의미가 없다.
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('light', false)).toBe('light')
  })

  it('어둡게를 고르면 기기가 밝아도 어둡다', () => {
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('dark', true)).toBe('dark')
  })

  it('시스템을 고를 때만 기기를 본다', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})

describe('parseThemeSetting', () => {
  it('아는 값은 그대로 쓴다', () => {
    expect(parseThemeSetting('dark')).toBe('dark')
    expect(parseThemeSetting('system')).toBe('system')
    expect(parseThemeSetting('light')).toBe('light')
  })

  it('모르는 값은 기본으로 떨어진다', () => {
    // 저장소에 무엇이 들어 있을지는 우리가 정하지 못한다 — 옛 버전이 쓴 값,
    // 손으로 고친 값, 깨진 값이 온다. 화면이 안 뜨는 것보다 밝게가 낫다.
    expect(parseThemeSetting('sepia')).toBe('light')
    expect(parseThemeSetting(null)).toBe('light')
    expect(parseThemeSetting(undefined)).toBe('light')
    expect(parseThemeSetting(3)).toBe('light')
  })
})
