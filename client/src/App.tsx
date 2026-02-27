// ============================================================
// App.tsx
// Root component — điểm khởi đầu của toàn bộ ứng dụng.
//
// Nhiệm vụ:
//   1. Khởi tạo hook useStockNews (nguồn dữ liệu duy nhất)
//   2. Quản lý danh sách portfolio (lưu localStorage)
//   3. Auto-fetch MBB khi mount lần đầu
//   4. Truyền state + các hàm xuống BentoGrid
//
// Quy tắc portfolio:
//   Mã chỉ được lưu vào localStorage khi fetch thành công VÀ có bài trả về.
//   Việc này được xử lý hoàn toàn trong useEffect theo dõi state —
//   không phụ thuộc vào SearchBar hay SearchPopup.
// ============================================================

import { useEffect, useState, useCallback } from "react";
import BentoGrid from "./layout/BentoGrid";
import { useStockNews } from "./hooks/useStockNews";

// ── Hằng số ──────────────────────────────────────────────────
const STORAGE_KEY = "afad_portfolio";
const DEFAULT_PORTFOLIO = ["MBB"];   // MBB luôn là mã mặc định đầu tiên

// ── Helper: đọc / ghi localStorage ──────────────────────────
function loadPortfolio(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PORTFOLIO;
    const parsed = JSON.parse(raw);
    // Đảm bảo luôn là mảng string
    if (!Array.isArray(parsed)) return DEFAULT_PORTFOLIO;
    // Đảm bảo MBB luôn ở đầu danh sách
    const withMBB = ["MBB", ...parsed.filter((t: string) => t !== "MBB")];
    return withMBB;
  } catch {
    return DEFAULT_PORTFOLIO;
  }
}

function savePortfolio(tickers: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
  } catch {
    // localStorage unavailable — silent fail
  }
}


function App() {

  // ── Hook fetch ──────────────────────────────────────────────
  const { state, fetchStock, reset } = useStockNews();

  // ── Portfolio state ─────────────────────────────────────────
  // Khởi tạo ngay từ localStorage — không cần useEffect để tránh flash
  const [portfolio, setPortfolio] = useState<string[]>(loadPortfolio);

  // Ticker đang được chọn / đang hiển thị trong BentoGrid
  const [activeTicker, setActiveTicker] = useState<string>("MBB");


  // ── Auto-fetch MBB khi app khởi động ────────────────────────
  useEffect(() => {
    fetchStock("MBB");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // chỉ chạy 1 lần khi mount


  // ── Tự động lưu portfolio sau khi fetch thành công ──────────
  // Đây là nơi DUY NHẤT quyết định có lưu mã vào localStorage không.
  // Điều kiện: status === "success" VÀ có ít nhất 1 bài trả về.
  // → Mã không tồn tại / không có tin sẽ không bao giờ được lưu.
  useEffect(() => {
    if (state.status === "success" && state.data.articles.length > 0) {
      const ticker = state.data.ticker;
      setPortfolio(prev => {
        if (prev.includes(ticker)) return prev; // tránh re-render nếu đã có
        const next = [...prev, ticker];
        savePortfolio(next);
        return next;
      });
    }
  }, [state]);


  // ── Hàm chọn mã từ Portfolio ────────────────────────────────
  const handleSelectTicker = useCallback((ticker: string) => {
    setActiveTicker(ticker);
    fetchStock(ticker);
  }, [fetchStock]);


  // ── Wrap fetchStock để cập nhật activeTicker đồng thời ──────
  // SearchBar/SearchPopup gọi onSearch → cần cập nhật activeTicker
  const handleSearch = useCallback((ticker: string) => {
    setActiveTicker(ticker.trim().toUpperCase());
    fetchStock(ticker);
  }, [fetchStock]);


  // ── Render ──────────────────────────────────────────────────
  return (
    <BentoGrid
      fetchState={state}
      onSearch={handleSearch}
      portfolio={portfolio}
      activeTicker={activeTicker}
      onSelectTicker={handleSelectTicker}
      onReset={reset}
    />
  );
}

export default App;
