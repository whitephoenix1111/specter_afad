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

type Unsubscribe = () => void;

export function useStockNews() {

  const [state, setState] = useState<FetchState>({ status: "idle" });

  const unsubRef = useRef<Unsubscribe | null>(null);
  const listeningTickerRef = useRef<string | null>(null);


  const subscribeToTicker = useCallback((ticker: string) => {
    if (listeningTickerRef.current === ticker) return;

    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    listeningTickerRef.current = ticker;

    const docRef = doc(db, "stocks", ticker);

    const unsub = onSnapshot(
      docRef,
      (snapshot) => {
        if (!snapshot.exists()) return;

        const data = snapshot.data();
        const articles: Article[] = (data.articles ?? []).map((a: Article) => ({
          ...a,
          imageUrl: a.imageUrl ?? "",
        }));

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
        setState({ status: "error", message: error.message });
      }
    );

    unsubRef.current = unsub;
  }, []);


  useEffect(() => {
    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, []);


  const fetchStock = useCallback(async (ticker: string) => {
    const normalized = ticker.trim().toUpperCase();
    if (!normalized) return;

    setState({ status: "loading" });
    listeningTickerRef.current = null;

    subscribeToTicker(normalized);

    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";
      const res = await fetch(`${apiBase}/api/stock/${normalized}`);
      if (!res.ok) {
        throw new Error(`Server trả lỗi ${res.status}: ${res.statusText}`);
      }
    } catch (err) {
      setState(prev =>
        prev.status === "loading"
          ? { status: "error", message: err instanceof Error ? err.message : "Lỗi không xác định" }
          : prev
      );
    }
  }, [subscribeToTicker]);


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
