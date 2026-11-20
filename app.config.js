// Adds the Android-only settings on top of app.json.
// Both values come from EAS environment variables (expo.dev → Project → Environment variables → production):
//   GOOGLE_MAPS_ANDROID_API_KEY  the Google Maps key for Android (map tiles)
//   GOOGLE_SERVICES_JSON         a "File" variable holding google-services.json from Firebase (push alerts)
// iOS builds are untouched: Apple Maps and Apple push need neither.
const { withAndroidManifest } = require('expo/config-plugins');

// The app is portrait-only, which makes Android treat "portrait screen" as required hardware and hides the app
// from devices that can't rotate (Chromebooks, XR headsets). Mark it optional so Google Play doesn't flag it.
const withOptionalPortrait = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const features = (manifest['uses-feature'] ??= []);
    const name = 'android.hardware.screen.portrait';
    const existing = features.find((f) => f.$?.['android:name'] === name);
    if (existing) existing.$['android:required'] = 'false';
    else features.push({ $: { 'android:name': name, 'android:required': 'false' } });
    return cfg;
  });

module.exports = ({ config }) => {
  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const googleServices = process.env.GOOGLE_SERVICES_JSON;
  const buildingIos = process.env.EAS_BUILD_PLATFORM === 'ios';

  const result = {
    ...config,
    android: {
      ...config.android,
      ...(googleServices ? { googleServicesFile: googleServices } : {}),
    },
    plugins: [
      ...config.plugins,
      ...(mapsKey && !buildingIos ? [['react-native-maps', { androidGoogleMapsApiKey: mapsKey }]] : []),
    ],
  };
  return withOptionalPortrait(result);
};
