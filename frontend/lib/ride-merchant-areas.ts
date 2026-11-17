import type { RideMerchantArea } from "./api";
import { readDeviceRideLocation, rideLocationSelection } from "./merchant-location";
import { MERCHANT_AREA_CENTRES } from "./merchant-area-centres";

export interface RideMerchantMapArea extends RideMerchantArea { position: [number, number]; approximate: boolean }

export function rideMerchantMapArea(merchant: RideMerchantArea): RideMerchantMapArea | null {
  const gps = readDeviceRideLocation(merchant.address);
  if (gps) return { ...merchant, position: [gps.latitude, gps.longitude], approximate: false };
  const selection = rideLocationSelection(merchant.address);
  const position = MERCHANT_AREA_CENTRES.sangkats[selection.sangkatCode]
    ?? MERCHANT_AREA_CENTRES.districts[selection.districtCode]
    ?? (/^Phnom\s+Penh$/i.test(merchant.address.trim()) ? MERCHANT_AREA_CENTRES.city : null);
  return position ? { ...merchant, position, approximate: true } : null;
}

export function groupRideMerchantAreas(areas: RideMerchantMapArea[]) {
  const groups = new Map<string, { position: [number, number]; merchants: RideMerchantMapArea[] }>();
  for (const merchant of areas) {
    const key = merchant.position.map((coordinate) => coordinate.toFixed(6)).join(",");
    const group = groups.get(key);
    if (group) group.merchants.push(merchant);
    else groups.set(key, { position: merchant.position, merchants: [merchant] });
  }
  return [...groups.values()];
}

/** Leaflet treats strings as HTML. Merchant-provided text must use textContent. */
export function rideMerchantPopup(merchant: RideMerchantMapArea, labels: { location: string; hours: string; noHours: string }) {
  const content = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = merchant.name;
  const location = document.createElement("p");
  location.textContent = `${labels.location}: ${merchant.address}`;
  const hours = document.createElement("p");
  hours.textContent = `${labels.hours}: ${merchant.openingHours || labels.noHours}`;
  content.append(name, location, hours);
  return content;
}
