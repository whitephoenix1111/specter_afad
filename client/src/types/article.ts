// ============================================================
// types/article.ts
// Định nghĩa toàn bộ TypeScript types dùng ở phía client.
//
// File này là "hợp đồng" giữa server và client:
// mọi dữ liệu server trả về đều phải khớp với các type ở đây.
// Khi server thay đổi cấu trúc JSON → cập nhật file này trước.
// ============================================================


// ── 1. DANH MỤC BÀI BÁO ────────────────────────────────────
// Bốn nhóm chủ đề do Groq AI phân loại ở server.
// Giá trị phải khớp chính xác (kể cả dấu) với NewsCategory
// trong server/src/types/stock.ts — nếu lệch, filter sẽ trả về mảng rỗng.
export type NewsCategory =
  | "CÂN ĐỐI"       // Tin trung lập, nền tảng công ty
  | "TĂNG TRƯỞNG"   // Tin tích cực, triển vọng
  | "RỦI RO"        // Tin tiêu cực, cảnh báo
  | "DIỄN BIẾN GIÁ"; // Biến động giá cổ phiếu


// ── 2. BÀI BÁO ĐÃ PHÂN LOẠI ────────────────────────────────
// Khớp với interface CategorizedArticle ở server/src/types/stock.ts.
// Đây là đơn vị dữ liệu cơ bản — mỗi item trong mảng articles[] là 1 Article.
export interface Article {
  title: string;        // Tiêu đề bài báo (đã được server làm sạch đuôi " - Tên Báo")
  url: string;          // URL bài gốc (đã được server resolve qua redirect Google News)
  source: string;       // Tên báo nguồn (VD: "VnExpress", "CafeF")
  publishedAt: string;  // Thời điểm đăng, dạng ISO 8601 (VD: "2025-09-19T10:30:00.000Z")
  imageUrl: string;     // URL ảnh: ảnh từ RSS hoặc ảnh AI tạo rồi upload lên Cloudinary
  category: NewsCategory; // Nhóm chủ đề do AI phân loại

  // Hai field dưới chỉ có ở đúng 1 bài duy nhất trong mảng:
  // bài RỦI RO được AI chọn là nghiêm trọng nhất.
  isFeatured?: boolean; // true → bài này sẽ render ở HeroCard (chiếm 2 cột)
  summary?: string;     // Đoạn mô tả ~50 từ kiểu standfirst báo tài chính
}


// ── 3. CẤU TRÚC RESPONSE TỪ SERVER ─────────────────────────
// Khớp với JSON server trả về tại GET /api/stock/:ticker.
// Ví dụ response thật:
// {
//   "success": true,
//   "fromCache": false,
//   "data": {
//     "ticker": "VIC",
//     "articles": [ ...Article[] ],
//     "cachedAt": "2025-09-19T10:30:00.000Z"
//   }
// }
export interface StockApiResponse {
  success: boolean;   // false nếu server gặp lỗi nội bộ
  fromCache: boolean; // true → không có bài mới, server trả thẳng từ Firestore
  data: {
    ticker: string;       // Mã cổ phiếu viết hoa (VD: "VIC")
    articles: Article[];  // Tối đa 20 bài, sắp xếp mới nhất trước
    cachedAt: string;     // Thời điểm lần cuối Firestore được cập nhật (ISO 8601)
  };
}


// ── 4. TRẠNG THÁI FETCH Ở CLIENT ────────────────────────────
// Discriminated union — mỗi nhánh có shape riêng biệt.
// Dùng trong useStockNews hook và truyền xuống BentoGrid qua prop fetchState.
//
// Luồng chuyển trạng thái bình thường:
//   idle → loading → success
//   idle → loading → error
//
// TypeScript sẽ ép kiểm tra: khi status = "success" mới có trường data,
// khi status = "error" mới có trường message — tránh undefined runtime.
export type FetchState =
  | { status: "idle" }                                // Chưa search lần nào
  | { status: "loading" }                             // Đang chờ server phản hồi
  | { status: "success"; data: StockApiResponse["data"] } // Có data, sẵn sàng render
  | { status: "error"; message: string };             // Fetch thất bại, giữ mock data
