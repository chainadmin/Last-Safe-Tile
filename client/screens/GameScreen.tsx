import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, StyleSheet, Pressable, Dimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { GameColors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { getSettings, getStabilityTokens, setStabilityTokens } from "@/lib/storage";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Game">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const INITIAL_GRID_SIZE = 5;
const TILE_GAP = 4;
const INITIAL_CRACK_DELAY = 1500;
const MIN_CRACK_DELAY = 300;
const CRACK_SPEEDUP_RATE = 15;
const MULTIPLIER_MAX_TIME = 6;

const NEON_PALETTES = [
  { safe: "#00FF88", accent: "#00FFCC" },
  { safe: "#FF00FF", accent: "#FF66FF" },
  { safe: "#00BFFF", accent: "#66D9FF" },
  { safe: "#FFFF00", accent: "#FFFF66" },
  { safe: "#FF6600", accent: "#FF9933" },
  { safe: "#9933FF", accent: "#CC66FF" },
  { safe: "#FF0066", accent: "#FF3399" },
  { safe: "#00FF00", accent: "#66FF66" },
];

type TileState = "safe" | "cracking" | "gone";

interface Tile {
  id: string;
  row: number;
  col: number;
  state: TileState;
}

export default function GameScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [playerPosition, setPlayerPosition] = useState({ row: 2, col: 2 });
  const [timeSurvived, setTimeSurvived] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [gameActive, setGameActive] = useState(true);
  const [stabilityTokenUsed, setStabilityTokenUsed] = useState(false);
  const [hasStabilityToken, setHasStabilityToken] = useState(false);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [visualWarningsEnabled, setVisualWarningsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [gridNumber, setGridNumber] = useState(1);
  const [showTokenUsedFeedback, setShowTokenUsedFeedback] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);
  const [currentPalette, setCurrentPalette] = useState(NEON_PALETTES[0]);
  
  const multiplierAccumulator = useRef<number[]>([]);
  const scoreRef = useRef(0);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const crackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastMoveTimeRef = useRef<number>(Date.now());
  const gameActiveRef = useRef<boolean>(true);
  const playerPositionRef = useRef({ row: 2, col: 2 });
  const tilesRef = useRef<Tile[]>([]);
  const hasStabilityTokenRef = useRef(false);
  const stabilityTokenUsedRef = useRef(false);
  const startTimeRef = useRef<number>(Date.now());
  const gridNumberRef = useRef(1);
  const gridStartTimeRef = useRef<number>(Date.now());
  
  const buttonScale = useSharedValue(1);
  const multiplierGlow = useSharedValue(0);
  const playerX = useSharedValue(2);
  const playerY = useSharedValue(2);

  const gridWidth = SCREEN_WIDTH - Spacing["2xl"] * 2;
  const tileSize = (gridWidth - (INITIAL_GRID_SIZE - 1) * TILE_GAP) / INITIAL_GRID_SIZE;

  const audioPlayer = useAudioPlayer(
    "https://assets.mixkit.co/music/preview/mixkit-game-level-music-689.mp3"
  );

  useEffect(() => {
    loadSettings();
    initGame();
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (crackTimerRef.current) clearTimeout(crackTimerRef.current);
      audioPlayer.pause();
    };
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    
    if (soundEnabled && gameActive) {
      audioPlayer.loop = true;
      audioPlayer.volume = 0.3;
      audioPlayer.play();
    } else {
      audioPlayer.pause();
    }
  }, [settingsLoaded, soundEnabled, gameActive]);

  const loadSettings = async () => {
    const [settings, tokens] = await Promise.all([
      getSettings(),
      getStabilityTokens(),
    ]);
    setVibrationEnabled(settings.vibrationEnabled);
    setVisualWarningsEnabled(settings.visualWarningsEnabled);
    setSoundEnabled(settings.soundEnabled);
    setHasStabilityToken(tokens > 0);
    hasStabilityTokenRef.current = tokens > 0;
    setSettingsLoaded(true);
  };

  const initGame = () => {
    const initialTiles: Tile[] = [];
    for (let row = 0; row < INITIAL_GRID_SIZE; row++) {
      for (let col = 0; col < INITIAL_GRID_SIZE; col++) {
        initialTiles.push({
          id: `${row}-${col}`,
          row,
          col,
          state: "safe",
        });
      }
    }
    setTiles(initialTiles);
    tilesRef.current = initialTiles;
    setPlayerPosition({ row: 2, col: 2 });
    playerPositionRef.current = { row: 2, col: 2 };
    playerX.value = 2;
    playerY.value = 2;
    startTimeRef.current = Date.now();
    lastMoveTimeRef.current = Date.now();
    gridStartTimeRef.current = Date.now();
    gridNumberRef.current = 1;
    setGridNumber(1);
    scoreRef.current = 0;
    setCurrentScore(0);
    setCurrentPalette(NEON_PALETTES[0]);
    multiplierAccumulator.current = [];
    gameActiveRef.current = true;
    startGameLoop();
  };

  const transitionToNextGrid = () => {
    if (!gameActiveRef.current) return;
    
    const newGridNumber = gridNumberRef.current + 1;
    gridNumberRef.current = newGridNumber;
    setGridNumber(newGridNumber);
    gridStartTimeRef.current = Date.now();
    
    const newPalette = NEON_PALETTES[(newGridNumber - 1) % NEON_PALETTES.length];
    setCurrentPalette(newPalette);
    
    const timeSinceMove = (Date.now() - lastMoveTimeRef.current) / 1000;
    const currentMultiplier = 1 + Math.min(timeSinceMove / MULTIPLIER_MAX_TIME, 1) * 2;
    
    const segmentScore = Math.round(timeSinceMove * currentMultiplier);
    scoreRef.current += segmentScore;
    multiplierAccumulator.current.push(currentMultiplier);
    
    const gridBonus = Math.round(10 * currentMultiplier);
    scoreRef.current += gridBonus;
    setCurrentScore(scoreRef.current);
    lastMoveTimeRef.current = Date.now();
    
    if (vibrationEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    const newTiles: Tile[] = [];
    for (let row = 0; row < INITIAL_GRID_SIZE; row++) {
      for (let col = 0; col < INITIAL_GRID_SIZE; col++) {
        newTiles.push({
          id: `g${newGridNumber}-${row}-${col}`,
          row,
          col,
          state: "safe",
        });
      }
    }
    setTiles(newTiles);
    tilesRef.current = newTiles;
    
    const baseDelay = Math.max(MIN_CRACK_DELAY, INITIAL_CRACK_DELAY - (newGridNumber - 1) * 200);
    scheduleCrack(baseDelay);
  };

  const startGameLoop = () => {
    gameLoopRef.current = setInterval(() => {
      if (!gameActiveRef.current) return;
      
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setTimeSurvived(elapsed);
      
      const timeSinceMove = (Date.now() - lastMoveTimeRef.current) / 1000;
      const riskLevel = Math.min(timeSinceMove / MULTIPLIER_MAX_TIME, 1);
      const newMultiplier = 1 + riskLevel * 2;
      setMultiplier(newMultiplier);
      multiplierGlow.value = riskLevel;
    }, 100);

    scheduleCrack(INITIAL_CRACK_DELAY);
  };

  const scheduleCrack = (delay: number) => {
    if (crackTimerRef.current) clearTimeout(crackTimerRef.current);
    crackTimerRef.current = setTimeout(() => {
      crackRandomTile();
    }, delay);
  };

  const crackRandomTile = () => {
    if (!gameActiveRef.current) return;

    const currentTiles = tilesRef.current;
    const safeTiles = currentTiles.filter((t) => t.state === "safe");
    const nonGoneTiles = currentTiles.filter((t) => t.state !== "gone");
    
    if (nonGoneTiles.length <= 3) {
      transitionToNextGrid();
      return;
    }
    
    if (safeTiles.length <= 1) {
      endGame();
      return;
    }

    const tilesToCrack = Math.min(
      gridNumberRef.current >= 4 ? 3 : gridNumberRef.current >= 2 ? 2 : 1,
      safeTiles.length - 1
    );
    
    const shuffled = [...safeTiles].sort(() => Math.random() - 0.5);
    const selectedTiles = shuffled.slice(0, tilesToCrack);
    
    if (vibrationEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const selectedIds = new Set(selectedTiles.map(t => t.id));
    const updatedTiles = currentTiles.map((t) =>
      selectedIds.has(t.id) ? { ...t, state: "cracking" as TileState } : t
    );
    setTiles(updatedTiles);
    tilesRef.current = updatedTiles;

    selectedTiles.forEach((tile) => {
      setTimeout(() => {
        removeCrackedTile(tile.id, tile.row, tile.col);
      }, 700);
    });

    const gridElapsed = (Date.now() - gridStartTimeRef.current) / 1000;
    const baseDelay = Math.max(MIN_CRACK_DELAY, INITIAL_CRACK_DELAY - (gridNumberRef.current - 1) * 200);
    const nextDelay = Math.max(MIN_CRACK_DELAY, baseDelay - gridElapsed * CRACK_SPEEDUP_RATE);
    scheduleCrack(nextDelay);
  };

  const removeCrackedTile = (tileId: string, tileRow: number, tileCol: number) => {
    if (!gameActiveRef.current) return;

    const playerPos = playerPositionRef.current;
    const isPlayerOnTile = tileRow === playerPos.row && tileCol === playerPos.col;

    if (isPlayerOnTile) {
      if (hasStabilityTokenRef.current && !stabilityTokenUsedRef.current) {
        useStabilityToken();
        const currentTiles = tilesRef.current;
        const repairedTiles = currentTiles.map((t) =>
          t.id === tileId ? { ...t, state: "safe" as TileState } : t
        );
        setTiles(repairedTiles);
        tilesRef.current = repairedTiles;
        return;
      } else {
        endGame();
        return;
      }
    }

    const currentTiles = tilesRef.current;
    const updatedTiles = currentTiles.map((t) =>
      t.id === tileId ? { ...t, state: "gone" as TileState } : t
    );
    setTiles(updatedTiles);
    tilesRef.current = updatedTiles;
  };

  const useStabilityToken = async () => {
    stabilityTokenUsedRef.current = true;
    setStabilityTokenUsed(true);
    hasStabilityTokenRef.current = false;
    setHasStabilityToken(false);
    
    setShowTokenUsedFeedback(true);
    setTimeout(() => setShowTokenUsedFeedback(false), 2000);
    
    const tokens = await getStabilityTokens();
    await setStabilityTokens(Math.max(0, tokens - 1));
    
    if (vibrationEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleMove = useCallback(() => {
    if (!gameActiveRef.current) return;

    if (vibrationEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const timeSinceMove = (Date.now() - lastMoveTimeRef.current) / 1000;
    const currentMultiplier = 1 + Math.min(timeSinceMove / MULTIPLIER_MAX_TIME, 1) * 2;
    multiplierAccumulator.current.push(currentMultiplier);
    
    const scoreForThisSegment = Math.round(timeSinceMove * currentMultiplier);
    scoreRef.current += scoreForThisSegment;
    setCurrentScore(scoreRef.current);
    
    lastMoveTimeRef.current = Date.now();

    const currentTiles = tilesRef.current;
    const currentPos = playerPositionRef.current;
    
    const safeTiles = currentTiles.filter(
      (t) => t.state === "safe" && !(t.row === currentPos.row && t.col === currentPos.col)
    );

    if (safeTiles.length === 0) {
      endGame();
      return;
    }

    const crackingTiles = currentTiles.filter((t) => t.state === "cracking");
    const crackingIds = new Set(crackingTiles.map((t) => t.id));
    
    const trueSafeTiles = safeTiles.filter((t) => !crackingIds.has(t.id));
    const targetTiles = trueSafeTiles.length > 0 ? trueSafeTiles : safeTiles;
    
    const newTile = targetTiles[Math.floor(Math.random() * targetTiles.length)];
    
    const newPos = { row: newTile.row, col: newTile.col };
    setPlayerPosition(newPos);
    playerPositionRef.current = newPos;
    
    playerX.value = withTiming(newTile.col, { duration: 150, easing: Easing.out(Easing.quad) });
    playerY.value = withTiming(newTile.row, { duration: 150, easing: Easing.out(Easing.quad) });
  }, [vibrationEnabled]);

  const endGame = () => {
    if (!gameActiveRef.current) return;
    
    gameActiveRef.current = false;
    setGameActive(false);
    
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    if (crackTimerRef.current) clearTimeout(crackTimerRef.current);
    
    if (vibrationEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    const timeSinceMove = (Date.now() - lastMoveTimeRef.current) / 1000;
    const finalMultiplier = 1 + Math.min(timeSinceMove / MULTIPLIER_MAX_TIME, 1) * 2;
    const remainingScore = Math.round(timeSinceMove * finalMultiplier);
    scoreRef.current += remainingScore;
    multiplierAccumulator.current.push(finalMultiplier);

    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const gridsBeaten = gridNumberRef.current - 1;
    const avgMultiplier =
      multiplierAccumulator.current.length > 0
        ? multiplierAccumulator.current.reduce((a, b) => a + b, 0) /
          multiplierAccumulator.current.length
        : 1;
    const finalScore = scoreRef.current;

    setTimeout(() => {
      navigation.navigate("GameOver", {
        timeSurvived: elapsed,
        avgMultiplier,
        finalScore,
        gridsBeaten,
        stabilityTokenUsed: stabilityTokenUsedRef.current,
      });
    }, 300);
  };

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const multiplierAnimatedStyle = useAnimatedStyle(() => ({
    shadowOpacity: multiplierGlow.value * 0.8,
    shadowRadius: multiplierGlow.value * 10,
  }));

  const playerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: playerX.value * (tileSize + TILE_GAP) },
      { translateY: playerY.value * (tileSize + TILE_GAP) },
    ],
  }));

  const handlePressIn = () => {
    buttonScale.value = withTiming(0.95, { duration: 100 });
  };

  const handlePressOut = () => {
    buttonScale.value = withTiming(1, { duration: 100 });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
      <View style={styles.header}>
        <View style={styles.timerContainer}>
          <ThemedText style={styles.timerLabel}>Score</ThemedText>
          <ThemedText style={[styles.timerValue, { color: currentPalette.safe }]}>{currentScore}</ThemedText>
        </View>
        <View style={styles.gridIndicator}>
          <ThemedText style={styles.gridLabel}>Grid</ThemedText>
          <ThemedText style={styles.gridValue}>{gridNumber}</ThemedText>
        </View>
        <Animated.View style={[styles.multiplierContainer, multiplierAnimatedStyle]}>
          <ThemedText style={styles.multiplierLabel}>Multiplier</ThemedText>
          <ThemedText
            style={[
              styles.multiplierValue,
              multiplier > 1.5 && { color: currentPalette.accent },
              multiplier > 2.5 && styles.multiplierIntense,
            ]}
          >
            x{multiplier.toFixed(1)}
          </ThemedText>
        </Animated.View>
      </View>

      {showTokenUsedFeedback ? (
        <View style={styles.tokenUsedFeedback}>
          <ThemedText style={styles.tokenUsedText}>Stability Token Saved You!</ThemedText>
        </View>
      ) : hasStabilityToken && !stabilityTokenUsed ? (
        <View style={styles.tokenIndicator}>
          <ThemedText style={styles.tokenText}>Stability Token Ready</ThemedText>
        </View>
      ) : null}

      <View style={styles.gridContainer}>
        <View style={[styles.grid, { width: gridWidth, height: gridWidth }]}>
          {tiles.map((tile) => (
            <TileComponent
              key={tile.id}
              tile={tile}
              size={tileSize}
              gap={TILE_GAP}
              visualWarningsEnabled={visualWarningsEnabled}
              palette={currentPalette}
            />
          ))}
          <Animated.View
            style={[
              styles.player,
              {
                width: tileSize * 0.6,
                height: tileSize * 0.6,
                borderRadius: tileSize * 0.3,
                backgroundColor: currentPalette.accent,
                marginLeft: (tileSize - tileSize * 0.6) / 2,
                marginTop: (tileSize - tileSize * 0.6) / 2,
              },
              playerAnimatedStyle,
            ]}
          />
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing["2xl"] }]}>
        <Pressable
          onPress={handleMove}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={!gameActive}
        >
          <Animated.View
            style={[
              styles.moveButton,
              { backgroundColor: currentPalette.safe },
              !gameActive && styles.moveButtonDisabled,
              buttonAnimatedStyle,
            ]}
          >
            <ThemedText style={styles.moveButtonText}>MOVE</ThemedText>
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

