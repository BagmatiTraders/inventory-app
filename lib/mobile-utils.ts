export const isMobileApp = (): boolean => {
    if (typeof window === 'undefined') return false;

    const userAgent = window.navigator.userAgent || '';

    // Check for specific User Agent set by the Android App
    // We strictly check for "BagmatiInventoryApp" OR standard Android WebView indicator ";wv"
    const isCustomApp = /BagmatiInventoryApp/i.test(userAgent) || /;wv/.test(userAgent);

    if (isCustomApp) return true;

    return false;
}
