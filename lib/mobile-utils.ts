export const isMobileApp = (): boolean => {
    if (typeof window === 'undefined') return false;

    const userAgent = window.navigator.userAgent || '';

    // Check for specific User Agent set by the Android App
    // We check for:
    // 1. "BagmatiInventoryApp" (Custom)
    // 2. ";wv" (Standard WebView)
    // 3. "Version/" (Common in Android WebViews)
    const isCustomApp =
        /BagmatiInventoryApp/i.test(userAgent) ||
        /;wv/.test(userAgent) ||
        /Version\//.test(userAgent);

    if (isCustomApp) return true;

    return false;
}
