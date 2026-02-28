// ============================================================
// hooks/useStockNews.ts
// Custom React hook — quản lý data và realtime listener.
//
// Kiến trúc Option B:
//   - fetchStock(ticker): gọi HTTP để trigger server pipeline (RSS → Groq → Firestore)
//     Không cần đọc response — data sẽ đến qua onSnapshot.
//   - onSnapshot: lắng nghe Firestore realtime, cập nhật state ngay khi server ghi xong.
//   - Khi đổi ticker: unsubscribe listener cũ, subscribe listener mới, fetch trigger.
//   - Không còn polling setInterval.
// ============================================================

import { useState, useCallback, useEffect, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import type { FetchState, Article, StockApiResponse } from "../types/article";

// Type alias cho hàm unsubscribe trả về bởi onSnapshot.
// Được lưu trong ref để có thể hủy listener bất cứ lúc nào.
type Unsubscribe = () => void;

export function useStockNews() {

  // state: trạng thái hiện tại của dữ liệu — idle / loading / success / error.
  // Sử dụng discriminated union (FetchState) để đảm bảo type-safe ở UI.
  const [state, setState] = useState<FetchState>({ status: "idle" });

  // unsubRef: giữ hàm unsubscribe của onSnapshot hiện tại.
  // Dùng ref thay vì state vì việc thay đổi nó không cần trigger re-render.
  const unsubRef = useRef<Unsubscribe | null>(null);

  // listeningTickerRef: theo dõi ticker mà onSnapshot đang lắng nghe.
  // Tránh subscribe lại vào cùng 1 ticker (idempotent guard).
  const listeningTickerRef = useRef<string | null>(null);


  // subscribeToTicker: bắt đầu lắng nghe Firestore realtime cho 1 ticker.
  //
  // Logic:
  //   - Nếu đang lắng nghe đúng ticker này rồi → bỏ qua (idempotent).
  //   - Nếu đang lắng nghe ticker khác → unsubscribe cũ trước.
  //   - Subscribe mới vào `stocks/{ticker}` trên Firestore.
  //
  // onSnapshot callback:
  //   - Firestore push xuống mỗi khi server ghi xong pipeline.
  //   - Nếu doc chưa tồn tại (server chưa ghi lần nào) → bỏ qua, giữ trạng thái loading.
  //   - imageUrl được normalize về "" nếu undefined (client luôn nhận string, không phải undefined).
  //   - updatedAt là Firestore Timestamp → chuyển sang ISO string cho UI.
  const subscribeToTicker = useCallback((ticker: string) => {
    if (listeningTickerRef.current === ticker) return;

    // Hủy listener cũ nếu đang có
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    listeningTickerRef.current = ticker;

    const docRef = doc(db, "stocks", ticker);

    const unsub = onSnapshot(
      docRef,
      (snapshot) => {
        // Doc chưa tồn tại: server chưa ghi xong → chờ, không làm gì
        if (!snapshot.exists()) return;

        const data = snapshot.data();

        // Normalize imageUrl: server có thể gửi "" khi lỗi ảnh,
        // client luôn nhận string để fallbackImage.ts xử lý tiếp.
        const articles: Article[] = (data.articles ?? []).map((a: Article) => ({
          ...a,
          imageUrl: a.imageUrl ?? "",
        }));

        // updatedAt là Firestore Timestamp, cần gọi .toDate() trước .toISOString().
        // Fallback về "bây giờ" nếu field không tồn tại.
        const cachedAt: string =
          data.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString();

        const responseData: StockApiResponse["data"] = {
          ticker: data.ticker ?? ticker,
          articles,
          cachedAt,
        };

        setState({ status: "success", data: responseData });
      },
      (error) => {
        // Lỗi Firestore (mất kết nối, permission...) → chuyển sang trạng thái error
        setState({ status: "error", message: error.message });
      }
    );

    unsubRef.current = unsub;
  }, []);


  // Cleanup khi component unmount: hủy listener để tránh memory leak
  // và tránh setState trên component đã unmount.
  useEffect(() => {
    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, []);


  // fetchStock: điểm vào duy nhất được gọi từ UI khi user tìm kiếm mã.
  //
  // Luồng:
  //   1. Set state → "loading", reset listeningTicker để force re-subscribe.
  //   2. Subscribe onSnapshot trước khi gọi HTTP — đảm bảo không bỏ sót
  //      trường hợp server ghi Firestore nhanh hơn fetch response về.
  //   3. Gọi HTTP GET /api/stock/:ticker để trigger pipeline trên server.
  //      Response HTTP chỉ dùng để bắt lỗi (4xx/5xx) — data thật đến qua onSnapshot.
  //   4. Nếu server trả lỗi (VD: mã không hợp lệ, không tìm thấy tin) →
  //      đọc JSON body để lấy message cụ thể, set state → "error".
  //   5. Chỉ set error nếu state vẫn là "loading" — tránh ghi đè lên
  //      "success" nếu onSnapshot đã đến trước khi fetch reject.
  const fetchStock = useCallback(async (ticker: string) => {
    const normalized = ticker.trim().toUpperCase();
    if (!normalized) return;

    setState({ status: "loading" });
    listeningTickerRef.current = null; // Reset để subscribeToTicker không bị idempotent guard chặn

    subscribeToTicker(normalized); // Subscribe trước, fetch sau

    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";
      const res = await fetch(`${apiBase}/api/stock/${normalized}`);
      if (!res.ok) {
        // Đọc JSON body để lấy message lỗi cụ thể từ server (VD: mã không hợp lệ)
        let message = `Server trả lỗi ${res.status}: ${res.statusText}`;
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch { /* body không phải JSON — giữ message mặc định */ }
        throw new Error(message);
      }
      // res.ok: không cần đọc body — data đến qua onSnapshot
    } catch (err) {
      // Chỉ set error nếu vẫn đang loading — tránh đè lên success từ onSnapshot
      setState(prev =>
        prev.status === "loading"
          ? { status: "error", message: err instanceof Error ? err.message : "Lỗi không xác định" }
          : prev
      );
    }
  }, [subscribeToTicker]);


  // reset: đưa hook về trạng thái ban đầu (idle), dùng khi user xóa ticker
  // hoặc đóng panel. Hủy listener Firestore trước khi reset.
  const reset = useCallback(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    listeningTickerRef.current = null;
    setState({ status: "idle" });
  }, []);


  return { state, fetchStock, reset };
}
