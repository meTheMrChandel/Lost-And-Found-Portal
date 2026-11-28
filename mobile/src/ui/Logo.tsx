import React from "react";
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";

const EMERALD = "#10B981";
const CORAL = "#FF6B57";

interface LogoProps {
  size?: number;
  /** "mark": the magnifier on a light background. "tile": the app icon, on charcoal. */
  variant?: "mark" | "tile";
}

/** The Lost & Found mark (repo root lf-mark.svg and lf-icon.svg): an L and F under a magnifier. */
export const Logo: React.FC<LogoProps> = ({ size = 40, variant = "tile" }) => {
  const tile = variant === "tile";
  const letters = tile ? "#FAF7F2" : "#1C1C1E";
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityLabel="Lost & Found logo">
      {tile ? <Rect width={120} height={120} rx={28} fill="#1C1C1E" /> : null}
      <G transform={tile ? "translate(10 9) scale(.83)" : undefined}>
        <Circle cx={56} cy={54} r={38} fill="none" stroke={EMERALD} strokeWidth={10} />
        <Line x1={84} y1={82} x2={107} y2={105} stroke={EMERALD} strokeWidth={12} strokeLinecap="round" />
        <G fill="none" strokeWidth={7.5} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M38 40 V68 H50" stroke={letters} />
          <Path d="M62 68 V40 H76" stroke={letters} />
          <Path d="M62 54 H70" stroke={CORAL} />
        </G>
      </G>
    </Svg>
  );
};
