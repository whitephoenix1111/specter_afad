// ============================================================
// services/news.service.ts — Bước 1 trong pipeline.
// Quét tin tức cổ phiếu Việt Nam từ Google News RSS,
// parse XML thủ công, resolve redirect URL, làm sạch tiêu đề.
//
// Input:  ticker (VD: "VIC")
// Output: NewsArticle[] — tối đa MAX_ARTICLES bài, URL đã resolve
// ============================================================

import type { NewsArticle } from "../types/stock.js";

const MAX_ARTICLES = 10; // Giới hạn số bài mỗi lần quét

export class NewsService {

  // Tạo URL RSS Google News tiếng Việt.
  // Thêm "cổ phiếu" vào query để lọc bớt tin không liên quan.
  // VD: ticker="VIC" → query="VIC+c%E1%BB%95+phi%E1%BA%BFu"
  private buildRssUrl(ticker: string): string {
    const query = encodeURIComponent(`${ticker} cổ phiếu`);
    return `https://news.google.com/rss/search?q=${query}&hl=vi&gl=VN&ceid=VN:vi`;
  }

  // Follow redirect để lấy URL thật từ Google News redirect link.
  // VD: "https://news.google.com/rss/articles/CBMi..." → "https://cafef.vn/..."
  //
  // Thử GET trước vì Google News chỉ redirect với GET, không redirect với HEAD.
  // Nếu GET thành công nhưng URL vẫn là news.google.com → thử HEAD.
  // Cả hai thất bại → giữ nguyên URL gốc (redirect URL), không throw.
  private async resolveUrl(url: string): Promise<string> {
    for (const method of ["GET", "HEAD"] as const) {
      try {
        const res = await fetch(url, {
          method,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; AFAD-StockBot/1.0)" },
          redirect: "follow",           // Node fetch tự follow tất cả redirect
          signal: AbortSignal.timeout(5000), // Timeout 5s mỗi attempt
        });
        const resolved = res.url || url;
        if (!resolved.includes("news.google.com")) return resolved; // Resolve thành công
      } catch {
        // Timeout hoặc network error → thử method tiếp theo
      }
    }
    return url; // Fallback: giữ nguyên redirect URL nếu cả hai đều thất bại
  }

  // Parse chuỗi ngày RFC 2822 từ RSS → ISO 8601.
  // VD: "Thu, 26 Feb 2026 08:30:00 GMT" → "2026-02-26T08:30:00.000Z"
  // Parse thất bại → trả thời điểm hiện tại thay vì throw.
  private parseDate(raw: string): string {
    if (!raw) return new Date().toISOString();
    const parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  // Lấy text thuần từ một XML tag, xử lý cả dạng CDATA và dạng thường.
  // VD: "<title><![CDATA[Tin tức VIC]]></title>" → "Tin tức VIC"
  // VD: "<source>CafeF</source>" → "CafeF"
  // Trả "" nếu tag không tồn tại.
  private extractTag(xml: string, tag: string): string {
    const match = xml.match(
      new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i")
    );
    return match?.[1]?.trim() ?? "";
  }

  // Parse toàn bộ XML RSS string → mảng NewsArticle.
  // Xử lý từng <item> tag, extract các field cần thiết, resolve URL song song.
  private async parseRss(xml: string): Promise<NewsArticle[]> {
    // Tách từng <item>...</item> block ra để xử lý riêng
    const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];
    const articles: NewsArticle[] = [];

    for (const item of itemMatches) {
      const title       = this.extractTag(item, "title");
      const url         = this.extractTag(item, "link");
      const publishedAt = this.extractTag(item, "pubDate");

      // Lấy tên nguồn từ <source> tag (VD: "CafeF", "VnExpress").
      // Nếu <source> rỗng, fallback về hostname của URL (VD: "cafef.vn").
      let source = this.extractTag(item, "source");
      if (!source && url) {
        try {
          source = new URL(url).hostname.replace(/^www\./, "");
        } catch {
          source = "Unknown";
        }
      }

      // Bỏ qua bài không có tiêu đề hoặc URL — dữ liệu không dùng được
      if (!title || !url) continue;

      // Làm sạch tiêu đề: bỏ đuôi " - Tên Báo" CHỈ KHI phần đuôi khớp chính xác với source.
      // Mục đích: Google News RSS thường append tên báo vào tiêu đề, nhưng source đã có riêng.
      // Regex tìm pattern: [khoảng trắng][- hoặc – hoặc |][khoảng trắng][text đến cuối]
      // VD: "VIC tăng mạnh - CafeF" + source="CafeF"       → "VIC tăng mạnh"    ✓ cắt
      // VD: "Mua - bán cổ phiếu VIC" + source="CafeF"      → giữ nguyên          ✓ không cắt
      // VD: "VIC tăng - giảm thất thường" + source="CafeF" → giữ nguyên          ✓ không cắt
      const suffixMatch = title.match(/\s[-–|]\s([^-–|]+)$/);
      const [fullMatch, suffixGroup] = suffixMatch ?? [];
      const cleanTitle =
        fullMatch && suffixGroup && suffixMatch?.index !== undefined && source && suffixGroup.trim() === source.trim()
          ? title.slice(0, suffixMatch.index).trim()
          : title;

      // Lấy ảnh từ <media:content url="..."> nếu RSS có đính kèm.
      // Nếu không có → bỏ hẳn field imageUrl (không gán undefined) vì exactOptionalPropertyTypes=true:
      // với setting đó, `imageUrl?: string` nghĩa là field không tồn tại, khác với gán undefined.
      const mediaMatch = item.match(/<media:content[^>]+url=["']([^"']+)["']/i);
      const mediaImage = mediaMatch?.[1];

      articles.push({
        title: cleanTitle,
        source,
        url,  // URL gốc (redirect), sẽ được resolve ở bước dưới
        publishedAt: this.parseDate(publishedAt),
        ...(mediaImage !== undefined && { imageUrl: mediaImage }),
      });

      if (articles.length >= MAX_ARTICLES) break; // Đủ số lượng, dừng parse sớm
    }

    // Resolve tất cả redirect URL song song — tránh tuần tự làm chậm toàn bộ pipeline.
    // Promise.all đảm bảo tất cả bài được resolve trước khi trả về.
    console.log(`[News] Resolving ${articles.length} URLs song song...`);
    const resolved = await Promise.all(
      articles.map(async (a) => ({ ...a, url: await this.resolveUrl(a.url) }))
    );

    return resolved;
  }

  // Điểm vào duy nhất của NewsService.
  // Fetch RSS → validate XML → parse → trả về mảng bài sạch.
  async fetchNews(ticker: string): Promise<NewsArticle[]> {
    const url = this.buildRssUrl(ticker);
    console.log(`[News] Fetching: ${url}`);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AFAD-StockBot/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
    });

    if (!response.ok) {
      throw new Error(`Google News RSS error: ${response.status} — ${response.statusText}`);
    }

    const xml = await response.text();

    // Validate sơ bộ — đảm bảo response thực sự là RSS, không phải trang lỗi HTML
    if (!xml.includes("<rss") && !xml.includes("<feed")) {
      throw new Error("Response không phải RSS/XML hợp lệ từ Google News.");
    }

    const articles = await this.parseRss(xml);
    console.log(`[News] Lấy được ${articles.length} bài cho ${ticker}`);

    return articles;
  }
}
