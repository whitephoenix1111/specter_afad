# AFAD — Architecture & Workflow Reference

> **Mục đích file này:** Đọc file này TRƯỚC KHI mở bất kỳ file nào khác.  
> Sau khi đọc xong, bạn biết ngay: file nào làm gì, dữ liệu chạy qua đâu, cần sửa gì thì vào file nào.

---

## 1. Tổng quan dự án

AFAD là web app tin tức cổ phiếu Việt Nam theo thời gian thực:
- **Client** (React/Vite): Hiển thị tin tức dưới dạng Bento Grid, phân theo 4 nhóm chủ đề.
- **Server** (Node.js/TypeScript, HTTP thuần): Quét tin RSS → phân loại AI → tìm bài nổi bật → lấy ảnh → lưu Firestore → trả JSON.

```
Client (React)
    │
    └── GET /api/stock/:ticker        ← user nhập ticker vào SearchPopup
              │
              ▼
         Server (Node.js)
              │
              ├── [1] NewsService      → Google News RSS (tiếng Việt)
              ├── [2] ClassifyService  → Groq LLaMA 70B (phân loại 4 nhóm)
              ├── [3] ClassifyService  → Groq LLaMA 70B (chọn bài RỦI RO nổi bật + summary)
              ├── [4] ImageService     → media:content RSS / HuggingFace FLUX AI → Cloudinary
              └── [5] Firestore        → lưu & đọc data persist
```

---

## 2. Cấu trúc thư mục

```
AFAD/
├── client/src/
│   ├── App.tsx                       # Root component — khởi tạo useStockNews hook, truyền state xuống
│   ├── hooks/
│   │   └── useStockNews.ts           # Custom hook — toàn bộ logic fetch API nằm ở đây
│   ├── types/
│   │   └── article.ts                # TypeScript types phía client (Article, FetchState, StockApiResponse)
│   ├── layout/
│   │   └── BentoGrid.tsx             # Layout lưới chính — phân loại articles vào 4 cột, render grid
│   ├── components/
│   │   ├── cards/
│   │   │   ├── ArticleCard.tsx       # Card bài báo thông thường
│   │   │   └── HeroCard.tsx          # Card bài nổi bật (isFeatured) — chiếm 2 cột giữa
│   │   ├── popups/
│   │   │   ├── SearchPopup.tsx       # Popup nhập mã cổ phiếu — validate + trigger fetch API
│   │   │   └── SpecterPopup.tsx      # Popup giải thích Specter
│   │   └── widgets/
│   │       ├── Calendar.tsx          # Widget lịch
│   │       ├── Porfolio.tsx          # Widget danh mục đầu tư
│   │       └── SearchBar.tsx         # Thanh search trong sidebar — mở SearchPopup
│
└── server/
    ├── serviceAccountKey.json               # Firebase Admin credentials (KHÔNG commit git)
    └── src/
        ├── index.ts                         # HTTP server, định nghĩa routes
        ├── firebase.ts                      # Khởi tạo Firebase Admin + Cloudinary upload helper
        ├── controllers/
        │   └── stock.controller.ts          # Orchestrator: pipeline + Firestore incremental update
        ├── services/
        │   ├── news.service.ts              # Quét tin từ Google News RSS + filter chính xác theo ticker
        │   ├── classify.service.ts          # Groq: phân loại + tìm bài nổi bật
        │   └── image.service.ts             # Lấy ảnh RSS / sinh AI → upload Cloudinary
        └── types/
            └── stock.ts                     # TypeScript interfaces dùng ở server
```

---

## 3. Luồng dữ liệu Client (tuyến tính)

```
[User] gõ ticker vào SearchPopup → nhấn Enter / nút Send
    │
    ▼
[SearchPopup] validate ticker: chỉ A-Z, 0-9, tối đa 4 ký tự (regex ^[A-Z0-9]{1,4}$)
    │  Lỗi → hiện thông báo inline, không submit
    │  OK  → onSubmit(ticker)
    │
    ▼
[SearchBar] onSearch(ticker)
    │
    ▼
[App.tsx] fetchStock(ticker)          ← nhận từ useStockNews hook
    │
    ▼
[useStockNews] fetch /api/stock/VIC
    │  Vite dev proxy forward → http://localhost:3000/api/stock/VIC
    │  setState({ status: "loading" })   → BentoGrid hiện loading overlay
    │
    ├── Lỗi HTTP / network?
    │       setState({ status: "error", message })
    │       → BentoGrid hiện error banner ("Vui lòng thử lại"), grid hiển thị rỗng
    │
    └── Thành công?
            setState({ status: "success", data })
            │
            ▼
        [BentoGrid] nhận articles[]
            │
            ├── articles rỗng?
            │       → hiện empty state banner ("Không tìm thấy tin tức nào cho mã XYZ")
            │
            └── có bài?
                    │  filter → canDoi / tangTruong / dienBienGia / ruiRo
                    │  heroArticle = isFeatured ?? ruiRo[0] ?? null
                    │  HeroCard chỉ render khi có bài RỦI RO
                    │  ruiRo.filter(!isFeatured) → render ArticleCard ở cột 4
                    ▼
                Grid 5 cột hiển thị tin tức thật
```

