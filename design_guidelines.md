# Design Guidelines: Last Safe Tile

## Architecture Decisions

### Authentication
**No authentication required.** This is a single-player, local-first game.
- All data stored locally (high scores, coins, retries)
- No backend integration needed
- No profile/settings screen beyond basic game settings

### Navigation Architecture
**Stack-Only Navigation** - Linear flow optimized for quick gameplay sessions.

Navigation Flow:
1. Splash Screen (2s auto-advance or tap to skip)
2. Main Menu (root)
3. Gameplay Screen (modal, no back button - must finish or die)
4. Game Over Screen (modal over gameplay)
5. Store Screen (pushed from Main Menu or Game Over)
6. Settings Screen (pushed from Main Menu)

**Critical UX Rule:** No accidental exits during gameplay. Prevent back gestures/buttons during active game.

## Screen Specifications

### 1. Splash Screen
- **Layout:** Full-screen, centered content
- **Safe Area Insets:** None (edge-to-edge)
- **Components:**
  - Game logo (generated asset: minimalist geometric design with falling tile motif)
  - Subtitle text: "How long can you stay?"
  - Tap anywhere interaction (no visible button)
- **Duration:** 2 seconds auto-advance or immediate on tap

### 2. Main Menu
- **Layout:** Centered vertical stack
- **Safe Area Insets:** Top: insets.top + 80px, Bottom: insets.bottom + 80px
- **Header:** None
- **Components:**
  - Game logo (smaller than splash, top 25% of screen)
  - Four primary action buttons (vertical stack, centered):
    - ▶️ Play (primary emphasis, largest)
    - 🏆 High Score
    - 🛒 Store
    - ⚙️ Settings
  - Small text below buttons: "Daily free retry available" (if applicable)
- **Button Specs:**
  - Minimum tap target: 64px height
  - Spacing between: 16px
  - Play button: 80% screen width, others: 70% screen width

### 3. Gameplay Screen
- **Layout:** Fixed, non-scrollable
- **Safe Area Insets:** None (full-screen game view)
- **Header:** Custom minimal header
  - Background: Semi-transparent overlay
  - Left: Time survived (white text, 20pt medium)
  - Right: Multiplier indicator (x1.0 → x3.0, glowing when >1.5x)
- **Main Content:**
  - 5×5 grid centered in middle 60% of screen
  - Grid should scale responsively but maintain square aspect ratio
  - Character sprite on current tile
- **Footer:** Fixed bottom area
  - Single large button: "MOVE"
  - Button height: 72px
  - Width: 85% screen width, centered
  - Bottom margin: insets.bottom + 24px
- **No other UI elements** - extreme minimalism for focus

### 4. Game Over Screen
- **Layout:** Modal overlay (80% opacity black background blur)
- **Safe Area Insets:** Centered card with 32px horizontal margins
- **Components:**
  - Large result text: "YOU LASTED 23.4s" (bold, 32pt)
  - Score breakdown (smaller, 16pt):
    - Time: 23.4s
    - Avg Multiplier: x2.1
    - Final Score: 49 pts
  - Three action buttons (vertical stack):
    - 🔁 Retry (FREE) - green, if retries available
    - 🪙 Continue for 10 Coins - yellow/gold, only if has coins
    - 🏠 Home - neutral
  - Small disclaimer text: "Continuing resets multiplier" (12pt, gray)
- **Button Spacing:** 12px between each

### 5. Store Screen
- **Layout:** Scrollable list
- **Header:** Default navigation header
  - Title: "Store"
  - Left: Back button
  - Background: Solid (non-transparent)
- **Safe Area Insets:** Top: 16px, Bottom: insets.bottom + 24px
- **Components:**
  - Current coin balance (large, prominent at top)
  - Coin pack cards (vertical list):
    - Each card shows: coin amount, price, "Most Popular" badge if applicable
    - Cards have subtle shadow for elevation
  - Optional power item card:
    - Stability Token description
    - Cost: 5 coins
    - Purchase button
  - Safe purchase disclaimer at bottom

