// ============================================================
// controllers/stock.controller.ts — Orchestrator của toàn bộ pipeline.
//
// Thay đổi so với phiên bản cũ:
//   - Bỏ in-memory cache Map → dùng Firestore làm nguồn dữ liệu
//   - Logic incremental: chỉ xử lý bài MỚI chưa có trong Firestore
//     (so sánh qua article.url — unique identifier của mỗi bài)
//   - Merge bài mới vào Firestore, giữ tối đa MAX_ARTICLES_STORED bài gần nhất
//   - Không có bài mới → không gọi Groq/HuggingFace, tiết kiệm quota
//
// Pipeline (chỉ chạy cho bài mới):
//   [1] NewsService.fetchNews()            → quét RSS, resolve URL, làm sạch
//   [2] ClassifyService.classify()         → Groq phân loại vào 4 nhóm
//   [3] ClassifyService.findFeaturedRisk() → chọn bài RỦI RO nổi bật, sinh summary
//   [4] ImageService.resolveImages()       → lấy ảnh RSS hoặc sinh AI lên Cloudinary
// ============================================================

import { db } from "../firebase.js";
import { NewsService } from "../services/news.service.js";
import { ClassifyService } from "../services/classify.service.js";
import { ImageService } from "../services/image.service.js";
import type { CategorizedArticle, StockAnalysisResponse } from "../types/stock.js";

const COLLECTION = "stocks";           // Tên collection Firestore
const MAX_ARTICLES_STORED = 20;        // Giữ tối đa 20 bài gần nhất mỗi ticker

export class StockController {
  private newsService: NewsService;
  private classifyService: ClassifyService;
  private imageService: ImageService;

  constructor() {
    this.newsService = new NewsService();
    this.classifyService = new ClassifyService();
    this.imageService = new ImageService();
  }

  async analyze(ticker: string): Promise<{
    success: boolean;
    fromCache: boolean;
    data: StockAnalysisResponse | null;
    error: string | null;
  }> {
    const normalizedTicker = ticker.trim().toUpperCase();

    if (!normalizedTicker) {
      return { success: false, fromCache: false, data: null, error: "Ticker is required." };
    }

    try {
      // ── Đọc data hiện tại từ Firestore ───────────────────────────────────
      const docRef = db.collection(COLLECTION).doc(normalizedTicker);
      const docSnap = await docRef.get();

      const existingArticles: CategorizedArticle[] =
        docSnap.exists ? (docSnap.data()?.articles ?? []) : [];

      // Set các URL đã có → dùng để so sánh nhanh O(1)
      const existingUrls = new Set(existingArticles.map((a) => a.url));

      console.log(`\n[${normalizedTicker}] Firestore hiện có ${existingArticles.length} bài`);

      // ── Bước 1: Fetch RSS ─────────────────────────────────────────────────
      console.log(`[1/4] Quét RSS...`);
      const rawArticles = await this.newsService.fetchNews(normalizedTicker);
      console.log(`      → ${rawArticles.length} bài từ RSS`);

      // ── Lọc bài mới (chưa có trong Firestore) ────────────────────────────
      const newArticles = rawArticles.filter((a) => !existingUrls.has(a.url));
      console.log(`      → ${newArticles.length} bài MỚI chưa có trong Firestore`);

      if (newArticles.length === 0) {
        // Không có bài mới → trả thẳng data từ Firestore, không tốn quota
        console.log(`[${normalizedTicker}] Không có bài mới, trả data từ Firestore.\n`);
        const result: StockAnalysisResponse = {
          ticker: normalizedTicker,
          articles: existingArticles,
          cachedAt: docSnap.data()?.updatedAt?.toDate() ?? new Date(),
        };
        return { success: true, fromCache: true, data: result, error: null };
      }

      // ── Bước 2: Classify chỉ bài mới ─────────────────────────────────────
      console.log(`[2/4] Phân loại ${newArticles.length} bài mới bằng Groq...`);
      const categorized = await this.classifyService.classify(normalizedTicker, newArticles);
      console.log(`      → Xong`);

      // ── Bước 3: findFeaturedRisk trên toàn bộ (mới + cũ) ─────────────────
      // Merge tạm để tìm bài RỦI RO nổi bật trong toàn bộ context
      console.log(`[3/4] Tìm bài RỦI RO nổi bật...`);
      const mergedForFeatured = [...categorized, ...existingArticles];
      const withFeatured = await this.classifyService.findFeaturedRisk(mergedForFeatured);
      console.log(`      → Xong`);

      // ── Bước 4: Resolve ảnh chỉ cho bài mới ──────────────────────────────
      // Bài cũ đã có imageUrl rồi, không cần sinh lại
      console.log(`[4/4] Lấy ảnh cho ${newArticles.length} bài mới...`);
      const newCategorized = withFeatured.slice(0, categorized.length); // chỉ lấy phần bài mới
      const oldArticles    = withFeatured.slice(categorized.length);    // phần bài cũ giữ nguyên
      const newWithImages  = await this.imageService.resolveImages(newCategorized, normalizedTicker);
      console.log(`      → Xong\n`);

      // ── Merge và giới hạn số lượng ────────────────────────────────────────
      // Bài mới đứng đầu (mới nhất), bài cũ theo sau, cắt bớt nếu vượt MAX
      const mergedArticles = [...newWithImages, ...oldArticles].slice(0, MAX_ARTICLES_STORED);

      // ── Ghi vào Firestore ─────────────────────────────────────────────────
      const now = new Date();
      await docRef.set({
        ticker: normalizedTicker,
        articles: mergedArticles,
        updatedAt: now,
      });
      console.log(`[${normalizedTicker}] Đã lưu ${mergedArticles.length} bài vào Firestore.`);

      const result: StockAnalysisResponse = {
        ticker: normalizedTicker,
        articles: mergedArticles,
        cachedAt: now,
      };

      return { success: true, fromCache: false, data: result, error: null };

    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Error] ${normalizedTicker}: ${message}`);
      return { success: false, fromCache: false, data: null, error: message };
    }
  }
}
