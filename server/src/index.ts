// ============================================================
// index.ts — Entry point của server
// Tạo HTTP server thuần (không dùng Express) lắng nghe request
// từ client và điều phối tới đúng controller.
//
// Các route hiện có:
//   GET  /api/stock/:ticker  → phân tích cổ phiếu
//   GET  /health             → kiểm tra server còn sống không
//   *    /*                  → 404
// ============================================================

import "dotenv/config"; // Load biến môi trường từ file .env vào process.env
import http from "http";
import { StockController } from "./controllers/stock.controller.js";

// Đọc PORT từ .env; nếu không có thì mặc định 3000
const PORT = process.env.PORT ?? "3000";

// Khởi tạo controller một lần duy nhất (singleton pattern đơn giản)
// Cache và service sống suốt vòng đời server
const stockController = new StockController();

// Tạo HTTP server — mỗi request đến sẽ chạy async callback bên dưới
const server = http.createServer(async (req, res) => {

  // Bước 1: Parse URL để lấy pathname và query string
  // Phải truyền base URL vì req.url chỉ là path tương đối (VD: "/api/stock/AAPL")
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  // Bước 2: Set CORS headers — cho phép mọi origin gọi API
  // (Frontend dev server thường chạy ở cổng khác nên cần điều này)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json"); // Mặc định response là JSON

  // Bước 3: Xử lý CORS preflight request (browser tự gửi OPTIONS trước khi gửi GET)
  // Server chỉ cần trả 204 No Content để browser biết CORS được chấp nhận
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── Route: GET /api/stock/:ticker ──────────────────────────────────────────
  // Dùng regex để bắt ticker từ URL path.
  // Pattern: chỉ chấp nhận chữ cái và dấu chấm (VD: BRK.B)
  const match = url.pathname.match(/^\/api\/stock\/([A-Za-z.]+)$/);
  if (req.method === "GET" && match) {
    const ticker = match[1] ?? ""; // match[1] là capture group — phần ticker

    // Gọi controller để phân tích (có cache, gọi Groq, gọi HuggingFace)
    const result = await stockController.analyze(ticker);

    // Nếu thành công → 200 OK; nếu lỗi → 500 Internal Server Error
    res.writeHead(result.success ? 200 : 500);
    res.end(JSON.stringify(result));
    return;
  }

  // ── Route: GET /health ─────────────────────────────────────────────────────
  // Dùng để monitoring / load balancer ping kiểm tra server còn sống không
  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // ── Fallthrough: 404 Not Found ─────────────────────────────────────────────
  // Mọi path không khớp với route nào ở trên đều trả 404
  res.writeHead(404);
  res.end(JSON.stringify({ error: "Route not found" }));
});

// Bắt đầu lắng nghe kết nối, in URL ra console để tiện dùng thủ công
server.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
  console.log(`Thử: http://localhost:${PORT}/api/stock/AAPL`);
});
