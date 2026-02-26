// ============================================================
// App.tsx
// Root component — điểm khởi đầu của toàn bộ ứng dụng.
//
// Nhiệm vụ của App rất đơn giản và cố ý giữ ngắn:
//   1. Khởi tạo hook useStockNews (nguồn dữ liệu duy nhất)
//   2. Truyền state + các hàm xuống BentoGrid
//
// App KHÔNG tự render UI — mọi giao diện đều do BentoGrid đảm nhiệm.
// Đây là pattern "lifting state up": state được giữ ở tầng cao nhất
// để các component con (SearchBar → SearchPopup → BentoGrid) đều truy cập được.
// ============================================================

import BentoGrid from "./layout/BentoGrid";
import { useStockNews } from "./hooks/useStockNews";


function App() {

  // ── Khởi tạo hook ──────────────────────────────────────
  // useStockNews trả về 3 thứ:
  //   state      → FetchState hiện tại (idle / loading / success / error)
  //   fetchStock → hàm gọi API, nhận ticker string (VD: "VIC")
  //   reset      → hàm quay về idle (xoá kết quả, hiện lại mock data)
  const { state, fetchStock } = useStockNews();
  // reset chưa gắn vào UI — dùng sau khi có nút "X" xoá kết quả hoặc nút huỷ lỗi
  // const { state, fetchStock, reset } = useStockNews();


  // ── Render ─────────────────────────────────────────────
  // Truyền xuống BentoGrid:
  //   fetchState → BentoGrid quyết định render gì (loading/error/data thật/mock)
  //   onSearch   → BentoGrid truyền tiếp xuống SearchBar → SearchPopup
  return (
    <BentoGrid
      fetchState={state}
      onSearch={fetchStock}
    />
  );
}

export default App;
