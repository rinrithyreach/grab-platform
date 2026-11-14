/** Demo pickup/drop-off points (Phnom Penh). Edit freely — the backend just needs a name + coordinates. */
export interface Place { name: string; km: string; lat: number; lng: number }

export const PLACES: Place[] = [
  { name: "Independence Monument", km: "វិមានឯករាជ្យ", lat: 11.5564, lng: 104.9282 },
  { name: "Royal Palace", km: "ព្រះបរមរាជវាំង", lat: 11.5636, lng: 104.9312 },
  { name: "Central Market", km: "ផ្សារធំថ្មី", lat: 11.5697, lng: 104.921 },
  { name: "Russian Market", km: "ផ្សារទួលទំពូង", lat: 11.5434, lng: 104.9178 },
  { name: "Wat Phnom", km: "វត្តភ្នំ", lat: 11.5765, lng: 104.9231 },
  { name: "Aeon Mall 1", km: "ផ្សារទំនើបអ៊ីអន ១", lat: 11.5486, lng: 104.9318 },
  { name: "Phnom Penh Airport", km: "អាកាសយានដ្ឋានភ្នំពេញ", lat: 11.5466, lng: 104.8441 },
];

/** Straight-line distance in km (haversine). */
export function distanceKm(a: Place, b: Place) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
