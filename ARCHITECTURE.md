# AFAD — Architecture & Workflow Reference

> **Mục đích file này:** Đọc file này TRƯỚC KHI mở bất kỳ file nào khác.  
> Sau khi đọc xong, bạn biết ngay: file nào làm gì, dữ liệu chạy qua đâu, cần sửa gì thì vào file nào.

---

## 1. Tổng quan dự án

AFAD là web app tin tức cổ phiếu Việt Nam theo thời gian thực:
- **Client** (React/Vite): Hiển thị tin tức dưới dạng Bento Grid, phân theo 4 nhóm chủ đề.
- **Server** (Node.js/TypeScript, HTTP thuần): Quét tin RSS → phân loại AI → tìm bài nổi bật → lấy ảnh → cache → trả JSON.

```
Client (React)
    │
    └── GET /api/stock/:ticker
              │
              ▼
         Server (Node.js)
              │
              ├── [1] NewsService      → Google News RSS (tiếng Việt)
              ├── [2] ClassifyService  → Groq LLaMA 70B (phân loại 4 nhóm)
              ├── [3] ClassifyService  → Groq LLaMA 70B (chọn bài RỦI RO nổi bật + summary)
              └── [4] ImageService     → media:content RSS / HuggingFace FLUX AI
```

---

## 2. Cấu trúc thư mục

```
AFAD/
├── client/src/
│   ├── App.tsx                  # Root component, routing chính
│   ├── layout/BentoGrid.tsx     # Layout lưới chính (Bento style)
│   ├── components/
│   │   ├── cards/
│   │   │   ├── ArticleCard.tsx  # Card hiển thị một bài báo
│   │   │   └── HeroCard.tsx     # Card lớn (bài nổi bật)
│   │   ├── popups/
│   │   │   ├── SearchPopup.tsx  # Popup tìm kiếm mã cổ phiếu
│   │   │   └── SpecterPopup.tsx # Popup chi tiết/overlay
│   │   └── widgets/
│   │       ├── Calendar.tsx     # Widget lịch
│   │       ├── Porfolio.tsx     # Widget danh mục đầu tư
│   │       └── SearchBar.tsx    # Thanh tìm kiếm
│   ├── data/mockArticles.ts     # Dữ liệu giả để dev UI không cần server
│   └── types/article.ts         # TypeScript types phía client
│
└── server/src/
    ├── index.ts                         # HTTP server, định nghĩa routes
    ├── controllers/
    │   └── stock.controller.ts          # Orchestrator: điều phối 4 bước + cache
    ├── services/
    │   ├── news.service.ts              # Quét tin từ Google News RSS
    │   ├── classify.service.ts          # Groq: phân loại + tìm bài nổi bật
    │   └── image.service.ts             # Lấy ảnh từ RSS / sinh ảnh AI
    └── types/
        └── stock.ts                     # TypeScript interfaces dùng ở server
```

---

## 3. Luồng dữ liệu Server (tuyến tính)