interface TileComponentProps {
  tile: Tile;
  size: number;
  gap: number;
  visualWarningsEnabled: boolean;
  palette: { safe: string; accent: string };
}

function TileComponent({ tile, size, gap, visualWarningsEnabled, palette }: TileComponentProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const shake = useSharedValue(0);

  useEffect(() => {
    if (tile.state === "cracking") {
      if (visualWarningsEnabled) {
        shake.value = withRepeat(
          withSequence(
            withTiming(-2, { duration: 60 }),
            withTiming(2, { duration: 60 })
          ),
          -1,
          true
        );
      }
    } else if (tile.state === "gone") {
      cancelAnimation(shake);
      shake.value = 0;
      scale.value = withTiming(0.3, { duration: 250, easing: Easing.out(Easing.ease) });
      opacity.value = withTiming(0, { duration: 250 });
    } else {
      cancelAnimation(shake);
      shake.value = 0;
      scale.value = 1;
      opacity.value = 1;
    }
  }, [tile.state, visualWarningsEnabled]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tile.col * (size + gap) + shake.value },
      { translateY: tile.row * (size + gap) },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const getBackgroundColor = () => {
    if (tile.state === "safe") return palette.safe;
    if (tile.state === "cracking") {
      return visualWarningsEnabled ? GameColors.warning : palette.safe;
    }
    return "transparent";
  };

  const backgroundColor = getBackgroundColor();

  return (
    <Animated.View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          backgroundColor,
          borderRadius: BorderRadius.xs,
        },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GameColors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing["2xl"],
    marginBottom: Spacing.lg,
  },
  timerContainer: {
    alignItems: "flex-start",
  },
  timerLabel: {
    ...Typography.small,
    color: GameColors.textSecondary,
  },
  timerValue: {
    ...Typography.displayMedium,
    color: GameColors.textPrimary,
    fontFamily: "monospace",
  },
  multiplierContainer: {
    alignItems: "flex-end",
    shadowColor: GameColors.accent,
    shadowOffset: { width: 0, height: 0 },
  },
  multiplierLabel: {
    ...Typography.small,
    color: GameColors.textSecondary,
  },
  multiplierValue: {
    ...Typography.displayMedium,
    color: GameColors.textPrimary,
    fontFamily: "monospace",
  },
  multiplierGlow: {
    color: GameColors.accent,
  },
  multiplierIntense: {
    color: GameColors.accent,
    textShadowColor: GameColors.accent,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  gridIndicator: {
    alignItems: "center",
  },
  gridLabel: {
    ...Typography.small,
    color: GameColors.textSecondary,
  },
  gridValue: {
    ...Typography.displayMedium,
    color: GameColors.textPrimary,
    fontFamily: "monospace",
  },
  tokenIndicator: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  tokenText: {
    ...Typography.small,
    color: GameColors.premium,
  },
  tokenUsedFeedback: {
    alignItems: "center",
    backgroundColor: GameColors.success,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing["2xl"],
    marginBottom: Spacing.md,
  },
  tokenUsedText: {
    ...Typography.body,
    color: GameColors.background,
    fontWeight: "600",
  },
  gridContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  grid: {
    position: "relative",
  },
  tile: {
    position: "absolute",
  },
  player: {
    position: "absolute",
    backgroundColor: GameColors.accent,
    borderWidth: 3,
    borderColor: GameColors.textPrimary,
  },
  footer: {
    paddingHorizontal: Spacing["2xl"],
  },
  moveButton: {
    height: 72,
    backgroundColor: GameColors.safe,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  moveButtonDisabled: {
    opacity: 0.4,
  },
  moveButtonText: {
    ...Typography.h3,
    color: GameColors.background,
    fontWeight: "700",
    letterSpacing: 2,
  },
});
