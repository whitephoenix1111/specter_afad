# AFAD — Reference (Chi tiết kỹ thuật)

> File này chứa thông tin tra cứu khi cần. Đọc thường ngày → dùng `ARCHITECTURE.md`.

---

## Luồng dữ liệu Client

```
SearchPopup → validate (^[A-Z0-9]{1,3}$) → onSubmit(ticker)
  → SearchBar.onSearch → App.handleSearch → setActiveTicker + fetchStock
    → useStockNews: setState(loading)
      → subscribeToTicker: onSnapshot lắng nghe stocks/{ticker}
      → fetch /api/stock/VIC (trigger pipeline, không đọc response)
        → lỗi HTTP: đọc JSON body lấy message → setState(error) nếu onSnapshot chưa cập nhật gì
        → Firestore ghi xong → onSnapshot fire → setState(success)
          → App useEffect lưu portfolio nếu có bài
            → BentoGrid: filter 4 nhóm → heroArticle → render grid
```

**onSnapshot behavior:**
- Fire ngay lập tức khi subscribe nếu document đã tồn tại (data cũ từ cache)
- Fire lần 2 nếu server pipeline tìm được bài mới và ghi vào Firestore
- Đổi ticker → unsubscribe listener cũ, subscribe listener mới
- Unmount → cleanup tự động qua useEffect

**BentoGrid render logic:**
- `heroArticle = articles.find(a => a.isFeatured) ?? ruiRo[0] ?? null`
- Cột RỦI RO render `ruiRo.filter(a => !a.isFeatured)`
- `MAX_VISIBLE = 2` bài/cột, nút "+ X tin khác" nếu vượt

---

## Luồng dữ liệu Server

```
GET /api/stock/VIC
  → controller: đọc Firestore → lấy existingUrls (Set<string>)
  → [1] news.service: RSS → parse XML → resolve URL song song
        → Layer 1: filter \bVIC\b trong title/URL
        → Layer 2: heuristic tài chính (domain báo tài chính HOẶC từ khóa CK)
        → < 2 bài hợp lệ → throw lỗi "Không tìm thấy tin tức cổ phiếu hợp lệ..."
  → lọc bài mới (url chưa có trong existingUrls)
  → không có bài mới? → trả Firestore { fromCache: true }
  → [2] classify.service.classify(): 1 Groq call, tất cả tiêu đề bài mới
  → [3] classify.service.findFeaturedRisk(): toàn bộ mảng (mới+cũ)
        0 RỦI RO → skip | 1 RỦI RO → chọn luôn | >1 → 1 Groq call (max_tokens=8)
        + 1 Groq call sinh summary (max_tokens=300)
  → [4] image.service: Promise.all — RSS imageUrl? dùng luôn : HuggingFace → Cloudinary
  → merge [...newWithImages, ...oldArticles].slice(0, 20) → ghi Firestore
  → onSnapshot client tự nhận update
```

**Worst case: 3 Groq calls** | **Best case: 0 Groq calls**

---

## TypeScript Types

### Server (`server/src/types/stock.ts`)
```ts
type NewsCategory = "CÂN ĐỐI" | "TĂNG TRƯỞNG" | "RỦI RO" | "DIỄN BIẾN GIÁ"

interface NewsArticle {
  title: string       // đã clean đuôi " - Tên Báo"
  source: string      // tên báo
  url: string         // đã resolve redirect
  publishedAt: string // ISO 8601
  imageUrl?: string   // từ <media:content>, undefined nếu không có
}

interface CategorizedArticle extends NewsArticle {
  category: NewsCategory
  isFeatured?: boolean  // chỉ đúng 1 bài trong toàn mảng
  summary?: string      // ~50 từ, chỉ khi isFeatured = true
}

interface StockAnalysisResponse {
  ticker: string
  articles: CategorizedArticle[]
  cachedAt: Date
}
```

### Client (`client/src/types/article.ts`)
```ts
// imageUrl là string BẮT BUỘC (không optional) — server trả "" khi lỗi
interface Article {
  title: string; url: string; source: string
  publishedAt: string; imageUrl: string
  category: NewsCategory
  isFeatured?: boolean; summary?: string
}

interface StockApiResponse {
  success: boolean; fromCache: boolean
  data: { ticker: string; articles: Article[]; cachedAt: string }
}

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: StockApiResponse["data"] }
  | { status: "error"; message: string }
```

---

