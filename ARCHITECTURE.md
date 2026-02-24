# AFAD — Architecture & Workflow Reference

> **Mục đích file này:** Đọc file này TRƯỚC KHI mở bất kỳ file nào khác.  
> Sau khi đọc xong, bạn biết ngay: file nào làm gì, dữ liệu chạy qua đâu, cần sửa gì thì vào file nào.

---

## 1. Tổng quan dự án

AFAD là web app phân tích cổ phiếu theo thời gian thực:
- **Client** (React/Vite): Hiển thị thông tin phân tích dưới dạng Bento Grid.
- **Server** (Node.js/TypeScript, HTTP thuần): Gọi LLM + AI image, cache kết quả 24h, trả JSON về client.

```
Client (React)  →  GET /api/stock/:ticker  →  Server  →  Groq (LLaMA 70B)
                                                      →  HuggingFace (FLUX image)
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
│   │   │   ├── ArticleCard.tsx  # Card hiển thị 1 insight (Risk/Outlook/...)
│   │   │   └── HeroCard.tsx     # Card lớn hiển thị ảnh AI + ticker
│   │   ├── popups/
│   │   │   ├── SearchPopup.tsx  # Popup tìm kiếm mã cổ phiếu
│   │   │   └── SpecterPopup.tsx # Popup chi tiết/overlay khác
│   │   └── widgets/
│   │       ├── Calendar.tsx     # Widget lịch
│   │       ├── Porfolio.tsx     # Widget danh mục đầu tư
│   │       └── SearchBar.tsx    # Thanh tìm kiếm
│   ├── data/mockArticles.ts     # Dữ liệu giả để dev UI không cần server
│   └── types/article.ts         # TypeScript types dùng ở client
│
└── server/src/
    ├── index.ts                         # HTTP server, định nghĩa routes
    ├── controllers/
    │   └── stock.controller.ts          # Orchestrator: cache + gọi services
    ├── services/
    │   ├── research.service.ts          # Gọi Groq API → phân tích text
    │   └── image.service.ts             # Gọi HuggingFace → sinh ảnh base64
    └── types/
        └── stock.ts                     # TypeScript interfaces dùng ở server
```

---

## 3. Luồng dữ liệu Server (tuyến tính)

```
[Client gửi] GET /api/stock/AAPL
      │
      ▼
[index.ts] — Regex match URL → gọi stockController.analyze("AAPL")
      │
      ▼
[stock.controller.ts] — normalize ticker → "AAPL"
      │
      ├─ Cache HIT (< 24h)? → trả ngay { success, fromCache: true, data }
      │
      └─ Cache MISS / EXPIRED
            │
            ▼
      [research.service.ts] — Gọi Groq (LLaMA 70B)
            │  Prompt: phân tích AAPL → trả JSON 6 trường (tiếng Việt + imagePrompt tiếng Anh)
            │  Auto-retry nếu 429: chờ 30s → 60s → throw
            │  Parse JSON → validate 5 trường bắt buộc
            │  Return: StockAnalysisResponse (chưa có imageUrl)
            │
            ▼
      [image.service.ts] — Gọi HuggingFace FLUX.1-schnell
            │  Input: imagePrompt (tiếng Anh từ Groq)
            │  Output: base64 Data URL ("data:image/jpeg;base64,...")
            │
            ▼
      [stock.controller.ts] — Ghép { ...analysis, imageUrl }
            │  Lưu vào Map cache với key = "AAPL"
            │
            ▼
[index.ts] — res.writeHead(200) → res.end(JSON.stringify(result))
      │
      ▼
[Client nhận] { success, fromCache, data: StockAnalysisResponse }
```

---

## 4. Các kiểu dữ liệu chính (`server/src/types/stock.ts`)

| Interface | Mô tả | Dùng ở đâu |
|---|---|---|
| `StockAnalysisResult` | JSON thô Groq trả về (Risk, Outlook, Technical, Sentiment, Flow, imagePrompt) | research.service.ts (parse) |
| `StockInsight` | `{ category, content }` — một nhận định đã chuẩn hoá | research.service.ts (output), client |
| `StockAnalysisResponse` | Kết quả hoàn chỉnh: ticker + insights[] + imagePrompt + imageUrl + cachedAt | controller → index → client |

---

## 5. Biến môi trường (`server/.env`)

| Biến | Dùng ở | Mục đích |
|---|---|---|
| `PORT` | index.ts | Cổng server (mặc định 3000) |
| `GROQ_API_KEY` | research.service.ts | Xác thực Groq API |
| `HUGGINGFACE_API_KEY` | image.service.ts | Xác thực HuggingFace |

---

## 6. Routes Server

| Method | Path | File xử lý | Mô tả |
|---|---|---|---|
| GET | `/api/stock/:ticker` | stock.controller.ts | Phân tích cổ phiếu, có cache 24h |
| GET | `/health` | index.ts | Health check đơn giản |
| * | `/*` | index.ts | 404 fallthrough |

---

## 7. Quy tắc quan trọng cần nhớ

- **Cache**: In-memory `Map<string, CacheEntry>`, TTL = 24h, key = ticker UPPERCASE. Reset khi restart server.
- **Retry Groq 429**: Tối đa 3 lần, delay `attempt * 30s` (30s, 60s).
- **imagePrompt**: Luôn tiếng Anh (do LLM quy định trong prompt). Các trường còn lại tiếng Việt.
- **HuggingFace response**: Trả binary image (không phải JSON) → phải dùng `.arrayBuffer()` rồi convert base64.
- **CORS**: Set `*` cho phép mọi origin — chỉ phù hợp dev. Production nên lock lại.
- **Không dùng Express**: Server là `http.createServer` thuần — thêm route mới thì thêm `if` block trong index.ts.

---

## 8. Khi cần sửa — vào file nào?

| Việc cần làm | File cần mở |
|---|---|
| Thêm/sửa route API | `server/src/index.ts` |
| Thay đổi logic cache (TTL, invalidation) | `server/src/controllers/stock.controller.ts` |
| Thay model LLM, sửa prompt, thêm trường phân tích | `server/src/services/research.service.ts` |
| Đổi model sinh ảnh, thay provider | `server/src/services/image.service.ts` |
| Thêm/sửa TypeScript types | `server/src/types/stock.ts` |
| Sửa UI layout lưới chính | `client/src/layout/BentoGrid.tsx` |
| Sửa card hiển thị insight | `client/src/components/cards/ArticleCard.tsx` |
| Sửa card ảnh + ticker | `client/src/components/cards/HeroCard.tsx` |
| Sửa search bar / popup tìm kiếm | `client/src/components/popups/SearchPopup.tsx` |
| Sửa mock data để test UI | `client/src/data/mockArticles.ts` |

---

## 9. Các API bên ngoài

| Service | Model/Endpoint | Giới hạn miễn phí |
|---|---|---|
| Groq | `llama-3.3-70b-versatile` | Rate limit → auto-retry 429 |
| HuggingFace | `black-forest-labs/FLUX.1-schnell` | Header `x-wait-for-model: true` nếu model cold start |
