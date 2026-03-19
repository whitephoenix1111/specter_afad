# AFAD — Server

Backend của AFAD, xây dựng bằng **Node.js HTTP thuần + TypeScript**.

Nhận trigger từ client → chạy pipeline RSS → Groq classify → HuggingFace image → Cloudinary → Firestore.

---

## Yêu cầu

- Node.js >= 18
- Tài khoản Groq (API key)
- Tài khoản HuggingFace (API key)
- Tài khoản Cloudinary (cloud name + API key + API secret)
- Firebase project (Firestore đã khởi tạo, file `serviceAccountKey.json`)

---

## Cài đặt

```bash
cd server
npm install
```

---

## Biến môi trường

Tạo file `.env` tại thư mục `server/`:

```env
PORT=3000
GROQ_API_KEY=
HUGGINGFACE_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

---

## Firebase Admin

Đặt file `serviceAccountKey.json` tại thư mục `server/`.  
Lấy từ Firebase Console → Project Settings → Service Accounts → Generate new private key.

> **Không commit file này lên git.**

---

## Chạy development

```bash
npm run dev
```

Server khởi động tại `http://localhost:3000`, tự động reload khi sửa file `src/` nhờ `nodemon` + `tsx`.

---

## Build & chạy production

```bash
npm run build       # TypeScript compile → dist/
npm run start       # Chạy dist/index.js
```

---

## Cấu trúc thư mục `src/`

```
src/
├── index.ts                            # HTTP server, định nghĩa routes, CORS
├── firebase.ts                         # Firebase Admin SDK init + Cloudinary upload helper
├── controllers/
│   └── stock.controller.ts             # Orchestrator toàn bộ pipeline, đọc/ghi Firestore
├── services/
│   ├── news.service.ts                 # RSS fetch, resolve redirect URL, filter ticker 2 lớp
│   ├── classify.service.ts             # Groq: classify() phân loại bài + findFeaturedRisk() chọn bài nổi bật
│   └── image.service.ts                # Ảnh RSS hoặc HuggingFace FLUX → upload Cloudinary
└── types/
    └── stock.ts                        # TypeScript interfaces server: NewsArticle, CategorizedArticle, ...
```

---

## Routes

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/api/stock/:ticker` | Trigger pipeline cho mã cổ phiếu, ghi kết quả vào Firestore |
| `GET` | `/health` | Health check |
| `*` | `/*` | 404 |

**Regex route:** `/^\/api\/stock\/([A-Za-z.]+)$/` — cho phép dấu chấm (VD: `VN30`).

---

## Pipeline chi tiết

```
GET /api/stock/:ticker
  │
  ├─ [0] Đọc Firestore → lấy danh sách URL đã lưu (existingUrls)
  │
  ├─ [1] news.service: RSS Google News → parse XML → resolve redirect URL (song song)
  │       → Layer 1 filter: \bTICKER\b trong title/URL
  │       → Layer 2 filter: domain báo tài chính HOẶC từ khóa chứng khoán
  │       → < 2 bài hợp lệ → throw lỗi rõ ràng về client
  │
  ├─ So sánh URL → lọc chỉ bài mới (chưa có trong existingUrls)
  │   Không có bài mới? → trả về { fromCache: true }, kết thúc sớm (0 API calls)
  │
  ├─ [2] classify.service.classify(): 1 Groq call — phân loại tất cả bài mới vào 4 nhóm
  │
  ├─ [3] classify.service.findFeaturedRisk(): chọn bài nổi bật trong toàn bộ mảng (mới + cũ)
  │       0 bài RỦI RO → skip
  │       1 bài RỦI RO → chọn luôn
  │       > 1 bài RỦI RO → 1 Groq call (max_tokens=8) chọn bài quan trọng nhất
  │       + 1 Groq call sinh summary ~50 từ (max_tokens=300)
  │
  ├─ [4] image.service: Promise.all song song cho từng bài mới
  │       Có imageUrl từ RSS? → dùng luôn
  │       Không có → HuggingFace FLUX.1-schnell sinh ảnh → upload Cloudinary
  │       Lỗi → imageUrl = ""
  │
  └─ Merge [...newArticles, ...oldArticles].slice(0, 20) → ghi Firestore
      → onSnapshot client tự nhận update
```

**Worst case: 3 Groq calls** (classify + chọn featured + sinh summary)  
**Best case: 0 Groq calls** (không có bài mới, trả cache)

---

## Firestore Schema

```
stocks/{ticker}
  ticker:    string
  updatedAt: Timestamp
  articles:  CategorizedArticle[]    # tối đa 20 bài, mới nhất đầu mảng
```

**Security Rules:**
```
match /stocks/{ticker} {
  allow read: if true;    # client onSnapshot đọc được
  allow write: if false;  # chỉ server Admin SDK mới ghi được
}
```

---

## Xử lý ảnh AI

| Bước | Mô tả |
|---|---|
| 1 | Nếu RSS có `<media:content>` → dùng URL đó luôn |
| 2 | Không có → gọi HuggingFace `FLUX.1-schnell` với prompt mood theo category |
| 3 | Upload kết quả lên Cloudinary, `public_id = afad/{TICKER}_{index}`, `overwrite = true` |
| 4 | Lỗi bất kỳ bước nào → `imageUrl = ""`, client tự fallback sang SVG local |

**Mood prompt theo category:**
- `CÂN ĐỐI` → balanced scale, financial charts, calm blue tones
- `TĂNG TRƯỞNG` → rising green arrows, cityscape, golden light
- `RỦI RO` → stormy sky, red warnings, dark tones
- `DIỄN BIẾN GIÁ` → candlestick chart, neon trading floor

---

## Retry & giới hạn

- **Groq 429 (rate limit):** retry tối đa 3 lần, delay `attempt × 30s`
- **Image song song:** `Promise.all` — lỗi 1 bài không chặn bài còn lại
- **Tối đa 20 bài** lưu Firestore mỗi ticker (slice sau merge)
- **CORS:** hiện tại `*` — chỉ phù hợp dev, cần giới hạn khi production

---

## Lưu ý

- Không dùng Express — `http.createServer` thuần
- `serviceAccountKey.json` **không được commit git**
- Cloudinary dùng `overwrite: true` theo `public_id` → không tích lũy file thừa trên cloud
- Filter ticker Layer 2 giúp tránh nhầm mã trùng từ thông dụng (VD: `KOL`, `CEO`, `BOT`)
