// ============================================================
// components/cards/HeroCard.tsx
// Card bài báo nổi bật — chiếm toàn bộ 2 cột giữa (548px).
//
// Chỉ render đúng 1 lần duy nhất trong BentoGrid, cho bài có isFeatured = true
// (bài RỦI RO nghiêm trọng nhất do AI chọn). Nếu không có bài nào isFeatured,
// BentoGrid fallback sang bài RỦI RO đầu tiên hoặc bài đầu tiên trong mảng.
//
// Khác với ArticleCard ở chỗ:
//   - Ảnh to hơn (370×208px cố định thay vì aspect-ratio tự co)
//   - Có thêm phần description (tóm tắt ~50 từ từ AI summary)
//   - Layout ngang: ảnh chiếm 10/12 cột, tiêu đề chiếm 2/12 cột
// ============================================================

import React from 'react';


// ── Props ──────────────────────────────────────────────────
// Tất cả đều required (không optional) vì BentoGrid luôn truyền đủ trước khi render.
interface HeroCardProps {
  date: string;         // Ngày đăng — đã format ("19")
  month: string;        // Tháng đăng — đã format ("Tháng 9")
  source: string;       // Tên báo nguồn (VD: "VnExpress", "CafeF") — hiển thị màu cam
  subCategory: string;  // Nhóm con — thường là "RỦI RO"
  title: string;        // Tiêu đề bài báo
  imageUrl: string;     // URL ảnh Cloudinary hoặc RSS
  description: string;  // Tóm tắt do AI sinh ra (article.summary), có thể rỗng ""
  url: string;          // URL bài gốc
}


const HeroCard: React.FC<HeroCardProps> = ({
  date,
  month,
  source,
  subCategory,
  title,
  imageUrl,
  description,
  url,
}) => {
  return (
    // group: kích hoạt group-hover để ảnh chuyển từ grayscale sang màu khi hover toàn card
    <article className="group flex flex-col w-full bg-white pr-[30px] pl-[60px] py-[40px]">

      {/* ── HEADER: Ngày + tên báo ── */}
      <div className="flex items-center gap-3 mb-2">
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

      {/* ── BODY: Grid 12 cột — ảnh trái (10 cột), tiêu đề phải (2 cột) ── */}
      {/* Thiết kế bất đối xứng này tạo điểm nhấn thị giác: ảnh lớn, chữ nổi bật */}
      <div className="grid grid-cols-12 gap-4 items-center">

        {/* Ảnh hero — kích thước cố định 370×208px */}
        <div className="col-span-10 overflow-hidden relative">
          <img
            src={imageUrl || "https://picsum.photos/800/600?random=hero"}
            alt={title}
            // Hiệu ứng: grayscale mặc định → full color khi hover, chuyển mượt 700ms
            className="w-[370px] h-[208px] grayscale group-hover:grayscale-0 transition-all duration-700 object-cover"
            // Fallback nếu URL ảnh không load được
            onError={(e) => { (e.target as HTMLImageElement).src = "https://picsum.photos/800/600?random=hero"; }}
          />
        </div>

        {/* Tiêu đề nằm dọc bên phải ảnh — font lớn, break-words tránh tràn */}
        <div className="col-span-2">
          <h2 className="text-[24px] font-extrabold leading-tight text-black break-keep hyphens-none line-clamp-7 overflow-hidden">
            {title}
          </h2>
        </div>
      </div>

      {/* ── FOOTER: Description (AI summary) + nút Đọc ngay ── */}
      {/* flex-row trên md: description trái, nút phải; flex-col trên mobile */}
      <div className="mt-6 flex flex-col md:flex-row justify-between items-end gap-4">

        {/* Đoạn tóm tắt ~50 từ do Groq sinh ra (article.summary).
            Nếu bài không có summary (fallback sang bài không phải isFeatured),
            hiển thị text mặc định thay vì để trống. */}
        <p className="text-gray-600 text-sm max-w-xl leading-relaxed mb-auto">
          {description || "Bài báo nổi bật về rủi ro đáng chú ý nhất."}
        </p>

        {/* Nút Đọc ngay — mở bài gốc trong tab mới */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-black text-white text-[11px] uppercase font-bold px-8 py-4 whitespace-nowrap hover:bg-zinc-800 transition-colors shadow-lg"
        >
          Đọc ngay
        </a>
      </div>

    </article>
  );
};

export default HeroCard;