---

## 4. Luồng dữ liệu Server (tuyến tính)

```
[Client] GET /api/stock/VIC
    │
    ▼
[stock.controller.ts]
    │  normalize ticker → "VIC"
    │
    ▼  Đọc Firestore: stocks/VIC
    │  Lấy existingArticles[] + tập existingUrls (Set<string>)
    │
    ▼  [Bước 1] news.service.ts
[NewsService.fetchNews()]
    │  Build RSS URL: q="VIC cổ phiếu" &hl=vi &gl=VN
    │  Fetch XML → match tất cả <item> block
    │  Mỗi item: extractTag() lấy title, link, pubDate, source
    │  Làm sạch title: bỏ đuôi " - Tên Báo" NẾU đuôi đó khớp chính xác với source
    │  Tìm ảnh: <media:content url="..."> → imageUrl (undefined nếu không có)
    │  Resolve URL song song (GET trước, HEAD fallback, timeout 5s mỗi cái)
    │  Filter chính xác: chỉ giữ bài có chứa đúng ticker (\bVIC\b) trong title hoặc URL
    │  → Tránh trường hợp tìm "VCL" nhưng nhận về bài chứa "VLC"
    │  Return: NewsArticle[] (tối đa 10 bài, đã filter, URL đã resolve)
    │
    ▼  Lọc bài mới: rawArticles.filter(a => !existingUrls.has(a.url))
    │
    ├── Không có bài mới?
    │       → Trả thẳng data từ Firestore { fromCache: true }
    │       → Không gọi Groq, không gọi HuggingFace (tiết kiệm quota)
    │
    └── Có bài mới → tiếp tục pipeline
          │
          ▼  [Bước 2] classify.service.ts → classify()
    [ClassifyService.classify()]  — chỉ cho bài mới
          │  Gộp tất cả tiêu đề → 1 Groq request duy nhất
          │  Groq trả JSON map: { "0": "TĂNG TRƯỞNG", "1": "RỦI RO", ... }
          │  Validate từng giá trị, fallback "CÂN ĐỐI" nếu Groq trả giá trị lạ
          │  Auto-retry nếu 429: chờ 30s → 60s → throw
          │  Return: CategorizedArticle[] (= NewsArticle + category)
          │
          ▼  [Bước 3] classify.service.ts → findFeaturedRisk()
    [ClassifyService.findFeaturedRisk()]  — trên toàn bộ (mới + cũ) để đánh giá đúng context
          │  Lọc các bài category = "RỦI RO", giữ originalIndex
          │  0 bài RỦI RO → trả nguyên mảng
          │  1 bài RỦI RO → chọn luôn (không tốn Groq call)
          │  >1 bài RỦI RO → 1 Groq call (max_tokens=8) chọn index nghiêm trọng nhất
          │  Sinh summary ~50 từ kiểu standfirst báo chí → 1 Groq call (max_tokens=300)
          │  Gắn isFeatured=true + summary vào đúng bài theo originalIndex
          │  Return: CategorizedArticle[] (đúng 1 bài có isFeatured+summary nếu có RỦI RO)
          │
          ▼  [Bước 4] image.service.ts  — chỉ cho bài mới (bài cũ đã có imageUrl)
    [ImageService.resolveImages()]
          │  Chạy song song (Promise.all) cho tất cả bài mới:
          │    - Có imageUrl (từ RSS media:content)? → dùng luôn ✓
          │    - Không có → sinh ảnh AI qua HuggingFace FLUX.1-schnell
          │      Prompt = mood theo category + keywords từ title (tối đa 5 từ > 3 ký tự)
          │      → upload lên Cloudinary (public_id: afad/VIC_0, overwrite=true)
          │      → trả về URL CDN: https://res.cloudinary.com/...
          │      Lỗi HuggingFace/Cloudinary → imageUrl = "" (không throw, log error)
          │  Return: CategorizedArticle[] (đã có imageUrl tất cả bài mới)
          │
          ▼
    [stock.controller.ts]
          │  Merge: [...newWithImages, ...oldArticles].slice(0, 20)
          │  Ghi đè Firestore: stocks/VIC { ticker, articles, updatedAt }
          │
          ▼
[index.ts] → res.end(JSON.stringify(result))
    │
    ▼
[Client nhận] { success, fromCache, data: StockAnalysisResponse }
```

