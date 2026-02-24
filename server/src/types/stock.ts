// ============================================================
// types/stock.ts
// Định nghĩa các kiểu dữ liệu (TypeScript interfaces) dùng
// xuyên suốt toàn bộ server.
// ============================================================

// Một "insight" (nhận định) cho một cổ phiếu.
// category: tên nhóm phân tích (Risk, Outlook, ...)
// content : nội dung phân tích bằng tiếng Việt
export interface StockInsight {
  category: 'Risk' | 'Outlook' | 'Technical' | 'Sentiment' | 'Flow';
  content: string;
}

// Cấu trúc JSON thô mà Groq/LLM trả về.
// Mỗi field là một chuỗi văn bản phân tích tương ứng với từng nhóm.
// imagePrompt: mô tả ảnh bằng tiếng Anh để truyền cho AI sinh ảnh.
export interface StockAnalysisResult {
  Risk: string;
  Outlook: string;
  Technical: string;
  Sentiment: string;
  Flow: string;
  imagePrompt: string;
}

// Cấu trúc hoàn chỉnh sau khi server xử lý xong,
// được trả về cho client qua API.
// - ticker    : mã cổ phiếu (VD: "AAPL")
// - insights  : mảng các nhận định (đã chuẩn hoá từ StockAnalysisResult)
// - imagePrompt: prompt gốc dùng để sinh ảnh
// - imageUrl  : ảnh base64 do HuggingFace tạo ra (tuỳ chọn, có thể undefined nếu chưa tạo)
// - cachedAt  : thời điểm kết quả được lưu vào cache
export interface StockAnalysisResponse {
  ticker: string;
  insights: StockInsight[];
  imagePrompt: string;
  imageUrl?: string | undefined;
  cachedAt: Date;
}
