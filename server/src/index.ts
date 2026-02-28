// ============================================================
// index.ts — HTTP server entry point. Không dùng Express —
//            tất cả routing là if/else thủ công.
//
// Routes:
//   GET  /api/stock/:ticker  → StockController.analyze()
//   GET  /health             → { status: "ok" }
//   *    /*                  → 404
//
// Lưu ý: Route /images/:filename đã bỏ — ảnh AI giờ lưu trên
//         Cloudinary, client dùng URL trực tiếp từ Cloudinary CDN.
// ============================================================

import "dotenv/config";
import http from "http";
import { StockController } from "./controllers/stock.controller.js";

const PORT = process.env.PORT ?? "3000";
const stockController = new StockController();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── Route: GET /api/stock/:ticker ────────────────────────────────────────
  const stockMatch = url.pathname.match(/^\/api\/stock\/([A-Za-z.]+)$/);
  if (req.method === "GET" && stockMatch) {
    const ticker = stockMatch[1] ?? "";
    const result = await stockController.analyze(ticker);

    res.setHeader("Content-Type", "application/json");
    res.writeHead(result.success ? 200 : 500);
    res.end(JSON.stringify(result));
    return;
  }

  // ── Route: GET /health ───────────────────────────────────────────────────
  if (req.method === "GET" && url.pathname === "/health") {
    res.setHeader("Content-Type", "application/json");
    res.writeHead(200);
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // ── 404 ──────────────────────────────────────────────────────────────────
  res.setHeader("Content-Type", "application/json");
  res.writeHead(404);
  res.end(JSON.stringify({ error: "Route not found" }));
});

server.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
  console.log(`Thử: http://localhost:${PORT}/api/stock/VIC`);

});
