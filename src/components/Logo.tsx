import { Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { activeVertical } from "../config/vertical.config";

export function Logo({ size = 84, showWordmark = true }: { size?: number; showWordmark?: boolean }) {
  const colors = activeVertical.colors;
  return (
    <View className="items-center">
      <Svg width={size} height={size} viewBox="0 0 128 128" accessibilityLabel={activeVertical.displayName}>
        <Rect width={128} height={128} rx={28} fill={colors.background} />
        <Path
          d="M64 18 L100 34 V62 C100 86 64 110 64 110 C64 110 28 86 28 62 V34 Z"
          fill={colors.card}
          stroke={colors.accent}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        <Path
          d="M46 66 L58 78 L84 50"
          fill="none"
          stroke={colors.success}
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path d="M78 34 C88 36 94 44 90 52" fill="none" stroke="#F8FAFC" strokeWidth={4} strokeLinecap="round" />
      </Svg>
      {showWordmark ? (
        <Text className="mt-3 text-center text-2xl font-bold text-white">{activeVertical.displayName}</Text>
      ) : null}
    </View>
  );
}
