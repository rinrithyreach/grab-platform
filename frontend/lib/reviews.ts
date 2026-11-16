"use client";

/**
 * Store reviews. A few sample reviews ship with the demo; reviews written by the user
 * (from "Rate your order" on My orders) are saved in the browser and added on top.
 */
import { useSyncExternalStore } from "react";
import { createLocalStore } from "./local-store";
import { STORES } from "./catalog";

export interface Review {
  id: string;
  storeId: string;
  orderId?: string;
  name: string;
  rating: number;      // 1–5
  comment: string;
  /** Khmer version of the comment (sample reviews only). */
  km?: string;
  createdAt: string;
}

/** Sample reviews so store pages aren't empty in the demo. */
const SAMPLE: Review[] = [
  { id: "s1", storeId: "golden-noodle", name: "Sophea", rating: 5, comment: "Broth tastes like home. Arrived hot!", km: "ទឹកស៊ុបឆ្ងាញ់ដូចធ្វើនៅផ្ទះ។ មកដល់នៅក្ដៅៗ!", createdAt: "2026-10-02T11:20:00Z" },
  { id: "s2", storeId: "golden-noodle", name: "Mark", rating: 4, comment: "Great dumplings, noodles a little soft.", km: "នំប៉ាវឆ្ងាញ់ណាស់ គុយទាវទន់បន្តិច។", createdAt: "2026-10-18T05:40:00Z" },
  { id: "s3", storeId: "burger-yard", name: "Dara", rating: 5, comment: "Best cheeseburger in town.", km: "ឈីសប៊ឺហ្គឺឆ្ងាញ់ជាងគេក្នុងក្រុង។", createdAt: "2026-09-21T12:00:00Z" },
  { id: "s4", storeId: "burger-yard", name: "Lina", rating: 4, comment: "Fries were crispy, burger was juicy.", km: "ដំឡូងបំពងស្រួយ ប៊ឺហ្គឺមានជាតិទឹកល្អ។", createdAt: "2026-10-30T09:15:00Z" },
  { id: "s5", storeId: "rice-bowl", name: "Visal", rating: 5, comment: "Perfect breakfast pork rice.", km: "បាយសាច់ជ្រូកល្អឥតខ្ចោះសម្រាប់អាហារពេលព្រឹក។", createdAt: "2026-10-11T00:30:00Z" },
  { id: "s6", storeId: "pizza-lab", name: "Anna", rating: 4, comment: "Thin crust, fresh basil. A bit slow.", km: "នំស្ដើង ជីរនាងវងស្រស់។ យឺតបន្តិច។", createdAt: "2026-10-05T13:00:00Z" },
  { id: "s7", storeId: "sweet-spot", name: "Chenda", rating: 5, comment: "Brown sugar bubble tea is amazing 🧋", km: "តែទឹកដោះគោស្ករត្នោតឆ្ងាញ់ខ្លាំងណាស់ 🧋", createdAt: "2026-11-01T08:00:00Z" },
  { id: "s8", storeId: "green-bowl", name: "Rithy", rating: 4, comment: "Healthy and filling.", km: "ល្អសម្រាប់សុខភាព និងឆ្អែតល្អ។", createdAt: "2026-10-25T04:45:00Z" },
  { id: "s9", storeId: "daily-mart", name: "Kim", rating: 5, comment: "Fast grocery delivery, everything fresh.", km: "ដឹកជញ្ជូនលឿន ទំនិញស្រស់ទាំងអស់។", createdAt: "2026-10-28T02:10:00Z" },
  { id: "s10", storeId: "home-plus", name: "Sok", rating: 4, comment: "Good prices on detergent.", km: "តម្លៃសាប៊ូបោកខោអាវសមរម្យ។", createdAt: "2026-10-12T07:30:00Z" },
];

const store = createLocalStore<{ reviews: Review[] }>("grab-reviews-v1", { reviews: [] });
const useUserReviews = () => useSyncExternalStore(store.subscribe, store.get, store.getInitial).reviews;

export function addReview(review: Omit<Review, "id" | "createdAt">) {
  store.update((s) => ({
    reviews: [{ ...review, id: `r-${Date.now().toString(36)}`, createdAt: new Date().toISOString() }, ...s.reviews],
  }));
}

/** All reviews for a store (newest first) plus the average rating and count. */
export function useStoreReviews(storeId: string) {
  const mine = useUserReviews();
  const reviews = [...mine.filter((r) => r.storeId === storeId), ...SAMPLE.filter((r) => r.storeId === storeId)];
  const base = STORES.find((s) => s.id === storeId)?.rating ?? 0;
  // Blend the catalogue rating (worth ~20 past reviews) with the reviews shown here.
  const weight = 20;
  const average = reviews.length
    ? (base * weight + reviews.reduce((sum, r) => sum + r.rating, 0)) / (weight + reviews.length)
    : base;
  return { reviews, average: Math.round(average * 10) / 10, count: weight + reviews.length };
}

/** Order ids the user has already reviewed. */
export function useReviewedOrders() {
  return new Set(useUserReviews().flatMap((r) => (r.orderId ? [r.orderId] : [])));
}
