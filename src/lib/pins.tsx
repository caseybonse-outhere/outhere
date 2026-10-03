import Ionicons from '@expo/vector-icons/Ionicons';
import { Linking, Platform, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { colors, radius, space, type } from './theme';
import { Button } from './ui';

export type LatLng = { lat: number; lng: number };
export type Pin = LatLng & { title: string; description?: string };

/** Close-in view (~400 m across) around a spot. */
function regionAround(c: LatLng) {
  return { latitude: c.lat, longitude: c.lng, latitudeDelta: 0.004, longitudeDelta: 0.004 };
}

/** Walking directions in Apple Maps (or Google Maps on Android) to an exact point. */
export function openDirections(p: LatLng, label = 'Meeting point') {
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${p.lat},${p.lng}&dirflg=w&q=${encodeURIComponent(label)}`
      : `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=walking`;
  Linking.openURL(url);
}

/**
 * Tap the map to drop a pin inside a spot ("by the rings, south end").
 * The pin marks a place, never a person.
 */
export function PinPicker({
  spot,
  value,
  onChange,
  hint,
}: {
  spot: LatLng & { name: string };
  value: LatLng | null;
  onChange: (p: LatLng | null) => void;
  hint: string;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <Text style={type.small}>{value ? 'Drag the pin or tap somewhere else to move it.' : hint}</Text>
      <View style={{ height: 220, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}>
        <MapView
          key={`${spot.lat},${spot.lng}`}
          style={{ flex: 1 }}
          initialRegion={regionAround(value ?? spot)}
          onPress={(e) => onChange({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
          accessibilityLabel={`Map of ${spot.name}. Tap to place the pin.`}
        >
          <Marker coordinate={{ latitude: spot.lat, longitude: spot.lng }} title={spot.name} pinColor={colors.dusk} opacity={0.6} />
          {value && (
            <Marker
              coordinate={{ latitude: value.lat, longitude: value.lng }}
              draggable
              onDragEnd={(e) => onChange({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
              pinColor={colors.coral}
            />
          )}
        </MapView>
      </View>
      {value && (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button title="Remove pin" variant="ghost" onPress={() => onChange(null)} />
        </View>
      )}
    </View>
  );
}

/** Small map showing one or more exact pins (meeting point, where lines are rigged), with directions. */
export function PinMap({ pins, height = 180 }: { pins: Pin[]; height?: number }) {
  if (pins.length === 0) return null;
  const lats = pins.map((p) => p.lat);
  const lngs = pins.map((p) => p.lng);
  const center = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 };
  const span = Math.max(0.003, (Math.max(...lats) - Math.min(...lats)) * 1.8, (Math.max(...lngs) - Math.min(...lngs)) * 1.8);

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ height, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}>
        <MapView
          style={{ flex: 1 }}
          initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: span, longitudeDelta: span }}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {pins.map((p, i) => (
            <Marker
              key={`${p.lat},${p.lng},${i}`}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              title={p.title}
              description={p.description ? `${p.description} · Tap for directions` : 'Tap for directions'}
              pinColor={colors.coral}
              onCalloutPress={() => openDirections(p, p.title)}
            />
          ))}
        </MapView>
      </View>
      {pins.length === 1 ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button title="Directions" variant="ghost" onPress={() => openDirections(pins[0], pins[0].title)} />
        </View>
      ) : (
        <Text style={type.small}>
          <Ionicons name="navigate-outline" size={14} color={colors.muted} /> Tap a pin, then its label, for directions.
        </Text>
      )}
    </View>
  );
}
