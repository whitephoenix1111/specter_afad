// ============================================================
// types/stock.ts — Toàn bộ TypeScript interfaces dùng chung
//                  giữa các service và controller.
// ============================================================

// 4 nhóm phân loại tin tức. Groq phải trả về đúng một trong các giá trị này.
// Fallback về "CÂN ĐỐI" nếu Groq trả giá trị ngoài danh sách.
export type NewsCategory = "CÂN ĐỐI" | "TĂNG TRƯỞNG" | "RỦI RO" | "DIỄN BIẾN GIÁ";

// Bài báo thô — output của NewsService, input của ClassifyService.
// imageUrl là optional: có nếu RSS trả về <media:content>, không có thì ImageService sẽ sinh AI.
export interface NewsArticle {
  title: string;        // Tiêu đề đã bỏ đuôi " - Tên Báo" nếu trùng source
  source: string;       // Tên báo, lấy từ <source> tag hoặc domain URL
  url: string;          // URL thật của bài (đã resolve redirect từ news.google.com)
  publishedAt: string;  // ISO 8601, VD: "2026-02-26T08:30:00.000Z"
  imageUrl?: string;    // URL ảnh từ <media:content> trong RSS, undefined nếu không có
}

// Bài báo đã phân loại — output của ClassifyService, input của ImageService.
// Extends NewsArticle, thêm 3 field mới.
export interface CategorizedArticle extends NewsArticle {
  category: NewsCategory; // Nhóm chủ đề do Groq phân loại

  // Chỉ có trên đúng 1 bài trong toàn bộ mảng — bài RỦI RO nghiêm trọng nhất.
  // Các bài còn lại không có field này (undefined).
  isFeatured?: boolean;

  // Đoạn standfirst ~50 từ do Groq sinh, chỉ có khi isFeatured = true.
  // Mô tả rủi ro cốt lõi theo giọng báo chí tài chính chuyên nghiệp.
  summary?: string;
}

// Kết quả cuối cùng trả về client qua GET /api/stock/:ticker.
export interface StockAnalysisResponse {
  ticker: string;                  // Mã cổ phiếu đã normalize (UPPERCASE)
  articles: CategorizedArticle[];  // Tất cả bài đã phân loại + có ảnh + featured nếu có
  cachedAt: Date;                  // Thời điểm data được cache, dùng để tính TTL còn lại
}
