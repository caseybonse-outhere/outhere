import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchActiveSessions, fetchSpots } from '../../lib/data';
import { getApproxLocation } from '../../lib/device';
import { colors, radius, space } from '../../lib/theme';
import { DISCIPLINES, type Session, type Spot } from '../../lib/types';
import { Chip } from '../../lib/ui';

// Santa Monica, until we know where the member is.
const DEFAULT_REGION: Region = { latitude: 34.0036, longitude: -118.4905, latitudeDelta: 0.06, longitudeDelta: 0.06 };

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filter, setFilter] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchSpots().then(setSpots).catch(() => {});
      fetchActiveSessions().then(setSessions).catch(() => {});
    }, []),
  );

  useEffect(() => {
    getApproxLocation()
      .then((loc) => {
        if (loc) mapRef.current?.animateToRegion({ latitude: loc.lat, longitude: loc.lng, latitudeDelta: 0.08, longitudeDelta: 0.08 }, 600);
      })
      .catch(() => {});
  }, []);

  const liveCount = useMemo(() => {
    const m = new Map<string, number>();
    sessions.forEach((s) => m.set(s.spot_id, (m.get(s.spot_id) ?? 0) + 1));
    return m;
  }, [sessions]);

  const visible = filter ? spots.filter((s) => s.disciplines.includes(filter)) : spots;

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        onLongPress={(e) => {
          const { latitude, longitude } = e.nativeEvent.coordinate;
          router.push({ pathname: '/spot/new', params: { lat: String(latitude), lng: String(longitude) } });
        }}
      >
        {visible.map((spot) => {
          const live = liveCount.get(spot.id) ?? 0;
          return (
            <Marker
              key={spot.id}
              coordinate={{ latitude: spot.lat, longitude: spot.lng }}
              pinColor={live > 0 ? colors.gold : colors.coral}
              title={spot.name}
              description={live > 0 ? `${live} out here now · tap for details` : spot.disciplines.join(' · ')}
              onCalloutPress={() => router.push(`/spot/${spot.id}`)}
            />
          );
        })}
      </MapView>

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <Chip label="All" selected={!filter} onPress={() => setFilter(null)} />
          {DISCIPLINES.map((d) => (
            <Chip key={d} label={d} selected={filter === d} onPress={() => setFilter(filter === d ? null : d)} />
          ))}
        </ScrollView>
      </View>

      <View style={styles.bottom}>
        {sessions.length > 0 && (
          <Pressable
            accessibilityRole="button"
            style={styles.livePill}
            onPress={() => router.push(`/spot/${sessions[0].spot_id}`)}
          >
            <View style={styles.dot} />
            <Text style={styles.liveText}>
              {sessions.length} {sessions.length === 1 ? 'person' : 'people'} out here now
            </Text>
          </Pressable>
        )}
        <Text style={styles.hint}>Long-press the map to add a spot</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', left: 0, right: 0 },
  filters: { paddingHorizontal: space.lg, gap: space.sm },
  bottom: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg, alignItems: 'center', gap: space.sm },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.dusk,
    paddingHorizontal: space.lg,
    minHeight: 44,
    borderRadius: radius.pill,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },
  liveText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  hint: {
    backgroundColor: 'rgba(251,243,230,0.92)',
    color: colors.night,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    overflow: 'hidden',
    fontSize: 13,
  },
});
