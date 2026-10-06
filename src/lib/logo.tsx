import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from './theme';

/** The Out Here Now mark: a coral pin with a dancer balancing on a slackline. */
export function PinLogo({ size = 64, figure = colors.sand }: { size?: number; figure?: string }) {
  return (
    <Svg width={(size * 100) / 116} height={size} viewBox="0 0 100 116" accessibilityLabel="Out Here Now logo">
      <Path d="M50 4C27 4 10 21 10 43C10 70 50 112 50 112C50 112 90 70 90 43C90 21 73 4 50 4Z" fill={colors.coral} />
      <Path d="M67 13A10 10 0 0 1 74 25" stroke={colors.gold} strokeWidth={3} fill="none" strokeLinecap="round" />
      <Circle cx={54} cy={24} r={7} fill={colors.gold} />
      <Path d="M33 87Q49 91 67 87" stroke={figure} strokeWidth={4} fill="none" strokeLinecap="round" />
      <Path
        d="M52 35L47 56M51 40L60 31L65 19M51 40L39 41L31 34M47 56L52 69L48 82M47 56L36 62L38 74"
        stroke={figure}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
