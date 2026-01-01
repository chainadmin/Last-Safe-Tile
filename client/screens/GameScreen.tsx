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
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  runOnJS,
  cancelAnimation,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Game">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const INITIAL_GRID_SIZE = 5;
const TILE_GAP = 4;

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
  
  const [gridSize, setGridSize] = useState(INITIAL_GRID_SIZE);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [playerPosition, setPlayerPosition] = useState({ row: 2, col: 2 });
  const [timeSurvived, setTimeSurvived] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [gameActive, setGameActive] = useState(true);
  const [lastMoveTime, setLastMoveTime] = useState(0);
  const [stabilityTokenUsed, setStabilityTokenUsed] = useState(false);
  const [hasStabilityToken, setHasStabilityToken] = useState(false);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [visualWarningsEnabled, setVisualWarningsEnabled] = useState(true);
  
  const multiplierAccumulator = useRef<number[]>([]);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const crackTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const buttonScale = useSharedValue(1);
  const multiplierGlow = useSharedValue(0);
  const playerX = useSharedValue(2);
  const playerY = useSharedValue(2);

  const gridWidth = SCREEN_WIDTH - Spacing["2xl"] * 2;
  const tileSize = (gridWidth - (gridSize - 1) * TILE_GAP) / gridSize;

  useEffect(() => {
    initGame();
    loadSettings();
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (crackTimerRef.current) clearTimeout(crackTimerRef.current);
    };
  }, []);

  const loadSettings = async () => {
    const [settings, tokens] = await Promise.all([
      getSettings(),
      getStabilityTokens(),
    ]);
    setVibrationEnabled(settings.vibrationEnabled);
    setVisualWarningsEnabled(settings.visualWarningsEnabled);
    setHasStabilityToken(tokens > 0);
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
    setPlayerPosition({ row: 2, col: 2 });
    playerX.value = 2;
    playerY.value = 2;
    startGameLoop();
  };

  const startGameLoop = () => {
    const startTime = Date.now();
    setLastMoveTime(startTime);
    
    gameLoopRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setTimeSurvived(elapsed);
      updateMultiplier(elapsed);
    }, 100);

    scheduleCrack(1000);
  };

  const updateMultiplier = (elapsed: number) => {
    const timeSinceMove = (Date.now() - lastMoveTime) / 1000;
    const riskLevel = Math.min(timeSinceMove / 2, 1);
    const newMultiplier = 1 + riskLevel * 2;
    setMultiplier(newMultiplier);
    multiplierGlow.value = riskLevel;
  };

  const scheduleCrack = (delay: number) => {
    crackTimerRef.current = setTimeout(() => {
      crackRandomTile();
    }, delay);
  };

  const crackRandomTile = () => {
    if (!gameActive) return;

    setTiles((currentTiles) => {
      const safeTiles = currentTiles.filter(
        (t) => t.state === "safe" && !(t.row === playerPosition.row && t.col === playerPosition.col)
      );
      
      if (safeTiles.length === 0) {
        endGame();
        return currentTiles;
      }

      const randomTile = safeTiles[Math.floor(Math.random() * safeTiles.length)];
      
      if (vibrationEnabled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      return currentTiles.map((t) =>
        t.id === randomTile.id ? { ...t, state: "cracking" as TileState } : t
      );
    });

    setTimeout(() => {
      removeCrackedTile();
    }, 700);

    const nextDelay = Math.max(500, 1000 - timeSurvived * 20);
    scheduleCrack(nextDelay);
  };

  const removeCrackedTile = () => {
    setTiles((currentTiles) => {
      const updatedTiles = currentTiles.map((t) =>
        t.state === "cracking" ? { ...t, state: "gone" as TileState } : t
      );

      const playerTile = updatedTiles.find(
        (t) => t.row === playerPosition.row && t.col === playerPosition.col
      );

      if (playerTile?.state === "gone") {
        if (hasStabilityToken && !stabilityTokenUsed) {
          useStabilityToken(updatedTiles);
          return updatedTiles.map((t) =>
            t.id === playerTile.id ? { ...t, state: "safe" as TileState } : t
          );
        } else {
          setTimeout(() => endGame(), 100);
        }
      }

      return updatedTiles;
    });
  };

  const useStabilityToken = async (currentTiles: Tile[]) => {
    setStabilityTokenUsed(true);
    const tokens = await getStabilityTokens();
    await setStabilityTokens(tokens - 1);
    setHasStabilityToken(false);
    if (vibrationEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleMove = useCallback(() => {
    if (!gameActive) return;

    if (vibrationEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    multiplierAccumulator.current.push(multiplier);
    setLastMoveTime(Date.now());

    setTiles((currentTiles) => {
      const safeTiles = currentTiles.filter(
        (t) => t.state === "safe" && !(t.row === playerPosition.row && t.col === playerPosition.col)
      );

      if (safeTiles.length === 0) {
        endGame();
        return currentTiles;
      }

      const crackingTiles = currentTiles.filter((t) => t.state === "cracking");
      const crackingPositions = new Set(crackingTiles.map((t) => t.id));
      
      const trueSafeTiles = safeTiles.filter((t) => !crackingPositions.has(t.id));
      const targetTiles = trueSafeTiles.length > 0 ? trueSafeTiles : safeTiles;
      
      const newTile = targetTiles[Math.floor(Math.random() * targetTiles.length)];
      
      setPlayerPosition({ row: newTile.row, col: newTile.col });
      playerX.value = withSpring(newTile.col, { damping: 15, stiffness: 200 });
      playerY.value = withSpring(newTile.row, { damping: 15, stiffness: 200 });

      return currentTiles;
    });
  }, [gameActive, multiplier, playerPosition, vibrationEnabled]);

  const endGame = () => {
    setGameActive(false);
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    if (crackTimerRef.current) clearTimeout(crackTimerRef.current);
    
    if (vibrationEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    const avgMultiplier =
      multiplierAccumulator.current.length > 0
        ? multiplierAccumulator.current.reduce((a, b) => a + b, 0) /
          multiplierAccumulator.current.length
        : 1;
    const finalScore = Math.round(timeSurvived * avgMultiplier);

    setTimeout(() => {
      navigation.navigate("GameOver", {
        timeSurvived,
        avgMultiplier,
        finalScore,
      });
    }, 500);
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
    buttonScale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
      <View style={styles.header}>
        <View style={styles.timerContainer}>
          <ThemedText style={styles.timerLabel}>Time</ThemedText>
          <ThemedText style={styles.timerValue}>{timeSurvived.toFixed(1)}s</ThemedText>
        </View>
        <Animated.View style={[styles.multiplierContainer, multiplierAnimatedStyle]}>
          <ThemedText style={styles.multiplierLabel}>Multiplier</ThemedText>
          <ThemedText
            style={[
              styles.multiplierValue,
              multiplier > 1.5 && styles.multiplierGlow,
              multiplier > 2.5 && styles.multiplierIntense,
            ]}
          >
            x{multiplier.toFixed(1)}
          </ThemedText>
        </Animated.View>
      </View>

      {hasStabilityToken && !stabilityTokenUsed ? (
        <View style={styles.tokenIndicator}>
          <ThemedText style={styles.tokenText}>Stability Token Active</ThemedText>
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
            />
          ))}
          <Animated.View
            style={[
              styles.player,
              {
                width: tileSize * 0.6,
                height: tileSize * 0.6,
                borderRadius: tileSize * 0.3,
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
}

function TileComponent({ tile, size, gap, visualWarningsEnabled }: TileComponentProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const shake = useSharedValue(0);

  useEffect(() => {
    if (tile.state === "cracking") {
      if (visualWarningsEnabled) {
        shake.value = withRepeat(
          withSequence(
            withTiming(-3, { duration: 50 }),
            withTiming(3, { duration: 50 })
          ),
          -1,
          true
        );
      }
    } else if (tile.state === "gone") {
      cancelAnimation(shake);
      shake.value = 0;
      scale.value = withTiming(0.5, { duration: 300, easing: Easing.out(Easing.ease) });
      opacity.value = withTiming(0, { duration: 300 });
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
    if (tile.state === "safe") return GameColors.safe;
    if (tile.state === "cracking") {
      return visualWarningsEnabled ? GameColors.warning : GameColors.safe;
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
  tokenIndicator: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  tokenText: {
    ...Typography.small,
    color: GameColors.premium,
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
    marginLeft: "7%",
    marginTop: "7%",
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
