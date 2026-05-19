/**
 * Must match `android.namespace` / `applicationId` in `android/app/build.gradle`.
 * Used by the React Native Gradle plugin to generate `ReactNativeApplicationEntryPoint.java`
 * (references `BuildConfig`).
 */
module.exports = {
  project: {
    android: {
      packageName: 'in.onesaas.attendance',
    },
  },
};
