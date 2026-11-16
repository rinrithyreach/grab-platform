import type { MerchantProfileRequest, MerchantServiceKind, RideMerchantRegistrationProfile } from "./api";

export const MERCHANT_SERVICES: { id: MerchantServiceKind; emoji: string; href: string }[] = [
  { id: "GrabRide", emoji: "🚗", href: "/ride" },
  { id: "GrabFood", emoji: "🍜", href: "/food" },
  { id: "GrabExpress", emoji: "📦", href: "/express" },
];

export const EMPTY_MERCHANT_PROFILE: MerchantProfileRequest = {
  service: "GrabFood", businessName: "", ownerName: "", contactPhone: "", email: "",
  address: "", city: "Phnom Penh", category: "", description: "", openingHours: "",
  motorcycleLicensePlate: "",
};

export function merchantRegistrationProfile(profile: MerchantProfileRequest): MerchantProfileRequest | RideMerchantRegistrationProfile {
  if (profile.service === "GrabRide") return {
    service: "GrabRide", ownerName: profile.ownerName.trim(), address: profile.address.trim(),
    motorcycleLicensePlate: profile.motorcycleLicensePlate?.trim() ?? "",
  };
  return { ...profile, email: profile.email?.trim() || null };
}
