// ============================================================
// services/image.service.ts — Bước 4 trong pipeline.
// Gắn ảnh vào từng bài báo theo thứ tự ưu tiên:
//   1. Ảnh từ <media:content> trong RSS — dùng luôn, không cần request thêm
//   2. Không có → sinh ảnh AI bằng HuggingFace FLUX.1-schnell
//
// Tất cả bài chạy song song qua Promise.all.
// Ảnh AI được lưu ra file .jpg để server cache lại — tránh gọi HuggingFace lần sau.
// ============================================================

import fs from "fs";
import path from "path";
import type { CategorizedArticle } from "../types/stock.js";

const IMAGES_DIR = path.resolve("public/images"); // VD: D:\AFAD\server\public\images

// Tạo thư mục khi module load lần đầu — tránh lỗi ENOENT khi writeFileSync
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

export class ImageService {
  // HuggingFace Inference API qua router — hỗ trợ queue và wait-for-model
  private readonly hfApiUrl =
    "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell";
  private readonly hfApiKey = process.env.HUGGINGFACE_API_KEY ?? "";

  // Gọi HuggingFace FLUX.1-schnell để sinh ảnh từ prompt text.
  // Response trả về binary image data (arrayBuffer) → lưu thẳng ra file .jpg.
  // Trả về URL ngắn gọn "/images/VIC_0.jpg" để client fetch qua HTTP.
  //
  // "x-wait-for-model": "true" — nếu model đang cold start, API tự chờ thay vì trả 503
  private async generateAiImage(prompt: string, filename: string): Promise<string> {
    const response = await fetch(this.hfApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.hfApiKey}`,
        "Content-Type": "application/json",
        "x-wait-for-model": "true",
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`HuggingFace error: ${response.status} — ${err}`);
    }

    // Đọc binary response → ghi ra file .jpg
    const buffer = await response.arrayBuffer();
    const filePath = path.join(IMAGES_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(buffer));

    return `/images/${filename}`; // URL tương đối, client gọi qua route GET /images/:filename
  }

  // Tạo prompt tiếng Anh cho FLUX dựa trên category và keywords từ tiêu đề.
  //
  // moodMap định nghĩa visual style cho từng nhóm tin:
  //   - CÂN ĐỐI      → trung tính, professional
  //   - TĂNG TRƯỞNG  → tích cực, ánh sáng vàng
  //   - RỦI RO       → tối, cảnh báo đỏ
  //   - DIỄN BIẾN GIÁ → neon, sàn giao dịch
  //
  // Keywords từ title được trích ra (tối đa 5 từ dài > 3 ký tự) và append vào prompt
  // để mỗi bài có prompt unique → tránh ảnh trùng nhau giữa các bài cùng category.
  private buildPrompt(article: CategorizedArticle): string {
    const moodMap: Record<string, string> = {
      "CÂN ĐỐI":       "balanced scale, financial charts, calm blue tones, professional",
      "TĂNG TRƯỞNG":   "rising green arrows, modern cityscape, optimistic golden light",
      "RỦI RO":         "stormy sky, red warning signals, dramatic dark tones",
      "DIỄN BIẾN GIÁ": "stock market candlestick chart, neon trading floor, dynamic",
    };
    const mood = moodMap[article.category] ?? "financial news, neutral tones";

    const titleKeywords = article.title
      .replace(/[^\w\sÀ-ỹ]/g, " ")  // Bỏ ký tự đặc biệt, giữ chữ cái và dấu tiếng Việt
      .split(" ")
      .filter((w) => w.length > 3)   // Chỉ lấy từ đủ dài, bỏ "và", "của", "là"...
      .slice(0, 5)                   // Tối đa 5 từ — đủ để phân biệt, không làm loãng prompt
      .join(", ");

    return `Vietnamese stock market news illustration, ${mood}, inspired by: ${titleKeywords}, cinematic 4k digital art, no text`;
  }

  // Điểm vào duy nhất của ImageService. Xử lý song song tất cả bài trong mảng.
  //
  // Mỗi bài:
  //   - Đã có imageUrl (từ RSS media:content) → giữ nguyên, không làm gì thêm
  //   - Không có imageUrl → sinh ảnh AI, lưu file, gắn URL mới vào bài
  //
  // Tên file: {TICKER}_{index}.jpg  VD: VIC_0.jpg, VIC_3.jpg
  // Index là vị trí bài trong mảng — bài có ảnh RSS không tạo file, index có thể bị skip.
  //
  // Nếu HuggingFace lỗi → log error, imageUrl = "" (không throw để không chặn các bài khác)
  async resolveImages(articles: CategorizedArticle[], ticker: string): Promise<CategorizedArticle[]> {
    const results = await Promise.all(
      articles.map(async (article, i) => {

        // Ưu tiên 1: Đã có ảnh từ RSS → dùng luôn
        if (article.imageUrl) {
          console.log(`[Image] ✓ RSS media: ${article.title.slice(0, 50)}`);
          return article;
        }

        // Ưu tiên 2: Sinh ảnh AI — lưu vào public/images/{TICKER}_{i}.jpg
        const filename = `${ticker}_${i}.jpg`;
        console.log(`[Image] Generating AI: ${filename}`);
        try {
          const imageUrl = await this.generateAiImage(this.buildPrompt(article), filename);
          return { ...article, imageUrl };
        } catch (err) {
          // Log lỗi nhưng không throw — để các bài khác vẫn có ảnh
          console.error(`[Image] AI failed: ${err instanceof Error ? err.message : err}`);
          return { ...article, imageUrl: "" }; // imageUrl rỗng, client tự handle fallback UI
        }
      })
    );

    return results;
  }
}
