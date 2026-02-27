// ============================================================
// components/widgets/SearchBar.tsx
// Widget thanh tìm kiếm nằm trong sidebar — hiển thị ngày hôm nay
// và là trigger mở SearchPopup.
//
// SearchBar KHÔNG tự fetch — chỉ nhận prop onSearch từ BentoGrid
// rồi truyền tiếp vào SearchPopup dưới dạng onSubmit.
//
// Luồng sự kiện:
//   User click thanh search
//     → isSearchOpen = true → SearchPopup hiện
//       → User nhập "VIC" + Enter
//         → onSubmit("VIC") → onSearch("VIC") [prop từ BentoGrid]
//           → fetchStock("VIC") [trong useStockNews hook ở App.tsx]
//           → Nếu thành công + có bài → App.tsx tự lưu vào portfolio qua useEffect
// ============================================================

import React, { useState } from 'react';
import { BiSun, BiSearch } from "react-icons/bi";
import SearchPopup from '../popups/SearchPopup';


// ── Props ──────────────────────────────────────────────────
interface SearchBarProps {
  // Callback nhận ticker đã uppercase, bubble lên đến useStockNews.fetchStock()
  onSearch: (ticker: string) => void;
}


const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {

  // ── State nội bộ: chỉ kiểm soát popup mở/đóng ────────────
  const [isSearchOpen, setIsSearchOpen] = useState(false);


  // ── Tính toán ngày hiện tại ──────────────────────────────
  // Tính tại thời điểm component render — không cần useEffect hay state
  // vì ngày không thay đổi trong suốt session của user.
  const now = new Date();
  const dayNames = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
  const today = {
    dayOfWeek: dayNames[now.getDay()],                       // VD: "Thứ năm"
    date: `${now.getDate()} THÁNG ${now.getMonth() + 1}`,   // VD: "19 THÁNG 9"
    label: "HÔM NAY",
  };


  return (
    <div className="flex flex-col w-full max-w-md px-[20px] py-[40px] bg-white font-sans border-b">

      {/* Khối hiển thị ngày */}
      <div className="flex flex-col mb-12">
        <div className="flex items-center gap-2 text-orange-500 font-bold text-[18px] ml-auto">
          <BiSun size={24} />
          <span>{today.label}</span>
        </div>
        <div className="text-[18px] font-black mt-1 ml-auto">
          {today.date}
        </div>
        <div className="text-gray-600 text-[14px] ml-auto">
          {today.dayOfWeek}
        </div>
      </div>

      {/* Thanh search giả — toàn bộ vùng này là nút bấm để mở popup.
          Input là readOnly vì việc nhập thật xảy ra bên trong SearchPopup. */}
      <div className="relative group" onClick={() => setIsSearchOpen(true)}>
        <div className="flex items-center border-b border-gray-800 pb-4 cursor-pointer">
          <input
            type="text"
            placeholder="Tìm cổ phiếu"
            readOnly // Chỉ để trưng bày — click sẽ mở SearchPopup
            className="w-full text-[14px] outline-none placeholder-gray-400 bg-transparent cursor-pointer"
          />
          <button aria-label="Search" className="ml-2 hover:scale-110 transition-transform">
            <BiSearch size={24} className="text-black" />
          </button>
        </div>
      </div>

      {/* SearchPopup: controlled hoàn toàn bởi isSearchOpen */}
      <SearchPopup
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSubmit={(ticker) => {
          onSearch(ticker);
          setIsSearchOpen(false);
        }}
      />
    </div>
  );
};

export default SearchBar;
