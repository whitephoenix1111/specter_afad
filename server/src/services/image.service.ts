// ============================================================
// services/image.service.ts — Bước 4 trong pipeline.
// Gắn ảnh vào từng bài báo theo thứ tự ưu tiên:
//   1. Ảnh từ <media:content> trong RSS — dùng luôn, không cần request thêm
//   2. Không có → sinh ảnh AI bằng HuggingFace FLUX.1-schnell
//      → Upload lên Cloudinary (overwrite theo publicId) → trả về URL công khai
//
// Tất cả bài chạy song song qua Promise.all.
// ============================================================

import { uploadToCloudinary } from "../firebase.js";
import type { CategorizedArticle } from "../types/stock.js";

export class ImageService {
  private readonly hfApiUrl =
    "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell";
  private readonly hfApiKey = process.env.HUGGINGFACE_API_KEY ?? "";

  // Gọi HuggingFace FLUX.1-schnell → nhận binary image → upload Cloudinary → trả URL.
  // publicId dạng "VIC_0" → Cloudinary lưu tại afad/VIC_0.jpg
  // Upload cùng publicId sẽ overwrite → không tích lũy ảnh thừa theo thời gian.
  private async generateAiImage(prompt: string, publicId: string): Promise<string> {
    const response = await fetch(this.hfApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.hfApiKey}`,
        "Content-Type": "application/json",
        "x-wait-for-model": "true", // Tự chờ nếu model đang cold start, tránh 503
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`HuggingFace error: ${response.status} — ${err}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Upload lên Cloudinary, overwrite nếu đã tồn tại
    const url = await uploadToCloudinary(buffer, publicId);
    return url;
  }

  // Tạo prompt tiếng Anh cho FLUX dựa trên category và keywords từ tiêu đề.
  // Mỗi bài có prompt riêng biệt để tránh ảnh trùng nhau giữa các bài cùng category.
  private buildPrompt(article: CategorizedArticle): string {
    const moodMap: Record<string, string> = {
      "CÂN ĐỐI":        "balanced scale, financial charts, calm blue tones, professional",
      "TĂNG TRƯỞNG":    "rising green arrows, modern cityscape, optimistic golden light",
      "RỦI RO":          "stormy sky, red warning signals, dramatic dark tones",
      "DIỄN BIẾN GIÁ":  "stock market candlestick chart, neon trading floor, dynamic",
    };
    const mood = moodMap[article.category] ?? "financial news, neutral tones";

    const titleKeywords = article.title
      .replace(/[^\w\sÀ-ỹ]/g, " ")
      .split(" ")
      .filter((w) => w.length > 3)
      .slice(0, 5)
      .join(", ");

    return `Vietnamese stock market news illustration, ${mood}, inspired by: ${titleKeywords}, cinematic 4k digital art, no text`;
  }

  // Điểm vào duy nhất của ImageService. Xử lý song song tất cả bài trong mảng.
  //
  // Mỗi bài:
  //   - Đã có imageUrl (từ RSS media:content) → giữ nguyên
  //   - Không có → sinh AI → upload Cloudinary → gắn URL vào bài
  //
  // publicId: "VIC_0", "VIC_3"... (index là vị trí trong mảng)
  // Lỗi HuggingFace/Cloudinary → imageUrl = "" (không throw, không chặn bài khác)
  async resolveImages(
    articles: CategorizedArticle[],
    ticker: string
  ): Promise<CategorizedArticle[]> {
    const results = await Promise.all(
      articles.map(async (article, i) => {

        // Ưu tiên 1: Đã có ảnh từ RSS → dùng luôn
        if (article.imageUrl) {
          console.log(`[Image] ✓ RSS media: ${article.title.slice(0, 50)}`);
          return article;
        }

        // Ưu tiên 2: Sinh ảnh AI → upload Cloudinary
        const publicId = `${ticker}_${i}`;
        console.log(`[Image] Generating AI → Cloudinary: ${publicId}`);
        try {
          const imageUrl = await this.generateAiImage(this.buildPrompt(article), publicId);
          console.log(`[Image] ✓ Uploaded: ${imageUrl}`);
          return { ...article, imageUrl };
        } catch (err) {
          console.error(`[Image] AI failed for ${publicId}: ${err instanceof Error ? err.message : err}`);
          return { ...article, imageUrl: "" };
        }
      })
    );

    return results;
  }
}
