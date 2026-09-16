// Run this in extension DevTools console (background/service worker context)
// to enable GA4 product telemetry.
//
// Replace the placeholders locally before running this snippet. Never commit a
// real Measurement Protocol secret to the repository or extension package.

chrome.storage.local.set({
  ga4TelemetryEnabled: true,
  ga4MeasurementId: 'G-XXXXXXXXXX',
  ga4ApiSecret: 'YOUR_SECRET'
}, () => {
  console.log('GA4 telemetry config saved.');
});
