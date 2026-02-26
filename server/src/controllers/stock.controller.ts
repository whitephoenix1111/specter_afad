// ============================================================
// controllers/stock.controller.ts — Orchestrator của toàn bộ pipeline.
// Nhận ticker từ route, điều phối 4 bước xử lý tuần tự,
// quản lý in-memory cache để tránh gọi lại API trong 24h.
//
// Pipeline:
//   [1] NewsService.fetchNews()            → quét RSS, resolve URL, làm sạch
//   [2] ClassifyService.classify()         → Groq phân loại vào 4 nhóm
//   [3] ClassifyService.findFeaturedRisk() → chọn bài RỦI RO nổi bật, sinh summary
//   [4] ImageService.resolveImages()       → lấy ảnh RSS hoặc sinh AI
// ============================================================

import { NewsService } from "../services/news.service.js";
import { ClassifyService } from "../services/classify.service.js";
import { ImageService } from "../services/image.service.js";
import type { StockAnalysisResponse } from "../types/stock.js";

// Cấu trúc mỗi entry trong cache Map
interface CacheEntry {
  data: StockAnalysisResponse; // Kết quả đầy đủ đã xử lý xong
  cachedAt: Date;              // Thời điểm lưu — dùng để tính TTL còn lại
}

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24h tính bằng millisecond

export class StockController {
  private newsService: NewsService;
  private classifyService: ClassifyService;
  private imageService: ImageService;

  // Cache in-memory — key là ticker UPPERCASE (VD: "VIC"), value là CacheEntry.
  // Reset khi restart server. Không persist ra disk.
  private cache: Map<string, CacheEntry>;

  constructor() {
    this.newsService = new NewsService();
    this.classifyService = new ClassifyService();
    this.imageService = new ImageService();
    this.cache = new Map();
  }

  async analyze(ticker: string): Promise<{
    success: boolean;
    fromCache: boolean;
    data: StockAnalysisResponse | null;
    error: string | null;
  }> {
    // Normalize ticker: trim whitespace + uppercase để cache key nhất quán
    // VD: " vic " → "VIC", "hpg" → "HPG"
    const normalizedTicker = ticker.trim().toUpperCase();

    if (!normalizedTicker) {
      return { success: false, fromCache: false, data: null, error: "Ticker is required." };
    }

    // Kiểm tra cache trước khi gọi bất kỳ API nào
    const cached = this.cache.get(normalizedTicker);
    if (cached) {
      const age = Date.now() - cached.cachedAt.getTime();
      if (age < CACHE_DURATION_MS) {
        // Cache còn hạn → trả ngay, không chạy pipeline
        console.log(`[Cache HIT] ${normalizedTicker} — còn ${Math.round((CACHE_DURATION_MS - age) / 60000)} phút`);
        return { success: true, fromCache: true, data: cached.data, error: null };
      }
      // Cache hết hạn → sẽ bị ghi đè sau khi pipeline xong
      console.log(`[Cache EXPIRED] ${normalizedTicker}`);
    }

    try {
      // Bước 1: Fetch RSS và parse bài thô
      console.log(`\n[1/4] Quét tin tức cho ${normalizedTicker}...`);
      const rawArticles = await this.newsService.fetchNews(normalizedTicker);
      console.log(`      → ${rawArticles.length} bài`);

      // Bước 2: Groq phân loại tất cả bài trong 1 request
      console.log(`[2/4] Phân loại bằng Groq...`);
      const categorized = await this.classifyService.classify(normalizedTicker, rawArticles);
      console.log(`      → Xong`);

      // Bước 3: Tìm bài RỦI RO nổi bật + sinh summary (tối đa 2 Groq calls thêm)
      console.log(`[3/4] Tìm bài RỦI RO nổi bật...`);
      const withFeatured = await this.classifyService.findFeaturedRisk(categorized);
      console.log(`      → Xong`);

      // Bước 4: Resolve ảnh — chạy song song cho tất cả bài
      console.log(`[4/4] Lấy ảnh (RSS media + AI fallback)...`);
      const articlesWithImages = await this.imageService.resolveImages(withFeatured, normalizedTicker);
      console.log(`      → Xong\n`);

      const result: StockAnalysisResponse = {
        ticker: normalizedTicker,
        articles: articlesWithImages,
        cachedAt: new Date(),
      };

      // Lưu vào cache — ghi đè nếu đã có entry cũ (kể cả hết hạn)
      this.cache.set(normalizedTicker, { data: result, cachedAt: result.cachedAt });
      return { success: true, fromCache: false, data: result, error: null };

    } catch (err) {
      // Bất kỳ bước nào throw → log và trả error response về client
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Error] ${normalizedTicker}: ${message}`);
      return { success: false, fromCache: false, data: null, error: message };
    }
  }
}
