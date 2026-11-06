// 원격 분석은 2.5.3에서 제거되었습니다. 이 파일은 이전 설정을 정리하는 용도입니다.
// 신뢰된 확장 프로그램 서비스 워커 콘솔에서만 실행하세요.
chrome.storage.local.remove([
  'ga4TelemetryEnabled', 'ga4MeasurementId', 'ga4ApiSecret',
  'analyticsClientId', 'analyticsSessionId'
]);
