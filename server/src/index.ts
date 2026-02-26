// ============================================================
// index.ts — HTTP server entry point. Không dùng Express —
//            tất cả routing là if/else thủ công.
//
// Routes:
//   GET  /api/stock/:ticker  → StockController.analyze()
//   GET  /images/:filename   → serve file .jpg từ public/images/
//   GET  /health             → { status: "ok" }
//   *    /*                  → 404
// ============================================================

import "dotenv/config";       // Load .env trước khi dùng process.env bất kỳ đâu
import http from "http";
import fs from "fs";
import path from "path";
import { StockController } from "./controllers/stock.controller.js";

const PORT = process.env.PORT ?? "3000";
const IMAGES_DIR = path.resolve("public/images"); // Thư mục chứa ảnh AI đã sinh

const stockController = new StockController(); // Khởi tạo 1 lần, dùng lại cho mọi request

const server = http.createServer(async (req, res) => {
  // Parse URL để lấy pathname và query string sạch
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  // CORS — cho phép mọi origin (chỉ phù hợp dev, production nên lock lại)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight request từ browser — trả 204 ngay, không cần xử lý tiếp
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── Route: GET /api/stock/:ticker ────────────────────────────────────────
  // Regex chỉ cho phép chữ cái và dấu chấm (VD: "VIC", "VN30F1M")
  const stockMatch = url.pathname.match(/^\/api\/stock\/([A-Za-z.]+)$/);
  if (req.method === "GET" && stockMatch) {
    const ticker = stockMatch[1] ?? ""; // stockMatch[1] là captured group của ticker

    // analyze() xử lý toàn bộ pipeline: RSS → classify → featured → image
    const result = await stockController.analyze(ticker);

    res.setHeader("Content-Type", "application/json");
    res.writeHead(result.success ? 200 : 500);
    res.end(JSON.stringify(result));
    return;
  }

  // ── Route: GET /images/:filename — Serve ảnh AI đã lưu trên disk ─────────
  // Regex chỉ cho phép ký tự an toàn, phải kết thúc .jpg — tránh path traversal
  const imageMatch = url.pathname.match(/^\/images\/([A-Za-z0-9_.-]+\.jpg)$/);
  if (req.method === "GET" && imageMatch) {
    const filename = imageMatch[1] ?? "";
    const filePath = path.join(IMAGES_DIR, filename);

    if (fs.existsSync(filePath)) {
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400"); // Browser cache 24h — khớp với TTL server cache
      res.writeHead(200);
      fs.createReadStream(filePath).pipe(res); // Stream file thay vì đọc vào RAM
    } else {
      res.setHeader("Content-Type", "application/json");
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Image not found" }));
    }
    return;
  }

  // ── Route: GET /health — Dùng để check server còn sống không ────────────
  if (req.method === "GET" && url.pathname === "/health") {
    res.setHeader("Content-Type", "application/json");
    res.writeHead(200);
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // ── 404 — Mọi route không khớp ────────────────────────────────────────────
  res.setHeader("Content-Type", "application/json");
  res.writeHead(404);
  res.end(JSON.stringify({ error: "Route not found" }));
});

server.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
  console.log(`Thử: http://localhost:${PORT}/api/stock/VIC`);
});
