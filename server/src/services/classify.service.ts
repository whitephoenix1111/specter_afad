// ============================================================
// services/classify.service.ts — Bước 2 và 3 trong pipeline.
// Dùng Groq (LLaMA 70B) để:
//   [classify]          Phân loại tất cả bài vào 4 nhóm chủ đề trong 1 request
//   [findFeaturedRisk]  Tìm bài RỦI RO nghiêm trọng nhất, sinh summary báo chí
//
// Cả hai method đều có retry tối đa 3 lần khi gặp rate limit 429.
// ============================================================

import Groq from "groq-sdk";
import type { NewsArticle, CategorizedArticle, NewsCategory } from "../types/stock.js";

// Danh sách category hợp lệ — dùng để validate output của Groq
const VALID_CATEGORIES: NewsCategory[] = ["CÂN ĐỐI", "TĂNG TRƯỞNG", "RỦI RO", "DIỄN BIẾN GIÁ"];

export class ClassifyService {
  private groq: Groq;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not defined.");
    this.groq = new Groq({ apiKey });
  }

  // Phân loại toàn bộ danh sách bài báo vào 4 nhóm trong MỘT Groq request duy nhất.
  // Gửi tất cả tiêu đề cùng lúc thay vì gọi từng bài — tiết kiệm token và latency.
  //
  // Groq trả về JSON map: { "0": "TĂNG TRƯỞNG", "1": "RỦI RO", ... }
  // Index trong map tương ứng với index bài trong mảng articles.
  //
  // Retry khi 429: attempt 1 → chờ 30s, attempt 2 → chờ 60s, attempt 3 → throw.
  async classify(ticker: string, articles: NewsArticle[]): Promise<CategorizedArticle[]> {
    if (articles.length === 0) return [];

    // Gộp tất cả tiêu đề thành 1 block text, mỗi bài 1 dòng có index
    // Slice 200 ký tự để tránh prompt quá dài, tiêu đề báo thường đủ trong 200 ký tự
    const articleList = articles
      .map((a, i) => `[${i}] ${a.title}`.slice(0, 200))
      .join("\n");

    const prompt = `Bạn là chuyên gia phân tích tài chính Việt Nam.
Dưới đây là danh sách tin tức về cổ phiếu "${ticker}".
Hãy phân loại mỗi tin vào ĐÚNG MỘT trong 4 nhóm sau:
- "CÂN ĐỐI"      : Tin về tài chính, kết quả kinh doanh, báo cáo, dòng tiền, cổ tức
- "TĂNG TRƯỞNG"  : Tin về mở rộng, dự án mới, hợp tác, triển vọng tích cực
- "RỦI RO"       : Tin về rủi ro, kiện tụng, sụt giảm, cảnh báo, vấn đề pháp lý
- "DIỄN BIẾN GIÁ": Tin về giá cổ phiếu, khối lượng giao dịch, kỹ thuật, thị trường

Danh sách tin:
${articleList}

Trả về ĐÚNG một JSON object duy nhất, không markdown, không giải thích:
{ "0": "TÊN_NHÓM", "1": "TÊN_NHÓM", ... }`;

    let content: string | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const completion = await this.groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,  // Rất thấp — phân loại cần nhất quán, không cần sáng tạo
          max_tokens: 512,   // Đủ cho JSON map 10 bài
        });
        content = completion.choices[0]?.message?.content ?? null;
        break; // Thành công → thoát vòng retry
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "";
        const isRateLimit = errMsg.includes("429") || errMsg.includes("rate_limit");
        if (isRateLimit && attempt < 3) {
          const waitMs = attempt * 30000; // 30s, 60s
          console.log(`[Classify RateLimit] Chờ ${waitMs / 1000}s...`);
          await new Promise((r) => setTimeout(r, waitMs));
        } else throw err; // Lỗi khác hoặc hết retry → throw lên controller
      }
    }

    if (!content) throw new Error("Groq trả về response rỗng khi phân loại.");

    // Groq đôi khi bọc JSON trong ```json ... ``` — strip ra trước khi parse
    const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    let categoryMap: Record<string, string>;
    try {
      categoryMap = JSON.parse(cleaned);
    } catch {
      throw new Error(`Không parse được JSON phân loại:\n${content}`);
    }

    // Ghép category vào từng bài theo index.
    // toUpperCase() để normalize — đề phòng Groq trả "rủi ro" thay vì "RỦI RO".
    // Fallback "CÂN ĐỐI" nếu giá trị không nằm trong VALID_CATEGORIES.
    return articles.map((article, i) => {
      const raw = categoryMap[String(i)]?.trim().toUpperCase() as NewsCategory;
      const category: NewsCategory = VALID_CATEGORIES.includes(raw) ? raw : "CÂN ĐỐI";
      return { ...article, category };
    });
  }

  // Tìm 1 bài RỦI RO nghiêm trọng nhất trong mảng đã phân loại,
  // đánh dấu isFeatured = true và sinh summary kiểu standfirst báo chí (~50 từ).
  //
  // Logic chọn bài:
  //   - 0 bài RỦI RO → trả nguyên mảng, không làm gì
  //   - 1 bài RỦI RO → chọn luôn, không tốn thêm Groq call
  //   - >1 bài RỦI RO → 1 Groq call nhỏ (max_tokens=8) để chọn index nghiêm trọng nhất
  //
  // Sau khi chọn xong → 1 Groq call nữa để sinh summary cho bài đó.
  // Tổng cộng tối đa 2 Groq call trong method này.
  async findFeaturedRisk(articles: CategorizedArticle[]): Promise<CategorizedArticle[]> {
    // Map để giữ originalIndex (vị trí trong mảng gốc) trước khi filter
    // Cần originalIndex để biết phải gắn isFeatured vào bài nào sau khi xử lý xong
    const riskArticles = articles
      .map((a, originalIndex) => ({ ...a, originalIndex }))
      .filter((a) => a.category === "RỦI RO");

    if (riskArticles.length === 0) {
      console.log("[Featured] Không có bài RỦI RO, bỏ qua.");
      return articles; // Trả nguyên mảng, không thay đổi gì
    }

    let chosenRiskIndex = 0; // Index trong riskArticles (không phải mảng gốc)

    if (riskArticles.length > 1) {
      // Gửi danh sách bài RỦI RO cho Groq, yêu cầu chọn index nghiêm trọng nhất
      // max_tokens=8 vì chỉ cần trả về 1 con số (VD: "2")
      const riskList = riskArticles
        .map((a, i) => `[${i}] Tiêu đề: ${a.title}\nNguồn: ${a.source}`)
        .join("\n\n");

      const selectionPrompt = `Bạn là chuyên gia phân tích rủi ro tài chính Việt Nam.
Dưới đây là các tin tức thuộc nhóm RỦI RO:

${riskList}

Hãy chọn ĐÚNG 1 bài nghiêm trọng nhất (có tầm ảnh hưởng lớn nhất đến cổ phiếu/nhà đầu tư).
Trả về ĐÚNG số index của bài đó (ví dụ: 0 hoặc 2), không giải thích, không markdown.`;

      let selContent: string | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await this.groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: selectionPrompt }],
            temperature: 0.1, // Phân loại — không cần sáng tạo
            max_tokens: 8,    // Chỉ cần trả 1 số
          });
          selContent = res.choices[0]?.message?.content?.trim() ?? null;
          break;
        } catch (err) {
          const isRateLimit = err instanceof Error && (err.message.includes("429") || err.message.includes("rate_limit"));
          if (isRateLimit && attempt < 3) {
            const waitMs = attempt * 30000;
            console.log(`[Featured RateLimit] Chờ ${waitMs / 1000}s...`);
            await new Promise((r) => setTimeout(r, waitMs));
          } else throw err;
        }
      }

      // Parse số index từ response. Nếu Groq trả về text lạ hoặc index out of range → fallback 0
      const parsed = parseInt(selContent ?? "0", 10);
      chosenRiskIndex = isNaN(parsed) || parsed >= riskArticles.length ? 0 : parsed;
    }

    const featuredArticle = riskArticles[chosenRiskIndex];
    // Guard: dù logic đảm bảo chosenRiskIndex hợp lệ, TypeScript vẫn cần check
    if (!featuredArticle) {
      console.log("[Featured] Không xác định được bài nổi bật, bỏ qua.");
      return articles;
    }
    console.log(`[Featured] Bài được chọn: "${featuredArticle.title.slice(0, 60)}..."`);

    // Sinh summary ~50 từ kiểu standfirst — đoạn mở đầu ngắn gọn theo phong cách báo tài chính.
    // temperature=0.4 để có chút linh hoạt văn phong, nhưng không quá sáng tạo.
    // max_tokens=300 để đủ dài cho 50 từ tiếng Việt (khoảng 150-200 token).
    const summaryPrompt = `Bạn là biên tập viên tài chính của một tờ báo kinh tế uy tín.
Viết một đoạn mở đầu bài (deck/standfirst) cho tin sau, dung lượng tối đa 50 từ tiếng Việt:

Tiêu đề: ${featuredArticle.title}
Nguồn: ${featuredArticle.source}

Yêu cầu:
- Ngắn gọn, súc tích, mang giọng chuyên nghiệp
- Nêu rõ rủi ro/vấn đề cốt lõi mà nhà đầu tư cần chú ý
- Không đưa ra khuyến nghị mua/bán
- Trả về đoạn văn thuần, không tiêu đề, không markdown`;

    let summary = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await this.groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: summaryPrompt }],
          temperature: 0.4,
          max_tokens: 300,
        });
        summary = res.choices[0]?.message?.content?.trim() ?? "";
        break;
      } catch (err) {
        const isRateLimit = err instanceof Error && (err.message.includes("429") || err.message.includes("rate_limit"));
        if (isRateLimit && attempt < 3) {
          const waitMs = attempt * 30000;
          console.log(`[Summary RateLimit] Chờ ${waitMs / 1000}s...`);
          await new Promise((r) => setTimeout(r, waitMs));
        } else throw err;
      }
    }

    console.log(`[Featured] Summary sinh xong (${summary.split(" ").length} từ).`);

    // Map lại mảng gốc: chỉ bài có index trùng với featuredArticle.originalIndex
    // được gắn thêm isFeatured + summary. Tất cả bài khác giữ nguyên không đổi.
    return articles.map((a, idx) => {
      if (idx === featuredArticle.originalIndex) {
        return { ...a, isFeatured: true, summary };
      }
      return a;
    });
  }
}
