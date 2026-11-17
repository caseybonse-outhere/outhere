// Adds the Android-only settings on top of app.json.
// Both values come from EAS environment variables (expo.dev → Project → Environment variables → production):
//   GOOGLE_MAPS_ANDROID_API_KEY  the Google Maps key for Android (map tiles)
//   GOOGLE_SERVICES_JSON         a "File" variable holding google-services.json from Firebase (push alerts)
// iOS builds are untouched: Apple Maps and Apple push need neither.
module.exports = ({ config }) => {
  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const googleServices = process.env.GOOGLE_SERVICES_JSON;
  const buildingIos = process.env.EAS_BUILD_PLATFORM === 'ios';

  return {
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
};
