export const colors = {
  coral: '#E8654A',
  coralDark: '#C44B32',
  gold: '#F2B33D',
  dusk: '#3B2A55',
  grass: '#3E8E5E',
  sand: '#FBF3E6',
  sand2: '#F3E4CC',
  night: '#1E1A24',
  muted: '#5A5163',
  line: 'rgba(30,26,36,0.12)',
  white: '#FFFFFF',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };

export const type = {
  title: { fontSize: 28, fontWeight: '800' as const, color: colors.night, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '800' as const, color: colors.night },
  body: { fontSize: 16, color: colors.night },
  small: { fontSize: 14, color: colors.muted },
  label: { fontSize: 13, fontWeight: '700' as const, color: colors.muted, textTransform: 'uppercase' as const, letterSpacing: 0.6 },
};
