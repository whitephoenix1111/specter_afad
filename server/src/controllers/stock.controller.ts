// ============================================================
// controllers/stock.controller.ts
// Điều phối toàn bộ luồng xử lý cho một yêu cầu phân tích cổ phiếu.
//
// Luồng hoạt động khi nhận ticker:
//   1. Chuẩn hoá ticker (trim + uppercase)
//   2. Kiểm tra cache in-memory — nếu còn hạn (< 24h) thì trả luôn
//   3. Nếu cache miss / hết hạn → gọi ResearchService (Groq/LLM)
//   4. Gọi ImageService (HuggingFace) để sinh ảnh minh hoạ
//   5. Ghép kết quả + lưu vào cache
//   6. Trả về cho caller (index.ts → client)
// ============================================================

import { ResearchService } from "../services/research.service.js";
import { ImageService } from "../services/image.service.js";
import type { StockAnalysisResponse } from "../types/stock.js";

// Kiểu dữ liệu của một entry trong cache.
// Lưu cả data (kết quả hoàn chỉnh) lẫn cachedAt (để tính tuổi cache).
interface CacheEntry {
  data: StockAnalysisResponse;
  cachedAt: Date;
}

// Kết quả cache hết hạn sau 24 giờ.
// Giá trị tính bằng milliseconds để so với Date.now().
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24h

export class StockController {
  private researchService: ResearchService; // Gọi Groq để phân tích text
  private imageService: ImageService;       // Gọi HuggingFace để sinh ảnh
  private cache: Map<string, CacheEntry>;   // Cache in-memory, key = ticker (VD: "AAPL")

  constructor() {
    // Khởi tạo các service và cache ngay khi controller được tạo
    this.researchService = new ResearchService();
    this.imageService = new ImageService();
    this.cache = new Map();
  }

  /**
   * Phân tích một mã cổ phiếu — có cache 24h.
   * @param ticker - Mã cổ phiếu nhận từ URL (VD: "aapl", "TSLA", "BRK.B")
   * @returns Object chứa success flag, fromCache flag, data, và error (nếu có)
   */
  async analyze(ticker: string): Promise<{
    success: boolean;
    fromCache: boolean;
    data: StockAnalysisResponse | null;
    error: string | null;
  }> {

    // ── Bước 1: Chuẩn hoá ticker ─────────────────────────────────────────────
    // Loại bỏ khoảng trắng thừa, chuyển sang chữ hoa
    // để cache key nhất quán (không bị "aapl" vs "AAPL" cache miss)
    const normalizedTicker = ticker.trim().toUpperCase();

    // Guard: ticker rỗng sau khi trim → trả lỗi ngay, không gọi API
    if (!normalizedTicker) {
      return { success: false, fromCache: false, data: null, error: "Ticker is required." };
    }

    // ── Bước 2: Kiểm tra cache in-memory ─────────────────────────────────────
    const cached = this.cache.get(normalizedTicker);
    if (cached) {
      // Tính xem entry này đã được cache bao lâu rồi (ms)
      const age = Date.now() - cached.cachedAt.getTime();

      if (age < CACHE_DURATION_MS) {
        // Cache còn hợp lệ → trả luôn, không tốn API call
        console.log(`[Cache HIT] ${normalizedTicker} — còn ${Math.round((CACHE_DURATION_MS - age) / 60000)} phút`);
        return { success: true, fromCache: true, data: cached.data, error: null };
      }

      // Cache đã quá 24h → đánh dấu expired, bước tiếp theo sẽ fetch lại
      console.log(`[Cache EXPIRED] ${normalizedTicker} — fetch lại từ API`);
    }

    try {
      // ── Bước 3: Gọi ResearchService → Groq (LLaMA 70B) ──────────────────────
      // Kết quả là StockAnalysisResponse chứa insights (tiếng Việt) + imagePrompt (tiếng Anh)
      console.log(`[Research] Đang phân tích ${normalizedTicker}...`);
      const analysis = await this.researchService.analyzeStock(normalizedTicker);

      // ── Bước 4: Gọi ImageService → HuggingFace (FLUX.1-schnell) ─────────────
      // Dùng imagePrompt từ bước 3 để sinh ảnh minh hoạ cho cổ phiếu
      // Kết quả là chuỗi base64 Data URL
      console.log(`[Image] Đang tạo ảnh cho ${normalizedTicker}...`);
      const imageUrl = await this.imageService.generateImageUrl(analysis.imagePrompt);

      // ── Bước 5: Ghép kết quả hoàn chỉnh ─────────────────────────────────────
      // Spread toàn bộ analysis + gắn thêm imageUrl vừa tạo
      const result: StockAnalysisResponse = {
        ...analysis,
        imageUrl,
      };

      // ── Bước 6: Lưu vào cache ────────────────────────────────────────────────
      // Key = ticker chuẩn hoá; cachedAt lấy từ chính result để đồng bộ timestamp
      this.cache.set(normalizedTicker, { data: result, cachedAt: result.cachedAt });
      console.log(`[Cache SET] ${normalizedTicker} — lưu lúc ${result.cachedAt.toISOString()}`);

      // ── Bước 7: Trả về cho caller ────────────────────────────────────────────
      return { success: true, fromCache: false, data: result, error: null };

    } catch (err) {
      // Bất kỳ lỗi nào từ Groq hoặc HuggingFace đều bị bắt tại đây
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Error] ${normalizedTicker}: ${message}`);
      return { success: false, fromCache: false, data: null, error: message };
    }
  }
}
