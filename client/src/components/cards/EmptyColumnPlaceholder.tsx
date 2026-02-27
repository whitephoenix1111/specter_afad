// ============================================================
// components/cards/EmptyColumnPlaceholder.tsx
// Placeholder khi một cột không có tin tức.
//
// Logic ưu tiên:
//   1. Có bài cũ (oldArticle) → "card ngủ": opacity mờ, border dashed, ảnh grayscale.
//      Hover: opacity tăng, ảnh về màu thật, nút đen — transition 700ms ("thức dậy nhẹ")
//   2. Không có gì → quote editorial tĩnh, rotate theo ngày (seed = dayOfYear)
// ============================================================

import React from 'react';
import type { NewsCategory, Article } from '../../types/article';
import { resolveImageUrl, makeOnError } from '../../utils/fallbackImage';

const QUOTES: Record<NewsCategory, string[]> = {
  "CÂN ĐỐI": [
    "Không có tin cân đối hôm nay — thị trường đang trong giai đoạn quan sát.",
    "Sự im lặng của thông tin đôi khi chính là tín hiệu.",
    "Dữ liệu nền tảng chưa có cập nhật mới cho mã này.",
    "Thị trường cần thời gian để tiêu hóa thông tin trước đó.",
    "Chưa có sự kiện nền tảng đáng chú ý trong phiên hôm nay.",
  ],
  "TĂNG TRƯỞNG": [
    "Bull markets are born on pessimism. — John Templeton",
    "Chưa có tín hiệu tăng trưởng mới được ghi nhận hôm nay.",
    "In the short run, the market is a voting machine. — Benjamin Graham",
    "Tăng trưởng thực sự thường đến trong lặng lẽ, không có tiêu đề lớn.",
    "The stock market is a device for transferring money from the impatient to the patient. — Buffett",
  ],
  "RỦI RO": [
    "Risk comes from not knowing what you're doing. — Warren Buffett",
    "Chưa có cảnh báo rủi ro nào được ghi nhận — thị trường đang ổn định.",
    "Không có tin rủi ro hôm nay có thể là dấu hiệu tích cực.",
    "The biggest risk is not taking any risk. — Mark Zuckerberg",
    "Calm markets often precede significant moves — stay alert.",
  ],
  "DIỄN BIẾN GIÁ": [
    "Price is what you pay. Value is what you get. — Warren Buffett",
    "Chưa có diễn biến giá đáng chú ý được ghi nhận hôm nay.",
    "Markets are constantly in a state of uncertainty and flux.",
    "Không có biến động giá bất thường trong phiên giao dịch gần nhất.",
    "The trend is your friend — until it ends.",
  ],
};

function getDailyQuote(category: NewsCategory): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  const pool = QUOTES[category];
  return pool[dayOfYear % pool.length];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Hôm nay";
  if (days === 1) return "Hôm qua";
  if (days < 30) return `${days} ngày trước`;
  const months = Math.floor(days / 30);
  return `${months} tháng trước`;
}

interface EmptyColumnPlaceholderProps {
  category: NewsCategory;
  oldArticle?: Article;
}

const EmptyColumnPlaceholder: React.FC<EmptyColumnPlaceholderProps> = ({
  category,
  oldArticle,
}) => {

  // ── TRẠNG THÁI B: Có bài cũ → "card ngủ" ────────────────
  // group đặt ở <article> để group-hover hoạt động cho toàn bộ con bên trong
  if (oldArticle) {
    return (
      <article className="group flex flex-col w-full bg-white pr-[30px] pl-[30px] py-[40px] border-b border-dashed opacity-45 hover:opacity-70 transition-opacity duration-700 cursor-pointer">

        <div className="flex items-center gap-3 mb-2">
          <div className="bg-gray-300 text-gray-500 w-10 h-10 flex items-center justify-center font-bold rounded shrink-0 text-sm">
            {new Date(oldArticle.publishedAt).getDate()}
          </div>
          <div className="text-gray-400 font-bold text-[14px] leading-tight">
            Tháng {new Date(oldArticle.publishedAt).getMonth() + 1}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 border border-gray-300 px-1.5 py-0.5">
            TIN CŨ NHẤT
          </span>
          <span className="text-[9px] text-gray-400 uppercase tracking-wider">
            {timeAgo(oldArticle.publishedAt)}
          </span>
        </div>

        <div className="text-[10px] font-bold uppercase tracking-wider mb-3 text-gray-400">
          <span>{oldArticle.source || "---"}</span>
          <span className="mx-1 text-gray-300">/</span>
          <span>{category}</span>
        </div>

        <h3 className="text-xl font-extrabold leading-tight mb-3 text-gray-400 line-clamp-2 overflow-hidden">
          {oldArticle.title}
        </h3>

        <div className="relative w-full">
          <div className="overflow-hidden bg-gray-100 w-[95%]">
            <img
              src={resolveImageUrl(oldArticle.imageUrl, category)}
              alt={oldArticle.title}
              className="w-full grayscale group-hover:grayscale-0 transition-all duration-700 object-cover aspect-[4/3]"
              onError={makeOnError(category)}
            />
          </div>
          <a
            href={oldArticle.url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-[-12px] right-0 bg-gray-300 group-hover:bg-black text-gray-500 group-hover:text-white text-[10px] uppercase font-bold px-8 py-3 transition-colors duration-700"
          >
            Đọc ngay
          </a>
        </div>

      </article>
    );
  }

  // ── TRẠNG THÁI A: Không có gì → quote editorial ──────────
  const quote = getDailyQuote(category);

  const accentColor: Record<NewsCategory, string> = {
    "CÂN ĐỐI":       "#6B7280",
    "TĂNG TRƯỞNG":   "#16A34A",
    "RỦI RO":        "#DC2626",
    "DIỄN BIẾN GIÁ": "#2563EB",
  };

  return (
    <div className="flex flex-col w-full px-[30px] py-[60px] border-b border-dashed select-none min-h-[200px] justify-center">
      <div
        className="w-8 h-[3px] mb-6"
        style={{ backgroundColor: accentColor[category] }}
      />
      <p className="text-[16px] italic text-gray-400 leading-relaxed font-medium">
        "{quote}"
      </p>
      <div className="mt-6 text-[12px] font-black uppercase tracking-widest">
        {category} · Chưa có tin mới
      </div>
    </div>
  );
};

export default EmptyColumnPlaceholder;
