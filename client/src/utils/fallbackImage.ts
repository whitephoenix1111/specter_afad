// ============================================================
// utils/fallbackImage.ts
// Map category → ảnh fallback tĩnh local khi imageUrl từ server rỗng.
//
// Dùng khi: HuggingFace/Cloudinary thất bại → server trả imageUrl: ""
// SVG được thiết kế riêng theo visual của từng category:
//   CÂN ĐỐI       → biểu đồ đường xanh dương, dao động ổn định
//   TĂNG TRƯỞNG   → cột xanh lá tăng dần, mũi tên đi lên
//   RỦI RO         → nến Nhật đỏ, nền tối, tam giác cảnh báo
//   DIỄN BIẾN GIÁ → đường giá vàng neon, volume bars, nền đêm
// ============================================================

import type { SyntheticEvent } from "react";

export type NewsCategory = "CÂN ĐỐI" | "TĂNG TRƯỞNG" | "RỦI RO" | "DIỄN BIẾN GIÁ";

const FALLBACK_MAP: Record<NewsCategory, string> = {
  "CÂN ĐỐI":       "/fallbacks/can-doi.svg",
  "TĂNG TRƯỞNG":   "/fallbacks/tang-truong.svg",
  "RỦI RO":         "/fallbacks/rui-ro.svg",
  "DIỄN BIẾN GIÁ": "/fallbacks/dien-bien-gia.svg",
};

const DEFAULT_FALLBACK = "/fallbacks/can-doi.svg";

/**
 * Trả về URL ảnh để hiển thị:
 * - Nếu imageUrl có giá trị → dùng luôn
 * - Nếu rỗng → trả ảnh fallback SVG theo category
 */
export function resolveImageUrl(imageUrl: string | undefined, category: string): string {
  if (imageUrl) return imageUrl;
  return FALLBACK_MAP[category as NewsCategory] ?? DEFAULT_FALLBACK;
}

/**
 * onError handler cho thẻ <img> — tránh vòng lặp vô hạn khi cả fallback cũng lỗi.
 * Dùng inline: onError={makeOnError(category)}
 */
export function makeOnError(category: string) {
  const fallback = FALLBACK_MAP[category as NewsCategory] ?? DEFAULT_FALLBACK;
  return (e: SyntheticEvent<HTMLImageElement>) => {
    const t = e.target as HTMLImageElement;
    if (t.src !== window.location.origin + fallback) {
      t.src = fallback;
    }
  };
}
