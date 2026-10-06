import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { PinLogo } from '../lib/logo';
import { shareLink, shareUrl, type ShareKind } from '../lib/share';
import { colors, radius, space, type } from '../lib/theme';
import { Button, Empty, Screen } from '../lib/ui';

/** Big QR code for a camp or spot — show it on your phone, or screenshot and print it for a sign. */
export default function ShareScreen() {
  const { kind, id, name } = useLocalSearchParams<{ kind: ShareKind; id: string; name?: string }>();
  const { width } = useWindowDimensions();
  if ((kind !== 'camp' && kind !== 'spot') || !id) return <Empty text="Nothing to share." />;
  const url = shareUrl(kind, id);
  const size = Math.min(width - space.xl * 4, 320);

  return (
    <Screen>
      <Stack.Screen options={{ title: kind === 'camp' ? 'Share camp' : 'Share spot' }} />
      <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg, alignItems: 'center' }}>
        <View style={{ backgroundColor: colors.white, borderRadius: radius.lg, padding: space.xl, alignItems: 'center', gap: space.md, borderWidth: 1, borderColor: colors.line }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <PinLogo size={28} />
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.night, letterSpacing: -0.5 }}>out here <Text style={{ color: colors.coralDark }}>now</Text></Text>
          </View>
          <Text style={[type.h2, { textAlign: 'center' }]} numberOfLines={2}>
            {name ?? (kind === 'camp' ? 'Camp' : 'Spot')}
          </Text>
          <QRCode value={url} size={size} color={colors.night} backgroundColor={colors.white} ecl="M" />
          <Text style={[type.small, { textAlign: 'center' }]}>Scan with your phone camera to open it in Out Here Now</Text>
        </View>
        <Text style={[type.small, { textAlign: 'center' }]}>Take a screenshot to print it for a sign at the {kind}.</Text>
        <View style={{ alignSelf: 'stretch' }}>
          <Button title="Share link" onPress={() => shareLink(kind, id, name ?? 'Out Here Now')} />
        </View>
      </ScrollView>
    </Screen>
  );
}