## Biến môi trường (`server/.env`)

| Biến | Dùng ở |
|---|---|
| `PORT` | index.ts (default 3000) |
| `GROQ_API_KEY` | classify.service.ts |
| `HUGGINGFACE_API_KEY` | image.service.ts |
| `CLOUDINARY_CLOUD_NAME` | firebase.ts |
| `CLOUDINARY_API_KEY` | firebase.ts |
| `CLOUDINARY_API_SECRET` | firebase.ts |

Firebase Admin → `server/serviceAccountKey.json` (không dùng .env, KHÔNG commit git).
Firebase Web SDK config → `client/src/firebase.ts` (KHÔNG commit git — chứa apiKey).

---

## Routes Server

| Method | Path | Xử lý |
|---|---|---|
| GET | `/api/stock/:ticker` | stock.controller.ts |
| GET | `/health` | index.ts |
| * | `/*` | 404 |

Route regex: `/^\/api\/stock\/([A-Za-z.]+)$/` (cho phép dấu chấm, VD: VN30).

---

## Firestore Schema

```
stocks/{ticker}
  ticker:    string
  updatedAt: Timestamp
  articles:  CategorizedArticle[]  // tối đa 20 bài, mới nhất đầu
```

**Security Rules:**
```
match /stocks/{ticker} {
  allow read: if true;   // client onSnapshot đọc được
  allow write: if false; // chỉ server Admin SDK mới ghi được
}
```

---

## Xử lý ảnh

**Thứ tự ưu tiên:**
1. `imageUrl` từ `<media:content>` trong RSS → dùng luôn
2. Không có → HuggingFace FLUX.1-schnell → upload Cloudinary (`afad/VIC_0`, overwrite=true)
3. Lỗi HuggingFace/Cloudinary → `imageUrl = ""`

**Client fallback** (`utils/fallbackImage.ts`):
- `imageUrl` rỗng → SVG local tại `public/fallbacks/{category}.svg`
- `makeOnError()` tránh vòng lặp vô hạn khi cả fallback cũng lỗi

**Mood map AI prompt:**
- `CÂN ĐỐI` → balanced scale, financial charts, calm blue tones
- `TĂNG TRƯỞNG` → rising green arrows, cityscape, golden light
- `RỦI RO` → stormy sky, red warnings, dark tones
- `DIỄN BIẾN GIÁ` → candlestick chart, neon trading floor

---

## UI — Trạng thái & Chi tiết

### Banners (wrapper width: 1316px)
| State | Hiển thị |
|---|---|
| `loading` | Overlay + spinner cam |
| `error` | Banner đỏ + nút ✕ gọi `onReset` |
| `success` + 0 bài | Banner cam + badge ticker + nút ✕ |

### EmptyColumnPlaceholder
| Tình huống | Hiển thị |
|---|---|
| Có `oldArticle` | Card ngủ: opacity 45% → hover 70%, grayscale → màu, transition 700ms |
| Không có gì | Quote editorial: màu accent + quote xoay theo dayOfYear |

Màu accent: CÂN ĐỐI `#6B7280` · TĂNG TRƯỞNG `#16A34A` · RỦI RO `#DC2626` · DIỄN BIẾN GIÁ `#2563EB`

### Portfolio
- localStorage key: `"afad_portfolio"`, default: `["SCS"]`
- Lưu ticker khi `status === "success"` VÀ `articles.length > 0`
- Layout: `flex-wrap-reverse`, button `flex-1 min-w-[calc(50%-4px)]` → 2 mã/hàng

### Validate SearchPopup
- Regex: `^[A-Z0-9]{1,3}$`, `maxLength={3}`, auto-uppercase
- Lý do 3 ký tự: mã cổ phiếu Việt Nam (HOSE/HNX/UPCOM) tối đa 3 ký tự

---

## Vite Proxy (dev)

```ts
// client/vite.config.ts
proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } }
```

---

## APIs bên ngoài

| Service | Endpoint / Model |
|---|---|
| Google News RSS | `news.google.com/rss/search?q=VIC+cổ+phiếu&hl=vi&gl=VN` |
| Groq | `llama-3.3-70b-versatile` |
| HuggingFace | `black-forest-labs/FLUX.1-schnell` (`x-wait-for-model: true`) |
| Cloudinary | REST Upload API, folder `afad/` |
| Firestore | `firebase-admin` (server) + `firebase` Web SDK (client, onSnapshot) |
