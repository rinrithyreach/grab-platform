import { PHNOM_PENH_DISTRICTS } from "./phnom-penh";

export function manualRideLocation(districtCode: string, sangkatCode: string): string {
  const district = PHNOM_PENH_DISTRICTS.find((item) => item.code === districtCode);
  const sangkat = district?.sangkats.find((item) => item.code === sangkatCode);
  return district && sangkat ? `${sangkat.name}, Khan ${district.name}, Phnom Penh` : "";
}

export function rideLocationSelection(value: string): { districtCode: string; sangkatCode: string } {
  for (const district of PHNOM_PENH_DISTRICTS) {
    const sangkat = district.sangkats.find((item) => manualRideLocation(district.code, item.code) === value);
    if (sangkat) return { districtCode: district.code, sangkatCode: sangkat.code };
  }
  return { districtCode: "", sangkatCode: "" };
}

export interface DeviceLocation { latitude: number; longitude: number; accuracy: number | null }
export type LocationFailure = "permission" | "timeout" | "unavailable" | "unsupported" | "insecure";
export class DeviceLocationError extends Error {
  constructor(public reason: LocationFailure) { super(reason); }
}

function validCoordinates(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export function deviceRideLocation(location: Pick<DeviceLocation, "latitude" | "longitude">): string {
  return validCoordinates(location.latitude, location.longitude)
    ? `GPS: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}` : "";
}

export function readDeviceRideLocation(value: string): Pick<DeviceLocation, "latitude" | "longitude"> | null {
  const match = /^GPS: (-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)$/.exec(value);
  if (!match) return null;
  const latitude = Number(match[1]), longitude = Number(match[2]);
  return validCoordinates(latitude, longitude) ? { latitude, longitude } : null;
}

/** Called when the user selects current location or retries, never on mount or while typing. */
export function getDeviceLocation(geolocation: Pick<Geolocation, "getCurrentPosition"> | undefined, secureContext: boolean): Promise<DeviceLocation> {
  if (!secureContext) return Promise.reject(new DeviceLocationError("insecure"));
  if (!geolocation) return Promise.reject(new DeviceLocationError("unsupported"));
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(({ coords }) => {
      if (!validCoordinates(coords.latitude, coords.longitude)) { reject(new DeviceLocationError("unavailable")); return; }
      resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: Number.isFinite(coords.accuracy) && coords.accuracy >= 0 ? coords.accuracy : null });
    }, (error) => reject(new DeviceLocationError(error.code === 1 ? "permission" : error.code === 3 ? "timeout" : "unavailable")),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
}
