# AFAD — Client

Giao diện người dùng của AFAD, xây dựng bằng **React 19 + TypeScript + Vite + Tailwind CSS v4**.

Hiển thị tin tức cổ phiếu Việt Nam theo thời gian thực, phân loại tự động bởi AI, layout Bento Grid.

---

## Yêu cầu

- Node.js >= 18
- Server AFAD đang chạy (mặc định tại `http://localhost:3000`)
- Tài khoản Firebase (Firestore đã tạo collection `stocks`)

---

## Cài đặt

```bash
cd client
npm install
```

---

## Biến môi trường

Tạo file `.env` tại thư mục `client/`:

```env
VITE_API_BASE_URL=          # Để trống khi dev (dùng Vite proxy), điền URL production khi deploy
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

> Tất cả biến `VITE_FIREBASE_*` lấy từ Firebase Console → Project Settings → Web App config.

---

## Chạy development

```bash
npm run dev
```

Mở trình duyệt tại `http://localhost:5173`.

Khi dev, mọi request `/api/*` sẽ được Vite proxy tự động forward tới `http://localhost:3000` — không cần cấu hình CORS thêm.

---

## Build production

```bash
npm run build       # TypeScript compile + Vite bundle → dist/
npm run preview     # Preview bản build tại localhost:4173
```

---

## Cấu trúc thư mục `src/`

```
src/
├── App.tsx                             # Root component — portfolio localStorage, auto-fetch mặc định (SCS)
├── firebase.ts                         # Firebase Web SDK init, export db
├── hooks/
│   └── useStockNews.ts                 # Custom hook: fetchStock (trigger HTTP) + onSnapshot (realtime)
├── types/
│   └── article.ts                      # TypeScript interfaces: Article, FetchState, StockApiResponse
├── layout/
│   └── BentoGrid.tsx                   # Grid 5 cột, phân loại 4 nhóm, MAX_VISIBLE = 2 bài/cột
├── utils/
│   └── fallbackImage.ts                # resolveImageUrl() + makeOnError() — SVG fallback theo category
└── components/
    ├── cards/
    │   ├── ArticleCard.tsx              # Card bài báo thông thường
    │   ├── HeroCard.tsx                 # Card bài nổi bật (isFeatured), chiếm 2 cột giữa
    │   └── EmptyColumnPlaceholder.tsx   # Card ngủ (bài cũ mờ) hoặc quote editorial
    ├── popups/
    │   ├── SearchPopup.tsx              # Validate + submit mã cổ phiếu (regex ^[A-Z0-9]{1,3}$)
    │   └── SpecterPopup.tsx
    └── widgets/
        ├── Calendar.tsx
        ├── Porfolio.tsx                 # Danh mục — flex-wrap-reverse, 2 mã/hàng
        └── SearchBar.tsx                # Mở SearchPopup
```

---

## Luồng hoạt động

1. App mount → tự động fetch mã mặc định (`DEFAULT_TICKER = "SCS"` trong `App.tsx`)
2. User nhập mã → `SearchPopup` validate → `App.handleSearch` → `useStockNews.fetchStock(ticker)`
3. Hook subscribe `onSnapshot` Firestore **trước**, sau đó mới gọi HTTP trigger server
4. Server chạy pipeline xong → ghi Firestore → `onSnapshot` tự nhận và cập nhật UI
5. `BentoGrid` nhận `articles` → phân loại 4 nhóm → render `HeroCard` + `ArticleCard`

---

## Các hằng số cần biết

| Hằng số | File | Mặc định | Ý nghĩa |
|---|---|---|---|
| `DEFAULT_TICKER` | `App.tsx` | `"SCS"` | Mã tự động fetch khi app khởi động |
| `MAX_VISIBLE` | `BentoGrid.tsx` | `2` | Số bài tối đa hiển thị mỗi cột |
| `"afad_portfolio"` | `App.tsx` | — | Key localStorage lưu danh mục |

---

## Màu accent theo category

| Category | Màu |
|---|---|
| CÂN ĐỐI | `#6B7280` |
| TĂNG TRƯỞNG | `#16A34A` |
| RỦI RO | `#DC2626` |
| DIỄN BIẾN GIÁ | `#2563EB` |

---

## Lưu ý

- `imageUrl` luôn là `string` (không `undefined`) — server trả `""` khi lỗi ảnh, `fallbackImage.ts` xử lý thành SVG local tại `public/fallbacks/{category}.svg`
- `HeroCard` chỉ render khi có ít nhất 1 bài thuộc nhóm RỦI RO
- Portfolio chỉ được lưu khi fetch thành công **và** có ít nhất 1 bài trả về
- Khi đổi ticker, listener `onSnapshot` cũ bị hủy trước khi subscribe listener mới