```
[Client] GET /api/stock/VIC
    │
    ▼
[stock.controller.ts]
    │  normalize ticker → "VIC"
    │
    ├─ Cache HIT (< 24h)? → trả ngay { success, fromCache: true, data }
    │
    └─ Cache MISS / EXPIRED
          │
          ▼  [Bước 1] news.service.ts
    [NewsService.fetchNews()]
          │  Build RSS URL: q="VIC cổ phiếu" &hl=vi &gl=VN
          │  Fetch XML → match tất cả <item> block
          │  Mỗi item: extractTag() lấy title, link, pubDate, source
          │  Làm sạch title: bỏ đuôi " - Tên Báo" NẾU đuôi đó khớp chính xác với source
          │  Tìm ảnh: <media:content url="..."> → imageUrl (undefined nếu không có)
          │  Resolve URL song song (GET trước, HEAD fallback, timeout 5s mỗi cái)
          │  Return: NewsArticle[] (tối đa 10 bài, URL đã resolve)
          │
          ▼  [Bước 2] classify.service.ts → classify()
    [ClassifyService.classify()]
          │  Gộp tất cả tiêu đề → 1 Groq request duy nhất
          │  Groq trả JSON map: { "0": "TĂNG TRƯỞNG", "1": "RỦI RO", ... }
          │  Validate từng giá trị, fallback "CÂN ĐỐI" nếu Groq trả giá trị lạ
          │  Auto-retry nếu 429: chờ 30s → 60s → throw
          │  Return: CategorizedArticle[] (= NewsArticle + category)
          │
          ▼  [Bước 3] classify.service.ts → findFeaturedRisk()
    [ClassifyService.findFeaturedRisk()]
          │  Lọc các bài category = "RỦI RO", giữ originalIndex
          │  0 bài RỦI RO → trả nguyên mảng
          │  1 bài RỦI RO → chọn luôn (không tốn Groq call)
          │  >1 bài RỦI RO → 1 Groq call (max_tokens=8) chọn index nghiêm trọng nhất
          │  Sinh summary ~50 từ kiểu standfirst báo chí → 1 Groq call (max_tokens=300)
          │  Gắn isFeatured=true + summary vào đúng bài theo originalIndex
          │  Các bài còn lại giữ nguyên không đổi
          │  Return: CategorizedArticle[] (đúng 1 bài có isFeatured+summary nếu có RỦI RO)
          │
          ▼  [Bước 4] image.service.ts
    [ImageService.resolveImages()]
          │  Chạy song song (Promise.all) cho tất cả bài:
          │    - Có imageUrl (từ RSS media:content)? → dùng luôn ✓
          │    - Không có → sinh ảnh AI qua HuggingFace FLUX.1-schnell
          │      Prompt = mood theo category + keywords từ title (tối đa 5 từ > 3 ký tự)
          │      → lưu file server/public/images/VIC_0.jpg
          │      → trả về đường dẫn /images/VIC_0.jpg
          │      Lỗi HuggingFace → imageUrl = "" (không throw, log error)
          │  Return: CategorizedArticle[] (đã có imageUrl tất cả bài)
          │
          ▼
    [stock.controller.ts]
          │  Lưu vào Map cache với key = "VIC", cachedAt = now
          │
          ▼
[index.ts] → res.end(JSON.stringify(result))
    │
    ▼
[Client nhận] { success, fromCache, data: StockAnalysisResponse }
```

---

## 4. Các kiểu dữ liệu chính (`server/src/types/stock.ts`)

| Type / Interface | Mô tả | Dùng ở đâu |
|---|---|---|
| `NewsCategory` | Union: `"CÂN ĐỐI" \| "TĂNG TRƯỞNG" \| "RỦI RO" \| "DIỄN BIẾN GIÁ"` | classify.service, types |
| `NewsArticle` | Bài thô: title (đã clean), source, url (đã resolve), publishedAt (ISO), imageUrl? | news.service output |
| `CategorizedArticle` | Extends NewsArticle + `category` + `isFeatured?` + `summary?` | classify → image → controller |
| `StockAnalysisResponse` | Kết quả cuối: ticker + articles[] + cachedAt | controller → index → client |

### Ghi chú về `isFeatured` và `summary`
- Chỉ **đúng 1 bài** trong toàn bộ mảng có `isFeatured: true` — bài RỦI RO nghiêm trọng nhất.
- `summary` là đoạn standfirst ~50 từ kiểu báo tài chính, chỉ có khi `isFeatured = true`.
- Các bài khác không có 2 field này (undefined) — client kiểm tra `article.isFeatured` để render khác.

---

## 5. Biến môi trường (`server/.env`)

| Biến | Dùng ở | Mục đích |
|---|---|---|
| `PORT` | index.ts | Cổng server (mặc định 3000) |
| `GROQ_API_KEY` | classify.service.ts | Xác thực Groq API |
| `HUGGINGFACE_API_KEY` | image.service.ts | Xác thực HuggingFace |

---

## 6. Routes Server

| Method | Path | File xử lý | Mô tả |
|---|---|---|---|
| GET | `/api/stock/:ticker` | stock.controller.ts | Chạy pipeline 4 bước, có cache 24h |
| GET | `/images/:filename` | index.ts | Serve ảnh AI đã sinh (VIC_0.jpg, ...) |
| GET | `/health` | index.ts | Health check đơn giản |
| * | `/*` | index.ts | 404 fallthrough |

---

## 7. Xử lý ảnh — thứ tự ưu tiên

```
Bài báo từ RSS
    │
    ├── Có imageUrl (từ <media:content> trong RSS)?
    │       → Dùng luôn, không request thêm ✓
    │
    └── Không có
            │
            └── Sinh ảnh AI: HuggingFace FLUX.1-schnell
                    │  Prompt = mood theo category + keywords từ title
                    │  Keywords: bỏ ký tự đặc biệt, lọc từ > 3 ký tự, tối đa 5 từ
                    │  → Mỗi bài có prompt riêng biệt, tránh ảnh trùng nhau
                    │
                    ├── Thành công → lưu server/public/images/VIC_0.jpg
                    │               trả /images/VIC_0.jpg
                    └── Lỗi → imageUrl = "" (client tự fallback UI)
```

