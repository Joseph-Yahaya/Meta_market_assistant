// Plain words for device-location failures. Each caller passes its own
// fallback phrase because the buyer and trader screens recover differently.
// Codes follow GeolocationPositionError: 1 blocked, 2 unavailable, 3 timeout.
export function locationErrorMessage(code: number, fallback: string): string {
  if (code === 1)
    return `Location is blocked for this site. Click the lock or tune icon in the browser address bar, set Location to Allow, then try again. You can also ${fallback}.`;
  if (code === 2) return `Your device could not determine its location. Please ${fallback} instead.`;
  return `Reading your location took too long. Please try again, or ${fallback}.`;
}