---

## 5. Các kiểu dữ liệu chính

### Server (`server/src/types/stock.ts`)

| Type / Interface | Mô tả | Dùng ở đâu |
|---|---|---|
| `NewsCategory` | Union: `"CÂN ĐỐI" \| "TĂNG TRƯỞNG" \| "RỦI RO" \| "DIỄN BIẾN GIÁ"` | classify.service, types |
| `NewsArticle` | Bài thô: title (đã clean), source, url (đã resolve), publishedAt (ISO), imageUrl? | news.service output |
| `CategorizedArticle` | Extends NewsArticle + `category` + `isFeatured?` + `summary?` | classify → image → controller |
| `StockAnalysisResponse` | Kết quả cuối: ticker + articles[] + cachedAt | controller → index → client |

### Client (`client/src/types/article.ts`)

| Type / Interface | Mô tả | Dùng ở đâu |
|---|---|---|
| `NewsCategory` | Giống server — phải khớp chính xác từng ký tự | BentoGrid filter, ArticleCard |
| `Article` | Khớp với `CategorizedArticle` server: title, url, **source**, publishedAt, imageUrl, category, isFeatured?, summary? | BentoGrid, HeroCard, ArticleCard |
| `StockApiResponse` | Shape JSON server trả về: `{ success, fromCache, data: { ticker, articles[], cachedAt } }` | useStockNews |
| `FetchState` | Discriminated union: idle / loading / success(data) / error(message) | useStockNews → App → BentoGrid |

### Ghi chú về `source`, `isFeatured` và `summary`
- `source` là tên báo nguồn (VD: "VnExpress", "CafeF") — hiển thị màu cam ở vị trí tag nhóm trong card, thay thế hardcode `"TIN TỨC"` cũ.
- Tag nhóm trong card hiển thị dạng `SOURCE / SUBCATEGORY` — source màu cam, category màu đen.
- Chỉ **đúng 1 bài** trong toàn bộ mảng có `isFeatured: true` — bài RỦI RO nghiêm trọng nhất.
- `summary` là đoạn standfirst ~50 từ kiểu báo tài chính, chỉ có khi `isFeatured = true`.
- HeroCard **chỉ render khi có bài RỦI RO** — không fallback sang bài bất kỳ.
- Cột 4 (RỦI RO) render `ruiRo.filter(a => !a.isFeatured)` — loại trừ bài đã lên HeroCard.

---

## 6. Biến môi trường (`server/.env`)

| Biến | Dùng ở | Mục đích |
|---|---|---|
| `PORT` | index.ts | Cổng server (mặc định 3000) |
| `GROQ_API_KEY` | classify.service.ts | Xác thực Groq API |
| `HUGGINGFACE_API_KEY` | image.service.ts | Xác thực HuggingFace FLUX |
| `CLOUDINARY_CLOUD_NAME` | firebase.ts | Tên cloud Cloudinary |
| `CLOUDINARY_API_KEY` | firebase.ts | API key Cloudinary |
| `CLOUDINARY_API_SECRET` | firebase.ts | API secret Cloudinary |

Firebase Admin xác thực qua `server/serviceAccountKey.json` (không dùng .env).

---

## 7. Routes Server

| Method | Path | File xử lý | Mô tả |
|---|---|---|---|
| GET | `/api/stock/:ticker` | stock.controller.ts | Incremental update + Firestore |
| GET | `/health` | index.ts | Health check đơn giản |
| * | `/*` | index.ts | 404 fallthrough |

> Route `/images/:filename` đã bỏ — ảnh giờ lưu trên Cloudinary CDN, client dùng URL trực tiếp.

---

## 8. Vite Proxy (dev only)

