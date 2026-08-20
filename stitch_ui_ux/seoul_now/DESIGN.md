---
name: Seoul Now
colors:
  surface: '#f9f9ff'
  surface-dim: '#d8d9e3'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3fd'
  surface-container: '#ecedf7'
  surface-container-high: '#e6e8f2'
  surface-container-highest: '#e0e2ec'
  on-surface: '#191c23'
  on-surface-variant: '#414754'
  inverse-surface: '#2d3038'
  inverse-on-surface: '#eff0fa'
  outline: '#727785'
  outline-variant: '#c1c6d6'
  surface-tint: '#005bc0'
  primary: '#005bbf'
  on-primary: '#ffffff'
  primary-container: '#1a73e8'
  on-primary-container: '#ffffff'
  inverse-primary: '#adc7ff'
  secondary: '#006d37'
  on-secondary: '#ffffff'
  secondary-container: '#6bfe9c'
  on-secondary-container: '#00743a'
  tertiary: '#9e4300'
  on-tertiary: '#ffffff'
  tertiary-container: '#c55500'
  on-tertiary-container: '#0e0200'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc7ff'
  on-primary-fixed: '#001a41'
  on-primary-fixed-variant: '#004493'
  secondary-fixed: '#6bfe9c'
  secondary-fixed-dim: '#4ae183'
  on-secondary-fixed: '#00210c'
  on-secondary-fixed-variant: '#005228'
  tertiary-fixed: '#ffdbcb'
  tertiary-fixed-dim: '#ffb691'
  on-tertiary-fixed: '#341100'
  on-tertiary-fixed-variant: '#783100'
  background: '#f9f9ff'
  on-background: '#191c23'
  surface-variant: '#e0e2ec'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 12px
  margin-mobile: 16px
  margin-desktop: 24px
  card-gap: 8px
---

## Brand & Style
The design system for this service is built on a **Corporate / Modern** aesthetic, optimized for high-density information and real-time utility. It draws inspiration from sophisticated urban navigation systems, prioritizing functional clarity over decorative flair. 

The personality is **professional, helpful, and trustworthy**. The UI stays out of the way, acting as a clear lens through which users can view the city’s pulse. The visual language uses a "Flat 2.0" approach: clean surfaces, crisp dividers, and a map-centric layout that feels light yet authoritative. It avoids heavy gradients and complex shadows to ensure maximum performance and readability during rapid data updates.

## Colors
The palette is rooted in **Seoul Blue**, a professional and calm primary hue that denotes technology and reliability. 

- **Primary:** Used for active states, primary buttons, and navigational focus.
- **Status Semantic Palette:** A critical four-step scale (Green to Red) is used to communicate density and traffic flow instantly. These colors must maintain high visibility against both light map tiles and white surfaces.
- **Backgrounds:** Use pure white (#FFFFFF) for primary interactive surfaces and card backgrounds to maximize contrast. Use the light gray (#F8F9FA) for secondary content areas to create subtle visual grouping.
- **Borders:** Dividers are kept extremely thin (1px) and light to maintain a "borderless" feel while providing necessary structural definition.

## Typography
The typography system uses **Plus Jakarta Sans** for headlines to provide a modern, slightly soft professional feel, paired with **Be Vietnam Pro** for body text and labels to ensure exceptional legibility at small sizes and high information densities.

- **Korean Optimization:** When rendering Korean characters, ensure a fallback to a clean Neo-Grotesque sans-serif (like Pretardard) to maintain the geometric consistency of the system.
- **Hierarchy:** Use font weight rather than size to differentiate information within cards. Labels (label-md) should be used for status indicators and metadata.
- **Mobile Adjustments:** For mobile views, avoid font sizes larger than 24px for headlines to maximize the visible map area.

## Layout & Spacing
This system follows a **Fluid Grid** model with high-density spacing. Because the map is the primary interface, the layout relies on floating overlays rather than a rigid central column.

- **The 4px Rule:** All spacing and sizing should be increments of 4px.
- **Floating Overlays:** The search bar and category filters float 16px from the top and sides on mobile. 
- **Bottom Sheet Behavior:** The primary content container is a bottom sheet that transitions between three states: 
  - *Collapsed:* Shows only the "Handle" and a single row of summary data.
  - *Half:* Occupies 40% of the screen, showing the main list or stats grid.
  - *Full:* Occupies 95% of the screen for deep-dive information.
- **Information Grid:** Real-time stats are arranged in a 2-column grid within cards, using an 8px gap for maximum compact readability.

## Elevation & Depth
Depth is conveyed through **Tonal Layers** and extremely subtle **Ambient Shadows**.

- **Level 0 (Map):** The base layer.
- **Level 1 (Cards/Sheets):** Use a pure white surface with a very soft, diffused shadow (0px 4px 12px, 5% opacity) to lift content off the map without creating visual clutter.
- **Level 2 (Floating Elements):** The search bar and active map markers use a slightly more defined shadow (0px 8px 16px, 8% opacity) to indicate they are the highest interactive priority.
- **Outlines:** Use a 1px border (#EEEEEE) on all cards even when shadowed to ensure crisp definition against light-colored map areas.

## Shapes
The shape language is **Rounded**, leaning towards pill-shapes for interactive elements to feel approachable and modern.

- **Standard Components:** Use 8px (0.5rem) for cards and bottom sheet top corners.
- **Search & Filters:** Use the "Pill" (100px) approach for the floating search bar and category chips.
- **Markers:** Map markers should use a "Teardrop" or rounded-pin shape with a 4px internal radius.
- **Indicators:** Status dots and live-pulsing indicators are always perfect circles.

## Components
- **Floating Search Bar:** High border-radius (pill), 1px subtle border, pure white background. Left-aligned search icon, right-aligned microphone/filter icon.
- **Category Filters:** Horizontal scrolling container of pill-shaped chips. Inactive: White bg with border. Active: Seoul Blue bg with white text.
- **Bottom Sheets:** 16px top-corner radius. Includes a "Grabber" (32x4px, light gray) at the top center. Background is pure white.
- **Information Cards:** Simple white rectangles with 8px radius. Use `label-sm` for secondary metadata and `headline-sm` for primary stats.
- **Map Markers:** 
  - *Structure:* A colored circle (Status Color) with a white icon or text label inside.
  - *Active State:* Scales up by 1.2x and adds a thicker white stroke.
- **Status Badges:** Compact pills with a solid color background (Status Colors) and white text, used within cards to show current crowd levels.
- **Lists:** High-density rows with 12px vertical padding, separated by the 1px #EEEEEE divider.