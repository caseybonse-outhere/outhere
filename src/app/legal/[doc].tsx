import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { fillContact, isLegalDoc, LEGAL_DOCS, LEGAL_UPDATED } from '../../lib/legal';
import { space, type } from '../../lib/theme';
import { Empty, Screen } from '../../lib/ui';

/** Terms, Community Guidelines, Privacy Policy and Support, readable without leaving the app. */
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  if (!isLegalDoc(doc)) return <Empty text="Page not found." />;
  const page = LEGAL_DOCS[doc];

  return (
    <Screen>
      <Stack.Screen options={{ title: page.title }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 }}>
        <Text style={type.small}>Last updated {LEGAL_UPDATED}</Text>
        <Text style={type.body}>{fillContact(page.intro)}</Text>
        {page.sections.map((s) => (
          <View key={s.heading} style={{ gap: space.sm }}>
            <Text style={type.h2}>{s.heading}</Text>
            {s.body.map((p, i) => (
              <Text key={i} style={type.body}>
                {fillContact(p)}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
