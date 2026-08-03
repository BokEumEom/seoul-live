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
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  headline-md-mobile:
    fontFamily: Hanken Grotesk
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

This design system utilizes **Hanken Grotesk** for its exceptional legibility and contemporary, neutral feel that mirrors the efficiency of modern infrastructure. 

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