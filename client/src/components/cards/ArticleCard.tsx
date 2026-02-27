// ============================================================
// components/cards/ArticleCard.tsx
// Card hiển thị một bài báo thông thường (không phải bài nổi bật).
//
// Dùng cho 4 cột: CÂN ĐỐI, TĂNG TRƯỞNG, DIỄN BIẾN GIÁ, RỦI RO (trừ bài isFeatured).
// Layout dọc: Header (ngày + source) → Tiêu đề → Ảnh + nút "Đọc ngay".
//
// Mọi prop đều optional và có giá trị default — card không bao giờ crash
// dù server thiếu field nào đó.
// ============================================================

import React from 'react';


// ── Props ──────────────────────────────────────────────────
interface ArticleCardProps {
  date?: string;        // Ngày đăng, dạng "19" (chỉ số ngày, đã format bởi BentoGrid)
  month?: string;       // Tháng đăng, dạng "Tháng 9"
  source?: string;      // Tên báo nguồn (VD: "VnExpress", "CafeF") — hiển thị màu cam
  subCategory?: string; // Nhóm con — là NewsCategory: "CÂN ĐỐI", "RỦI RO", v.v.
  title?: string;       // Tiêu đề bài báo
  imageUrl?: string;    // URL ảnh (Cloudinary CDN hoặc ảnh RSS gốc)
  url?: string;         // URL bài gốc — dùng cho thẻ <a> "Đọc ngay"
}


const ArticleCard: React.FC<ArticleCardProps> = ({
  date        = "--",
  month       = "---",
  source      = "",
  subCategory = "---",
  title       = "Tiêu đề bài viết",
  imageUrl    = "https://picsum.photos/400/300",
  url         = "#",
}) => {
  return (
    // group: cho phép Tailwind dùng group-hover để đổi grayscale ảnh khi hover toàn card
    <article className="group flex flex-col w-full bg-white pr-[30px] pl-[60px] py-[40px] border-b">

      {/* ── HEADER: Ngày đăng + tên báo ── */}
      <div className="flex items-center gap-3 mb-2">
        {/* Hình vuông cam hiển thị ngày — nhận diện thị giác nhanh */}
        <div className="bg-[#E67E22] text-white w-10 h-10 flex items-center justify-center font-bold rounded shadow-sm shrink-0">
          {date}
        </div>
        <div className="text-black font-bold text-[16px] leading-tight">{month}</div>
      </div>

      {/* Tag nhóm: source màu cam / subCategory màu đen */}
      <div className="flex flex-col uppercase tracking-wider mb-4">
        <div className="text-[10px] mt-1 font-bold">
          <span className="text-[#E67E22]">{source || "---"}</span>
          <span className="text-gray-400 mx-1">/</span>
          <span className="text-black">{subCategory}</span>
        </div>
      </div>

      {/* ── TIÊU ĐỀ ── */}
      {/* min-h đảm bảo card không co lại khi tiêu đề ngắn — giữ chiều cao đều nhau */}
      {/* line-clamp-2 cắt tiêu đề dài quá 2 dòng, tránh card bị lệch layout */}
      <h3 className="text-xl font-extrabold leading-tight mb-2 text-black line-clamp-2 overflow-hidden">
        {title}
      </h3>

      {/* ── ẢNH + NÚT ĐỌC NGAY ── */}
      {/* relative để nút "Đọc ngay" absolute nằm đè lên góc phải dưới ảnh */}
      <div className="relative w-full">

        {/* Khung ảnh: w-[95%] để lộ một khoảng nhỏ bên phải cho nút absolute */}
        <div className="overflow-hidden bg-gray-100 w-[95%]">
          <img
            src={imageUrl || "https://picsum.photos/400/300"}
            alt={title}
            // Mặc định ảnh hiển thị grayscale, hover toàn card → ảnh chuyển màu (group-hover)
            className="w-full grayscale group-hover:grayscale-0 transition-all duration-500 object-cover aspect-[4/3]"
            // Fallback nếu URL ảnh hỏng (Cloudinary down, link RSS 404)
            onError={(e) => { (e.target as HTMLImageElement).src = "https://picsum.photos/400/300"; }}
          />
        </div>

        {/* Nút "Đọc ngay": absolute đè góc dưới phải, mở bài gốc trong tab mới */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer" // Bảo mật: không cho trang đích truy cập window.opener
          className="absolute bottom-[-12px] right-0 bg-black text-white text-[10px] uppercase font-bold px-8 py-3 shadow-md active:scale-95 transition-all hover:bg-zinc-700"
        >
          Đọc ngay
        </a>
      </div>

    </article>
  );
};

export default ArticleCard;
