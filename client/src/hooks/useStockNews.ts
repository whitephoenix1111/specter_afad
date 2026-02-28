// ============================================================
// hooks/useStockNews.ts
// Custom React hook — toàn bộ logic gọi API nằm ở đây.
//
// Nhiệm vụ:
//   1. Giữ trạng thái fetch (FetchState) trong React state
//   2. Cung cấp hàm fetchStock(ticker) để component gọi
//   3. Cung cấp hàm reset() để quay về trạng thái idle
// ============================================================

import { useState, useCallback } from "react";
import type { FetchState, StockApiResponse } from "../types/article";


export function useStockNews() {

  // ── BƯỚC 1: Khởi tạo state ──────────────────────────────
  // Trạng thái ban đầu là "idle" — chưa có gì xảy ra.
  // Mọi thay đổi UI (loading spinner, error banner, render data) đều
  // phụ thuộc vào giá trị state.status này.
  const [state, setState] = useState<FetchState>({ status: "idle" });


  // ── BƯỚC 2: Hàm gọi API ─────────────────────────────────
  // useCallback để hàm không bị tạo lại mỗi lần render — tránh vòng lặp
  // vô hạn nếu component dùng fetchStock trong useEffect.
  const fetchStock = useCallback(async (ticker: string, silent = false) => {

    // Bước 2a: Làm sạch input — trim khoảng trắng, chuyển hoa.
    // "vic " → "VIC", " HPG" → "HPG"
    const normalized = ticker.trim().toUpperCase();

    // Không làm gì nếu chuỗi rỗng sau khi trim (người dùng ấn submit lúc input trống)
    if (!normalized) return;

    // Bước 2b: Chuyển sang loading ngay lập tức — trừ khi silent (polling ngầm).
    // BentoGrid sẽ thấy status = "loading" và hiện overlay spinner.
    if (!silent) setState({ status: "loading" });

    try {

      // Bước 2c: Gọi API.
      // URL dạng tương đối "/api/stock/VIC" — Vite dev server sẽ proxy
      // request này tới http://localhost:3000/api/stock/VIC (cấu hình trong vite.config.ts).
      // Khi build production, cần nginx hoặc reverse proxy thực hiện việc tương tự.
      const res = await fetch(`/api/stock/${normalized}`);

      // Bước 2d: Kiểm tra HTTP status code.
      // res.ok = true khi status nằm trong 200-299.
      // 404, 500, v.v. đều bị throw ở đây với message cụ thể.
      if (!res.ok) {
        throw new Error(`Server trả lỗi ${res.status}: ${res.statusText}`);
      }

      // Bước 2e: Parse JSON — ép kiểu về StockApiResponse để TypeScript kiểm tra.
      const json: StockApiResponse = await res.json();

      // Bước 2f: Kiểm tra tầng logic — server có thể trả HTTP 200
      // nhưng vẫn báo thất bại trong body JSON (field success: false).
      if (!json.success) {
        throw new Error("Server báo không thành công");
      }

      // Bước 2g: Mọi thứ OK → chuyển sang success, lưu data.
      // BentoGrid sẽ thấy status = "success" và render articles thật.
      setState({ status: "success", data: json.data });

    } catch (err) {

      // Bước 2h: Bất kỳ lỗi nào (network, parse JSON, logic) đều rơi vào đây.
      // BentoGrid sẽ thấy status = "error", hiện banner, giữ mock data.
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Lỗi không xác định",
      });
    }
  }, []); // [] → không có dependency, hàm chỉ tạo 1 lần duy nhất


  // ── BƯỚC 3: Hàm reset ───────────────────────────────────
  // Dùng khi muốn quay về màn hình ban đầu (chưa search).
  // Hiện tại được truyền xuống BentoGrid qua prop onReset nhưng chưa gắn vào nút nào —
  // sẵn sàng dùng khi cần (VD: nút "X" xoá kết quả).
  const reset = useCallback(() => {
    setState({ status: "idle" });
  }, []);


  // ── BƯỚC 4: Trả ra ngoài ─────────────────────────────────
  // App.tsx destructure { state, fetchStock, reset } từ hook này,
  // rồi truyền xuống BentoGrid dưới dạng props.
  return { state, fetchStock, reset };
}
