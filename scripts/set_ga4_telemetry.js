// Run this in extension DevTools console (background/service worker context)
// to enable GA4 product telemetry.

chrome.storage.local.set({
  ga4TelemetryEnabled: true,
  ga4MeasurementId: 'G-PB14GLX6WP',
  ga4ApiSecret: 'REPLACE_WITH_YOUR_API_SECRET'
}, () => {
  console.log('GA4 telemetry config saved.');
});