Client fetch `/api/*` → Vite dev server forward tới `http://localhost:3000/api/*`.  
Cấu hình trong `client/vite.config.ts`:
```ts
server: {
  proxy: {
    '/api': { target: 'http://localhost:3000', changeOrigin: true }
  }
}
```
Production cần nginx hoặc reverse proxy thực hiện tương tự.

---

## 9. Xử lý ảnh — thứ tự ưu tiên

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
                    ├── Thành công → upload Cloudinary (afad/VIC_0, overwrite=true)
                    │               trả https://res.cloudinary.com/...
                    └── Lỗi → imageUrl = "" (client tự fallback UI)
```

Mood map theo category:
- `CÂN ĐỐI` → balanced scale, financial charts, calm blue tones
- `TĂNG TRƯỞNG` → rising green arrows, cityscape, golden light
- `RỦI RO` → stormy sky, red warnings, dark tones
- `DIỄN BIẾN GIÁ` → candlestick chart, neon trading floor

---

## 10. Firestore — cấu trúc data

```
stocks/                    ← collection
  VIC/                     ← document (key = ticker UPPERCASE)
    ticker:    "VIC"
    updatedAt: Timestamp
    articles:  CategorizedArticle[]   ← tối đa 20 bài gần nhất
  HPG/
    ...
```

- Mỗi lần có bài mới → merge vào đầu mảng, cắt bớt nếu vượt 20 bài.
- Không có bài mới → đọc thẳng từ Firestore, không chạy pipeline.
- So sánh bài mới/cũ qua `article.url` (unique identifier).

---

## 11. UI — Banner thông báo

Tất cả banner nằm trong wrapper `width: 1316px` (khớp với grid) để không bị co dãn theo viewport khi màn hình nhỏ hơn grid.

| Trạng thái | Hiển thị |
|---|---|
| `loading` | Overlay trắng mờ toàn màn hình + spinner cam + text "Đang tải dữ liệu..." |
| `error` | Banner đỏ nhạt: "⚠ Lỗi: [message]" + "Vui lòng thử lại" |
| `success` + `articles.length === 0` | Banner cam đậm: badge ticker trắng + "Không tìm thấy tin tức nào cho mã [XYZ]" + "Hãy thử mã khác" |

---

## 12. Validate input — SearchPopup

- Regex: `^[A-Z0-9]{1,4}$` — chỉ chấp nhận chữ cái A-Z và số 0-9, tối đa 4 ký tự.
- Ký tự đặc biệt (`@`, `#`, `-`, `/`...) bị chặn, hiện thông báo lỗi inline trong popup.
- Lỗi tự xóa khi user bắt đầu gõ lại.
- Input tự động uppercase khi gõ.

---

## 13. Quy tắc quan trọng cần nhớ

- **Incremental update**: Chỉ xử lý bài chưa có trong Firestore — so sánh qua `url`. Không có bài mới → không tốn quota Groq/HuggingFace.
- **Firestore là nguồn duy nhất**: Không còn in-memory cache. Data persist qua restart server.
- **Cloudinary overwrite**: Cùng `public_id` (VD: `afad/VIC_0`) → ghi đè ảnh cũ, không tích lũy file thừa.
- **findFeaturedRisk trên toàn bộ**: Bước 3 chạy trên cả bài mới lẫn bài cũ để đánh giá RỦI RO đúng context.
- **Classify chỉ bài mới**: Bước 2 chỉ gửi bài mới cho Groq — bài cũ đã có category rồi.
- **Image chỉ bài mới**: Bài cũ đã có imageUrl, không sinh lại.
- **Retry Groq 429**: Tối đa 3 lần, delay `attempt × 30s` (30s, 60s).
- **Image song song**: `Promise.all` cho tất cả bài — lỗi 1 bài không chặn bài khác.
- **URL resolve**: Google News RSS trả redirect link → thử GET trước, HEAD fallback, timeout 5s.
- **Title clean**: Chỉ cắt đuôi " - Tên Báo" khi khớp chính xác với `source`.
- **Filter ticker chính xác**: Sau khi parse RSS, lọc bài theo `\bTICKER\b` trong title/URL — tránh nhầm mã (VD: "VCL" không nhận bài chứa "VLC").
- **HeroCard chỉ hiện khi có RỦI RO**: Không fallback sang bài bất kỳ — `heroArticle = isFeatured ?? ruiRo[0] ?? null`.
- **Không dùng Express**: Server là `http.createServer` thuần.
- **CORS**: Set `*` — chỉ phù hợp dev. Production nên lock lại domain cụ thể.
- **Không có mock data**: Client không dùng dữ liệu giả. Grid hiển thị rỗng cho đến khi user search ticker đầu tiên.
- **State lifting**: `useStockNews` hook khởi tạo ở `App.tsx`, truyền xuống qua props — không nhốt trong BentoGrid để dễ mở rộng sau.

