// 웹 빌드용 빈 shim — 네이티브에서만 실제 모듈 사용
export const FirebaseAnalytics = {
  logEvent: async () => {},
  setCurrentScreen: async () => {},
  setUserProperty: async () => {},
  setUserId: async () => {},
};
