// External directions link: one documented Google Maps universal URL.
// It opens the buyer's own maps app when installed and the browser otherwise.
// No API key, no tracking parameters, and this app calculates no route itself.
export function directionsUrl(latitude: number, longitude: number): string {
  if (
    typeof latitude !== "number" || !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
    typeof longitude !== "number" || !Number.isFinite(longitude) || Math.abs(longitude) > 180
  ) throw new Error("INVALID_DIRECTIONS_PIN");
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}