---

## 14. Khi cần sửa — vào file nào?

| Việc cần làm | File cần mở |
|---|---|
| Thêm/sửa route API | `server/src/index.ts` |
| Thay đổi logic incremental update, số bài tối đa (MAX_ARTICLES_STORED) | `server/src/controllers/stock.controller.ts` |
| Thay đổi query RSS, số bài tối đa từ RSS, logic resolve URL, filter ticker | `server/src/services/news.service.ts` |
| Sửa prompt phân loại, thêm/bớt nhóm chủ đề | `server/src/services/classify.service.ts` → `classify()` |
| Sửa logic chọn bài nổi bật hoặc nội dung summary | `server/src/services/classify.service.ts` → `findFeaturedRisk()` |
| Đổi model sinh ảnh, sửa mood map theo category | `server/src/services/image.service.ts` |
| Sửa Cloudinary config, thay dịch vụ lưu ảnh | `server/src/firebase.ts` |
| Thêm/sửa TypeScript types server | `server/src/types/stock.ts` |
| Thêm/sửa TypeScript types client | `client/src/types/article.ts` |
| Sửa logic fetch API, xử lý lỗi, loading state | `client/src/hooks/useStockNews.ts` |
| Sửa UI layout lưới chính, logic phân loại 4 cột, banner thông báo | `client/src/layout/BentoGrid.tsx` |
| Sửa card hiển thị bài báo thường | `client/src/components/cards/ArticleCard.tsx` |
| Sửa card bài nổi bật (isFeatured) | `client/src/components/cards/HeroCard.tsx` |
| Sửa popup nhập ticker / validate / UX tìm kiếm | `client/src/components/popups/SearchPopup.tsx` |
| Sửa Vite proxy (dev) hoặc thêm alias | `client/vite.config.ts` |

---

## 15. Các API bên ngoài

| Service | Model / Endpoint | Ghi chú |
|---|---|---|
| Google News RSS | `news.google.com/rss/search` | Miễn phí, không cần key, realtime, tiếng Việt |
| Groq | `llama-3.3-70b-versatile` | Phân loại (temp=0.1) + chọn bài (temp=0.1, max_tokens=8) + summary (temp=0.4, max_tokens=300) |
| HuggingFace | `black-forest-labs/FLUX.1-schnell` | Sinh ảnh AI khi RSS không có ảnh, `x-wait-for-model: true` |
| Cloudinary | REST Upload API | Lưu ảnh AI, free tier 25GB, overwrite theo public_id |
| Firebase Firestore | `firebase-admin` SDK | Lưu data articles persist, collection `stocks` |

---

## 16. Tổng số Groq calls mỗi request (worst case)

| Call | Điều kiện | max_tokens |
|---|---|---|
| `classify()` | Khi có bài mới | 512 |
| `findFeaturedRisk()` — chọn bài | Chỉ khi > 1 bài RỦI RO | 8 |
| `findFeaturedRisk()` — sinh summary | Khi có ít nhất 1 bài RỦI RO | 300 |

Worst case: **3 Groq calls** / request (khi có bài mới + nhiều bài RỦI RO).  
Best case: **0 Groq calls** (không có bài mới → trả thẳng từ Firestore).

---

## 17. TODO — Việc còn lại

- [ ] **Cron job 5 phút**: Thêm `node-cron` để server tự động gọi pipeline cho các ticker đang theo dõi, không cần chờ client request.
- [ ] **Client đọc Firestore real-time**: Thay `fetch('/api/stock/...')` bằng Firebase SDK + `onSnapshot` để UI tự update khi có tin mới.
- [ ] **Danh sách ticker theo dõi**: Cần định nghĩa danh sách ticker cron sẽ quét (hardcode hoặc lưu Firestore).
- [ ] **CORS production**: Lock lại domain cụ thể khi deploy.
- [ ] **Nút reset / clear**: Gắn `reset()` từ `useStockNews` vào nút "X" trong UI để user quay về trạng thái rỗng.
