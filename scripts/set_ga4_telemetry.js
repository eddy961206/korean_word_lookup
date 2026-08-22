// Run this in extension DevTools console (background/service worker context)
// to enable GA4 product telemetry.
//
// Credentials below were created in the "Korean Word Lookup - Extension" GA4
// property (a405499960p550967716) and validated against the MP debug endpoint.
// Rotate the secret if it ever leaks.

chrome.storage.local.set({
  ga4TelemetryEnabled: true,
  ga4MeasurementId: 'G-JDCGN36DHB',
  ga4ApiSecret: 'ApYUxu0gSvyuiRV_ShqW0g'
}, () => {
  console.log('GA4 telemetry config saved.');
});