### 6. Settings Screen
- **Layout:** Scrollable form
- **Header:** Default navigation header
  - Title: "Settings"
  - Left: Back button
- **Safe Area Insets:** Top: 16px, Bottom: insets.bottom + 24px
- **Components:**
  - Toggle: Sound effects
  - Toggle: Vibration
  - Toggle: Visual crack warnings
  - Button: Reset high scores (with confirmation)

## Design System

### Color Palette
**Theme:** High-contrast, urgent, survival-focused
- **Primary (Safe):** #00FF88 (vibrant green) - represents safe tiles
- **Warning (Cracking):** #FFB800 (urgent yellow/orange) - cracking tiles
- **Danger (Gone):** #000000 (void black) - disappeared tiles
- **Accent (Multiplier):** #00D4FF (electric cyan) - glowing multiplier indicator
- **Background:** #1A1A2E (dark blue-gray) - reduces eye strain
- **Surface:** #16213E (darker blue) - for cards and modals
- **Text Primary:** #FFFFFF (white)
- **Text Secondary:** #8E9AAF (light gray)
- **Success (Retry):** #4CAF50 (green)
- **Premium (Continue):** #FFD700 (gold)

### Typography
- **Display (Score, Timer):** SF Mono (iOS) / Roboto Mono (Android), Bold
  - Large: 32pt
  - Medium: 24pt
  - Small: 18pt
- **Body (UI Text):** SF Pro (iOS) / Roboto (Android), Regular
  - Standard: 16pt
  - Small: 14pt
  - Caption: 12pt
- **Buttons:** SF Pro / Roboto, Semibold, 18pt

### Visual Design Principles
1. **Immediate Visual Feedback:**
   - Tile states must be instantly recognizable
   - Safe: Solid green fill, no effects
   - Cracking: Animated crack lines + yellow glow + shake animation (0.7s)
   - Gone: Fade to black void with subtle particle effect
   
2. **Character Design:**
   - Generate 1 simple geometric character sprite (cube or circle-based)
   - Contrasting color (white or cyan) to stand out against tiles
   - Subtle idle animation (bob or breathe)

3. **Button Feedback:**
   - MOVE button: Scale down to 0.95 on press + haptic feedback
   - All buttons: 0.2s press animation
   - Disabled states: 40% opacity

4. **Multiplier Visual:**
   - x1.0: Normal white text
   - x1.5+: Pulsing cyan glow
   - x2.5+: Intense glow + particle effects
   - Animates smoothly with risk level

### Critical Assets to Generate
1. **Game Logo:** Geometric design featuring a cracked/falling tile motif (SVG, 512×512)
2. **Character Sprite:** Simple geometric avatar (PNG, 128×128)
3. **Tile Crack Texture:** Procedural or illustrated crack pattern (PNG, 256×256, transparent)

### Interaction Design
- **Tile Tap on Grid:** Disabled during gameplay (auto-move only)
- **Move Button:** Single tap, immediate response, no double-tap protection needed
- **Grid Animations:**
  - Tile crack: 0.7s smooth transition with shake
  - Tile disappear: 0.3s fade + scale down
  - Character move: 0.4s ease-out slide to new tile
  - Board shrink: 0.5s animated transition when outer tiles remove

### Accessibility
- **Contrast:** All tile states meet WCAG AAA (>7:1 ratio)
- **Color Independence:** Cracking tiles use BOTH color AND animation
- **Haptic Feedback:** Vibrate on crack warning, tile disappear, and game over
- **Reduce Motion:** Option to disable shake animations in Settings

### Sound Design (Specifications for Engineer)
- Tile crack: Sharp, tense sound (0.3s)
- Tile disappear: Low whoosh/void sound (0.5s)
- Successful move: Satisfying click (0.1s)
- Multiplier increase: Ascending chime (0.2s)
- Game over: Dramatic descending tone (1s)
- All sounds should be subtle and non-annoying (max -12dB)