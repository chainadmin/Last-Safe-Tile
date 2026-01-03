# Last Safe Tile

## Overview

Last Safe Tile is a single-player mobile reflex/survival game built with React Native and Expo. Players stand on a grid of tiles where tiles progressively become unsafe and fall away. The core mechanic involves timing - players tap to auto-move to the safest tile, with longer waits yielding higher score multipliers but greater risk.

The game is designed for quick 10-45 second sessions with local-first data storage. It targets web initially with plans for Play Store/App Store deployment.

## Recent Changes (Jan 2026)
- Implemented complete MVP with all core game mechanics
- Added 6 screens: Splash, Main Menu, Game, Game Over, Store, Settings
- Implemented risk/reward multiplier system (x1.0 to x3.0)
- Added Stability Token power item
- Added daily free retry system
- Connected Visual Crack Warnings toggle to gameplay
- Added Authorize.net payment integration for in-app coin purchases
- Added Chain Software Group branding screen

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React Native with Expo SDK 54
- **Navigation**: React Navigation with Native Stack (stack-only, linear flow)
- **State Management**: React hooks with local component state
- **Animations**: React Native Reanimated for smooth 60fps animations
- **Styling**: StyleSheet with a custom theme system (GameColors, Typography, Spacing)

### Navigation Flow
Linear stack navigation optimized for quick gameplay:
1. Splash Screen → 2. Main Menu → 3. Game Screen → 4. Game Over → 5. Store/Settings

Critical design decision: No back gestures during active gameplay to prevent accidental exits.

### Data Storage
- **Local-first approach**: All data stored via AsyncStorage
- **No authentication required**: Single-player game with no backend user management
- **Stored data**: High scores, coins, retries, settings, stability tokens

### Server Architecture
- **Express.js** backend with TypeScript
- **Purpose**: Primarily serves static landing page and handles API routes
- **Database**: PostgreSQL with Drizzle ORM (schema defined but minimal usage for local-first game)
- **Storage Pattern**: In-memory storage implementation with interface for future database integration

### Build System
- **Module bundling**: Babel with module-resolver for path aliases (@/, @shared/)
- **Development**: Expo dev server with Replit-specific proxy configuration
- **Production**: esbuild for server bundling, Expo for client builds

## External Dependencies

### Core Dependencies
- **Expo SDK**: Core mobile framework with plugins for splash screen, haptics, blur effects
- **React Navigation**: Native stack navigation
- **React Native Reanimated**: Animation library
- **TanStack React Query**: Data fetching (prepared for future API integration)

### Storage & Database
- **AsyncStorage**: Local persistent storage for game data
- **Drizzle ORM**: PostgreSQL ORM for transaction security
- **PostgreSQL**: Database configured via DATABASE_URL environment variable
- **processed_transactions table**: Stores validated purchase transaction IDs to prevent replay attacks across server restarts

### UI/UX
- **expo-haptics**: Tactile feedback
- **expo-blur**: Visual blur effects
- **@expo/vector-icons**: Icon library (Feather icons)
- **react-native-gesture-handler**: Touch gesture handling

### Payment Integration
- **Multi-platform support**: iOS (Apple In-App Purchases), Android (Google Play Billing Library 6.0+), Web (Authorize.net)
- **Native IAP**: Uses react-native-iap v14+ for iOS/Android store purchases (requires development build)
- **Play Billing Library**: Version 6.0+ compliant (meets Google Play's August 2024 requirement)
- **Authorize.net fallback**: Web/card payments with Accept.js for PCI-compliant tokenization
- **Server-side validation**: Receipt validation for iOS (Apple), product catalog validation for all
- **Product IDs**: coins_50, coins_120, coins_300 (must match App Store Connect / Google Play Console)
- **Required secrets for Authorize.net**: AUTHORIZE_NET_API_LOGIN_ID, AUTHORIZE_NET_TRANSACTION_KEY, AUTHORIZE_NET_PUBLIC_CLIENT_KEY
- **Optional secret for iOS validation**: APPLE_SHARED_SECRET
- **Test mode**: Uses sandbox APIs in development

### Ads (AdMob Integration)
- **AdMob SDK**: react-native-google-mobile-ads configured in app.json
- **App ID**: ca-app-pub-1580761947831808~1773139218 (both iOS and Android)
- **Banner Ad Unit ID**: ca-app-pub-1580761947831808/8250933561 (displayed on main menu)
- **Interstitial Ad Unit ID**: ca-app-pub-1580761947831808/6019505985 (shown after game over)
- **Reactive subscription pattern**: Uses subscribeToAdsReady() for component re-rendering when ads become available
- **Platform limitation**: Ads require development build; won't work in Expo Go
- **Test mode**: Uses test ad IDs in development builds

### Environment
- **Replit-specific**: Uses REPLIT_DEV_DOMAIN and REPLIT_DOMAINS for CORS and proxy configuration
- **EXPO_PUBLIC_DOMAIN**: Client-side API URL configuration