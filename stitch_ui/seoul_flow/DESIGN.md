---
name: Seoul Flow
colors:
  surface: '#faf8ff'
  surface-dim: '#d9d9e5'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3fe'
  surface-container: '#ededf9'
  surface-container-high: '#e7e7f3'
  surface-container-highest: '#e1e2ed'
  on-surface: '#191b23'
  on-surface-variant: '#434655'
  inverse-surface: '#2e3039'
  inverse-on-surface: '#f0f0fb'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#545f73'
  on-secondary: '#ffffff'
  secondary-container: '#d5e0f8'
  on-secondary-container: '#586377'
  tertiary: '#943700'
  on-tertiary: '#ffffff'
  tertiary-container: '#bc4800'
  on-tertiary-container: '#ffede6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#d8e3fb'
  secondary-fixed-dim: '#bcc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#ffdbcd'
  tertiary-fixed-dim: '#ffb596'
  on-tertiary-fixed: '#360f00'
  on-tertiary-fixed-variant: '#7d2d00'
  background: '#faf8ff'
  on-background: '#191b23'
  surface-variant: '#e1e2ed'
typography:
  display-lg:
    fontFamily: "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  headline-md-mobile:
    fontFamily: "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 16px
  stack-gap: 12px
  card-padding: 16px
  gutter: 12px
---

## Brand & Style

The design system is built for a high-utility urban utility application focused on real-time crowd density. The brand personality is **trustworthy, civic-minded, and highly efficient**, serving as a reliable companion for navigating Seoul's dense urban environment. 

The aesthetic blends **Modern Corporate** reliability with **Minimalist** clarity. It prioritizes information density without visual clutter, using a card-based architecture to encapsulate live data points. The emotional response should be one of "situational awareness"—reducing the anxiety of commuting through transparency and data-driven predictability.

## Colors

The palette is anchored by a "Seoul City Blue" (Primary), conveying institutional trust and technological precision. 

The semantic color system is the most critical element of this design system:
- **Success (Relaxed):** Used for low-density areas. Represents safety and open space.
- **Warning (Normal):** Used for moderate activity. Represents standard urban flow.
- **Danger (Crowded):** Used for high-density alerts. Requires immediate visual attention.

The background uses a very light cool gray to differentiate cards and surfaces from the base canvas, ensuring maximum legibility under varying outdoor lighting conditions.

## Typography

이 시스템은 **웹폰트를 쓰지 않고 플랫폼 기본 서체 스택**을 쓴다. 원안은 Hanken Grotesk였고 "exceptional legibility and contemporary, neutral feel"이 선정 이유였는데, **그 폰트에는 한글 글리프가 없다.** 화면 글자의 대부분이 한글인 앱에서 그 선택은 성립하지 않는다 — 실제로는 229KB(woff2 4종)를 받아 숫자와 라틴 몇 글자에만 쓰고, 한 줄 안에서 서체가 갈렸다(「추정 인구 88,000~90,000명」).

- **스택:** `system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif`. iOS는 San Francisco + Apple SD Gothic Neo, 안드로이드는 Roboto + Noto Sans KR로 떨어진다. 한 패밀리는 아니지만 **같은 제조사가 짝지어 설계한 조합이라 메트릭이 맞는다.**
- **`system-ui`가 먼저인 이유:** 이 앱의 핵심 정보가 큰 숫자(혼잡도 헤드라인, 추정 인구)라 자형이 가장 다듬어진 플랫폼 기본 서체로 그린다. 한글 얼굴을 앞에 두면 진짜 한 패밀리가 되는 대신 숫자가 나빠진다.
- **Pretendard를 얹지 않은 이유:** 동적 서브셋이 조각당 평균 35KB라 200~700KB이고, 미리 서브셋을 뜨는 길은 막혀 있다 — `snapshot.message`와 재난문자가 서울 API에서 오는 **임의의 한글**이라 글리프를 예측할 수 없다. 빠진 음절이 문장 중간에서 조용히 폴백된다.
- **Weight Strategy:** Use Bold/700 for key density metrics and location names. Use Medium/500 for secondary labels.
- **Scale:** The type scale is slightly larger than standard utility apps to ensure readability while walking.
- **Accessibility:** Ensure a minimum contrast ratio of 4.5:1 for all body text against card backgrounds.

## Layout & Spacing

The layout follows a **Fluid Grid** model optimized for mobile devices. It utilizes a 4px baseline grid to ensure all elements align harmoniously.

- **Margins:** A standard 16px lateral margin is maintained across all screens.
- **Card-Based Architecture:** Information is grouped into cards. Cards should have a vertical stack gap of 12px to maintain a clear visual rhythm.
- **Touch Targets:** All interactive elements (filters, search bars, buttons) must maintain a minimum height of 48px to accommodate one-handed mobile use.

## Elevation & Depth

To maintain the "Modern" and "Clean" aesthetic, this design system uses **Tonal Layers** supplemented by extremely soft, ambient shadows.

- **Level 0 (Canvas):** The background color (#F8FAFC).
- **Level 1 (Default Cards):** Pure white (#FFFFFF) with a 1px subtle stroke (#E2E8F0). This is used for standard information units.
- **Level 2 (Active/Floating):** White background with a 12% opacity shadow, 8px blur, and 4px vertical offset. Used for the bottom navigation bar and floating action buttons (FAB) like "Recenter Map".
- **Glassmorphism:** Use a light backdrop blur (12px) for top navigation headers to allow the map content to peek through, reinforcing the sense of "Real-time" transparency.

## Shapes

The shape language is **Rounded**, striking a balance between professional geometry and friendly accessibility. 

- **Cards & Input Fields:** 0.5rem (8px) corner radius.
- **Large Action Buttons:** 1rem (16px) corner radius or fully pill-shaped for high-priority actions.
- **Status Indicators:** Density indicators (dots/pills) should be fully rounded to appear organic and non-threatening.

## Components

### Buttons
- **Primary:** Seoul Blue background with white text. High prominence for "View Details" or "Directions".
- **Ghost:** Seoul Blue 1px border with transparent background for secondary map filters.

### Chips (Density Indicators)
- Small, rounded labels that combine a color-coded dot (Success/Warning/Danger) with text (여유/보통/붐빔). These are used inside cards and as map markers.

### Input Fields
- Search bars should be full-width with a subtle 1px border and a leading "search" icon. Use "soft" roundedness (8px).

### Cards
- The primary container for location data. Must include:
  - Location Name (Headline-sm)
  - Density Status (Chip)
  - "Last Updated" timestamp (Label-sm) to emphasize "Real-time" transparency.

### Map Markers
- Custom markers that change color based on density. When tapped, they should expand slightly or show a mini-card overlay.

### Lists
- Use for "Nearby Locations" or "Favorites". Each list item should have a clear divider with a 4px vertical padding between items.