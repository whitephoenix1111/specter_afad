// ============================================================
// App.tsx
// Root component — điểm khởi đầu của toàn bộ ứng dụng.
//
// Nhiệm vụ:
//   1. Khởi tạo hook useStockNews (nguồn dữ liệu duy nhất)
//   2. Quản lý danh sách portfolio (lưu localStorage)
//   3. Auto-fetch MBB khi mount lần đầu
//   4. Truyền state + các hàm xuống BentoGrid
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
  const { state, fetchStock } = useStockNews();

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


  // ── Hàm chọn mã từ Portfolio ────────────────────────────────
  const handleSelectTicker = useCallback((ticker: string) => {
    setActiveTicker(ticker);
    fetchStock(ticker);
  }, [fetchStock]);


  // ── Hàm thêm mã mới vào Portfolio ──────────────────────────
  // Được gọi từ SearchPopup sau khi user submit ticker hợp lệ.
  const handleAddToPortfolio = useCallback((ticker: string) => {
    setPortfolio(prev => {
      // Không thêm trùng
      if (prev.includes(ticker)) return prev;
      const next = [...prev, ticker];
      savePortfolio(next);
      return next;
    });
    setActiveTicker(ticker);
  }, []);


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
      onAddToPortfolio={handleAddToPortfolio}
    />
  );
}

export default App;