Mood map theo category:
- `CÂN ĐỐI` → balanced scale, financial charts, calm blue tones
- `TĂNG TRƯỞNG` → rising green arrows, cityscape, golden light
- `RỦI RO` → stormy sky, red warnings, dark tones
- `DIỄN BIẾN GIÁ` → candlestick chart, neon trading floor

Ảnh được serve qua `GET /images/:filename` với `Cache-Control: public, max-age=86400`.

---

## 8. Quy tắc quan trọng cần nhớ

- **Cache**: In-memory `Map<string, CacheEntry>`, TTL = 24h, key = ticker UPPERCASE. Reset khi restart server.
- **Retry Groq 429**: Tối đa 3 lần, delay `attempt × 30s` (30s, 60s). Áp dụng cho cả 3 Groq calls trong pipeline.
- **Classify**: Gửi tất cả tiêu đề trong **một** Groq request duy nhất — không gọi từng bài.
- **Featured**: Tối đa 2 Groq calls thêm (1 chọn bài + 1 sinh summary). Nếu chỉ 1 bài RỦI RO → chỉ 1 call sinh summary.
- **Image song song**: `Promise.all` cho tất cả bài — không chờ tuần tự. Lỗi 1 bài không chặn bài khác.
- **URL resolve**: Google News RSS trả redirect link → thử GET trước (HEAD không trigger redirect), timeout 5s mỗi attempt.
- **Title clean**: Chỉ cắt đuôi " - Tên Báo" khi đuôi đó khớp chính xác với `source` — tránh cắt nhầm tiêu đề có dấu `-` tự nhiên.
- **Không dùng Express**: Server là `http.createServer` thuần — thêm route mới thì thêm `if` block trong index.ts.
- **CORS**: Set `*` — chỉ phù hợp dev. Production nên lock lại domain cụ thể.

---

## 9. Khi cần sửa — vào file nào?

| Việc cần làm | File cần mở |
|---|---|
| Thêm/sửa route API hoặc serve static | `server/src/index.ts` |
| Thay đổi logic cache (TTL, invalidation) | `server/src/controllers/stock.controller.ts` |
| Thay đổi query RSS, số bài tối đa, logic resolve URL | `server/src/services/news.service.ts` |
| Sửa prompt phân loại, thêm/bớt nhóm chủ đề | `server/src/services/classify.service.ts` → `classify()` |
| Sửa logic chọn bài nổi bật hoặc nội dung summary | `server/src/services/classify.service.ts` → `findFeaturedRisk()` |
| Đổi model sinh ảnh, sửa mood map theo category | `server/src/services/image.service.ts` |
| Thêm/sửa TypeScript types | `server/src/types/stock.ts` |
| Sửa UI layout lưới chính | `client/src/layout/BentoGrid.tsx` |
| Sửa card hiển thị bài báo thường | `client/src/components/cards/ArticleCard.tsx` |
| Sửa card bài nổi bật (isFeatured) | `client/src/components/cards/HeroCard.tsx` |
| Sửa search bar / popup tìm kiếm | `client/src/components/popups/SearchPopup.tsx` |
| Sửa mock data để test UI | `client/src/data/mockArticles.ts` |

---

## 10. Các API bên ngoài

| Service | Model / Endpoint | Ghi chú |
|---|---|---|
| Google News RSS | `news.google.com/rss/search` | Miễn phí, không cần key, realtime, tiếng Việt |
| Groq | `llama-3.3-70b-versatile` | Phân loại (temp=0.1) + chọn bài (temp=0.1, max_tokens=8) + summary (temp=0.4, max_tokens=300) |
| HuggingFace | `black-forest-labs/FLUX.1-schnell` | Sinh ảnh AI khi RSS không có ảnh, header `x-wait-for-model: true` |

---

## 11. Tổng số Groq calls mỗi request (worst case)

| Call | Điều kiện | max_tokens |
|---|---|---|
| `classify()` | Luôn có | 512 |
| `findFeaturedRisk()` — chọn bài | Chỉ khi > 1 bài RỦI RO | 8 |
| `findFeaturedRisk()` — sinh summary | Khi có ít nhất 1 bài RỦI RO | 300 |

Worst case: **3 Groq calls** / request. Best case (không có bài RỦI RO): **1 call**.
