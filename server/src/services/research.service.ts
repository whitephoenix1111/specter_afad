// ============================================================
// services/research.service.ts
// Chịu trách nhiệm gọi Groq API (model LLaMA 70B) để phân
// tích một mã cổ phiếu và trả về nhận định có cấu trúc JSON.
//
// Luồng hoạt động:
//   1. Nhận ticker (VD: "AAPL")
//   2. Xây dựng prompt yêu cầu LLM trả về JSON 6 trường
//   3. Gọi Groq, auto-retry nếu bị rate limit (tối đa 3 lần)
//   4. Parse JSON thô, validate đủ các trường bắt buộc
//   5. Chuẩn hoá sang StockAnalysisResponse rồi trả về
// ============================================================

import Groq from "groq-sdk";
import type { StockAnalysisResponse, StockAnalysisResult } from "../types/stock.js";

export class ResearchService {
  // Client SDK của Groq, dùng để gọi chat completions
  private groq: Groq;

  constructor() {
    // Bước khởi tạo: đọc API Key từ biến môi trường
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      // Ném lỗi ngay khi server khởi động nếu thiếu key — fail fast, dễ debug
      throw new Error("GROQ_API_KEY is not defined in environment variables.");
    }
    // Tạo Groq client với key vừa đọc được
    this.groq = new Groq({ apiKey });
  }

  /**
   * Phân tích một mã cổ phiếu bằng LLaMA 70B qua Groq.
   * @param ticker - Mã cổ phiếu đã chuẩn hoá (chữ hoa, không dấu cách)
   * @returns StockAnalysisResponse — kết quả hoàn chỉnh gồm insights + imagePrompt
   */
  async analyzeStock(ticker: string): Promise<StockAnalysisResponse> {

    // ── Bước 1: Xây dựng prompt ─────────────────────────────────────────────
    // Prompt yêu cầu LLM đóng vai chuyên gia tài chính, trả về JSON thuần.
    // - Tất cả các trường dùng tiếng Việt, TRỪ imagePrompt phải là tiếng Anh.
    // - Không có markdown, không có code fence — chỉ JSON thô.
    const prompt = `You are a senior financial analyst. 
    Task: Analyze the stock ticker "${ticker}" based on recent market data.
    Constraint: 
    - Language: Vietnamese for all fields EXCEPT imagePrompt.
    - imagePrompt: MUST be in English only, always.
    - Tone: Sharp, professional, technical.
    - Format: Strictly return a RAW JSON object. No markdown. No code fences.

    Output structure:
    {
      "Risk": "...(Vietnamese)...",
      "Outlook": "...(Vietnamese)...",
      "Technical": "...(Vietnamese)...",
      "Sentiment": "...(Vietnamese)...",
      "Flow": "...(Vietnamese)...",
      "imagePrompt": "...(English only - vivid, colorful, detailed digital art scene representing this stock. Include specific colors, mood, lighting, style. Example: 'A golden bull charging through a neon-lit city skyline at dusk, dramatic lighting, cinematic, 4k digital art')..."
    }`;

    // ── Bước 2: Gọi Groq với auto-retry khi bị Rate Limit (429) ─────────────
    // Groq miễn phí có giới hạn tốc độ gọi API.
    // Nếu bị 429, chờ 30s rồi thử lại, tối đa 3 lần trước khi ném lỗi thật.
    let content: string | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // Gọi Groq chat completion với model LLaMA 3.3 70B
        const completion = await this.groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,  // Sáng tạo vừa phải — không quá khô cứng, không quá ảo
          max_tokens: 1024,  // Giới hạn chiều dài response để tránh tốn token
        });

        // Lấy nội dung text từ response (choices[0] là kết quả đầu tiên)
        content = completion.choices[0]?.message?.content ?? null;
        break; // Gọi thành công → thoát vòng lặp

      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "";
        console.error(`[Groq RAW ERROR] attempt=${attempt}`, errMsg);

        // Kiểm tra xem lỗi có phải rate limit không
        const isRateLimit = errMsg.includes("429") || errMsg.includes("rate_limit");

        if (isRateLimit && attempt < 3) {
          // Chưa đến lần thử cuối → chờ rồi thử lại
          // Lần 1 thất bại → chờ 30s; lần 2 thất bại → chờ 60s
          const waitMs = attempt * 30000;
          console.log(`[Rate Limit] Chờ ${waitMs / 1000}s rồi thử lại (lần ${attempt}/3)...`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        } else {
          // Lỗi khác (network, auth, ...) hoặc đã hết lượt retry → ném ra ngoài
          throw err;
        }
      }
    }

    // Sau 3 lần thử mà vẫn không có nội dung → báo lỗi
    if (!content) throw new Error("Groq trả về response rỗng.");

    // ── Bước 3: Làm sạch response ────────────────────────────────────────────
    // Dù đã dặn "no code fences", LLM đôi khi vẫn trả về ```json ... ```
    // → Cắt bỏ phần markdown thừa để chỉ còn JSON thuần
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, "") // Xoá ``` hoặc ```json ở đầu
      .replace(/```\s*$/, "")            // Xoá ``` ở cuối
      .trim();

    // ── Bước 4: Parse JSON ───────────────────────────────────────────────────
    let parsed: StockAnalysisResult;
    try {
      parsed = JSON.parse(cleaned) as StockAnalysisResult;
    } catch {
      // Nếu parse thất bại, ném lỗi kèm raw response để debug dễ hơn
      throw new Error(`Failed to parse Groq response as JSON.\nRaw response:\n${content}`);
    }

    // ── Bước 5: Validate — đảm bảo đủ 5 trường phân tích bắt buộc ───────────
    // Nếu LLM bỏ sót trường nào thì báo lỗi rõ ràng thay vì để undefined lọt ra client
    const requiredCategories = ["Risk", "Outlook", "Technical", "Sentiment", "Flow"] as const;
    for (const cat of requiredCategories) {
      if (!parsed[cat]) {
        throw new Error(`Groq response missing required category: "${cat}"`);
      }
    }

    // ── Bước 6: Chuẩn hoá sang StockAnalysisResponse ─────────────────────────
    // Chuyển từ object phẳng (parsed) → mảng insights có cấu trúc rõ ràng hơn
    // Thêm metadata: ticker, imagePrompt, cachedAt (timestamp hiện tại)
    const analysisResponse: StockAnalysisResponse = {
      ticker: ticker.toUpperCase(),
      insights: requiredCategories.map((cat) => ({
        category: cat,
        content: parsed[cat], // Nội dung tiếng Việt của từng nhóm phân tích
      })),
      imagePrompt: parsed.imagePrompt,  // Prompt tiếng Anh dùng để sinh ảnh
      cachedAt: new Date(),             // Ghi lại thời điểm phân tích (dùng cho cache)
    };

    return analysisResponse;
  }
}
