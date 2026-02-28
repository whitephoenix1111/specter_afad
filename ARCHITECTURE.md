# AFAD — Architecture (Quick Reference)

> Đọc file này trước. Chi tiết luồng dữ liệu / types / API → xem `REFERENCE.md`.

---

## Tổng quan

**Client** (React/Vite) → `GET /api/stock/:ticker` → **Server** (Node.js HTTP thuần):
`RSS → Groq classify → Groq featured → HuggingFace image → Cloudinary → Firestore → onSnapshot → Client`

---

## Cấu trúc thư mục

```
AFAD/
├── client/src/
│   ├── App.tsx                     # Hook + portfolio localStorage + auto-fetch SCS
│   ├── firebase.ts                 # Firebase Web SDK init + export db
│   ├── hooks/useStockNews.ts       # fetchStock (trigger) + onSnapshot (realtime)
│   ├── types/article.ts            # TS types client (Article, FetchState, StockApiResponse)
│   ├── layout/BentoGrid.tsx        # Grid 5 cột, phân loại 4 nhóm, render
│   ├── utils/fallbackImage.ts      # resolveImageUrl() + makeOnError() — SVG fallback
│   └── components/
│       ├── cards/
│       │   ├── ArticleCard.tsx
│       │   ├── HeroCard.tsx        # Bài isFeatured — chiếm 2 cột giữa
│       │   └── EmptyColumnPlaceholder.tsx  # Card ngủ hoặc quote editorial
│       ├── popups/
│       │   ├── SearchPopup.tsx     # Validate + submit ticker
│       │   └── SpecterPopup.tsx
│       └── widgets/
│           ├── Calendar.tsx
│           ├── Porfolio.tsx        # Danh mục — flex-wrap-reverse, 2 mã/hàng
│           └── SearchBar.tsx       # Mở SearchPopup
│
└── server/src/
    ├── index.ts                    # HTTP server, routes
    ├── firebase.ts                 # Firebase Admin + Cloudinary upload helper
    ├── controllers/stock.controller.ts   # Orchestrator pipeline + Firestore
    ├── services/
    │   ├── news.service.ts         # RSS fetch + resolve URL + filter ticker
    │   ├── classify.service.ts     # Groq: classify() + findFeaturedRisk()
    │   └── image.service.ts        # Ảnh RSS hoặc HuggingFace → Cloudinary
    └── types/stock.ts              # TS interfaces server
```

---

## Khi cần sửa — vào file nào?

| Việc cần làm | File |
|---|---|
| Thêm/sửa route API | `server/src/index.ts` |
| Logic incremental update, MAX_ARTICLES_STORED | `server/src/controllers/stock.controller.ts` |
| Query RSS, resolve URL, filter ticker | `server/src/services/news.service.ts` |
| Prompt phân loại, thêm/bớt nhóm | `server/src/services/classify.service.ts` → `classify()` |
| Chọn bài nổi bật, nội dung summary | `server/src/services/classify.service.ts` → `findFeaturedRisk()` |
| Model sinh ảnh, mood map | `server/src/services/image.service.ts` |
| Cloudinary config | `server/src/firebase.ts` |
| TS types server | `server/src/types/stock.ts` |
| TS types client | `client/src/types/article.ts` |
| Firebase Web SDK config (client) | `client/src/firebase.ts` |
| Logic fetch trigger, onSnapshot, loading/error state | `client/src/hooks/useStockNews.ts` |
| Mã mặc định, portfolio, auto-fetch, localStorage | `client/src/App.tsx` → `DEFAULT_TICKER` |
| Layout grid, phân loại 4 cột, banners | `client/src/layout/BentoGrid.tsx` |
| MAX_VISIBLE (số bài/cột, hiện tại = 2) | `client/src/layout/BentoGrid.tsx` → `MAX_VISIBLE` |
| Fallback SVG, xử lý imageUrl rỗng | `client/src/utils/fallbackImage.ts` |
| Card bài thường | `client/src/components/cards/ArticleCard.tsx` |
| Card bài nổi bật | `client/src/components/cards/HeroCard.tsx` |
| Placeholder cột trống | `client/src/components/cards/EmptyColumnPlaceholder.tsx` |
| Quote pool | `client/src/components/cards/EmptyColumnPlaceholder.tsx` → `QUOTES` |
| Portfolio widget UI | `client/src/components/widgets/Porfolio.tsx` |
| Popup tìm kiếm, validate | `client/src/components/popups/SearchPopup.tsx` |
| Vite proxy | `client/vite.config.ts` |

---

## Quy tắc quan trọng

- **Incremental update**: So sánh `url` — chỉ xử lý bài mới. Không có bài mới → 0 Groq/HuggingFace calls, trả thẳng Firestore.
- **Classify chỉ bài mới**, **findFeaturedRisk trên toàn bộ** (mới + cũ), **Image chỉ bài mới**.
- **Firestore là nguồn duy nhất** — không còn in-memory cache.
- **Cloudinary overwrite** theo `public_id` (`afad/VIC_0`) — không tích lũy file thừa.
- **imageUrl client = `string` bắt buộc** — server trả `""` khi lỗi, `fallbackImage.ts` xử lý → SVG local.
- **HeroCard**: `heroArticle = articles.find(a => a.isFeatured) ?? ruiRo[0] ?? null` — chỉ render khi có RỦI RO.
- **EmptyColumnPlaceholder**: chỉ render khi `status === "success"`.
- **MAX_VISIBLE = 2** — hằng số trong `BentoGrid.tsx`.
- **Portfolio**: key `"afad_portfolio"`, mã mặc định do `DEFAULT_TICKER` ở `App.tsx` quyết định (hiện tại `SCS`) — đổi 1 chỗ là đổi khắp nơi, chỉ lưu khi fetch thành công VÀ có bài.
- **Auto-fetch `DEFAULT_TICKER`** khi app mount (`useEffect []` trong `App.tsx`).
- **Realtime**: client dùng `onSnapshot` (Firestore WebSocket) thay vì polling. `fetchStock` chỉ là trigger HTTP để server chạy pipeline — data thật đến qua `onSnapshot`. Đổi ticker → unsubscribe listener cũ, subscribe listener mới.
- **Retry Groq 429**: tối đa 3 lần, delay `attempt × 30s`.
- **Image song song**: `Promise.all` — lỗi 1 bài không chặn bài khác.
- **Filter ticker**: `\bTICKER\b` trong title/URL — tránh nhầm mã (VCL ≠ VLC).
- **Không dùng Express** — `http.createServer` thuần.
- **Route regex**: `/^\/api\/stock\/([A-Za-z.]+)$/` — cho phép dấu chấm.
- **CORS `*`** — chỉ phù hợp dev.
- **Firestore Security Rules**: `stocks/{ticker}` — `allow read: if true`, `allow write: if false`. Chỉ server (Admin SDK) mới ghi được.

---

## TODO

- [x] ~~Cron job~~ → thay bằng client-side polling (đơn giản hơn, đúng ticker đang xem)
- [x] ~~Polling~~ → thay bằng Firestore `onSnapshot` (realtime, không tốn request thừa)
- [ ] CORS production
