// ============================================================
// components/popups/SearchPopup.tsx
// Popup modal tìm kiếm mã cổ phiếu.
//
// Luồng hoạt động:
//   1. SearchBar click → isSearchOpen = true → popup hiện ra
//   2. User gõ mã (VD: "vic") → tự động uppercase → "VIC"
//   3. User nhấn Enter / nút Send → handleSubmit()
//   4. handleSubmit() gọi onSubmit(ticker) → bubble lên SearchBar → App → useStockNews
//   5. Popup tự đóng, input reset về rỗng
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { BiX, BiSend } from 'react-icons/bi';
import logo from '../../assets/logo.png';


// ── Props ──────────────────────────────────────────────────
interface SearchPopupProps {
  isOpen: boolean;                 // Controlled từ SearchBar (useState)
  onClose: () => void;             // Đóng popup — gọi khi click backdrop hoặc nút X
  onSubmit: (ticker: string) => void; // Callback khi user xác nhận mã — nhận ticker đã uppercase
}


const SearchPopup: React.FC<SearchPopupProps> = ({ isOpen, onClose, onSubmit }) => {

  // ── State nội bộ ────────────────────────────────────────
  // Chỉ quản lý giá trị input — logic fetch hoàn toàn do parent xử lý.
  const [searchValue, setSearchValue] = useState<string>('');

  // Ref để focus vào input ngay khi popup mở — UX không cần click thêm.
  const inputRef = useRef<HTMLInputElement>(null);


  // ── BƯỚC 1: Side effects khi popup mở/đóng ──────────────
  useEffect(() => {
    if (isOpen) {
      // Delay 100ms để animation popup kịp chạy xong trước khi focus.
      setTimeout(() => inputRef.current?.focus(), 100);

      // Khoá scroll trang nền khi modal đang mở.
      // Tránh user scroll trang trong khi popup đang hiện.
      document.body.style.overflow = 'hidden';
    } else {
      // Mở lại scroll khi popup đóng.
      document.body.style.overflow = 'unset';
    }

    // Cleanup: đảm bảo scroll luôn được restore nếu component unmount đột ngột.
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);


  // ── BƯỚC 2: Xử lý submit ────────────────────────────────
  const handleSubmit = () => {
    // Trim lại một lần nữa phòng trường hợp user gõ khoảng trắng.
    const ticker = searchValue.trim().toUpperCase();

    // Không làm gì nếu rỗng (nút Send đã disabled nhưng phòng thủ thêm).
    if (!ticker) return;

    // Bubble event lên parent: SearchBar → onSearch (App) → fetchStock (hook).
    onSubmit(ticker);

    // Reset input và đóng popup ngay sau khi submit.
    setSearchValue('');
    onClose();
  };


  // ── BƯỚC 3: Phím tắt ────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit();  // Enter → submit
    if (e.key === 'Escape') onClose();      // Esc → đóng không submit
  };


  // ── BƯỚC 4: Ẩn hoàn toàn nếu chưa mở ────────────────────
  // Trả về null thay vì dùng CSS display:none để không render DOM thừa.
  if (!isOpen) return null;


  // ── BƯỚC 5: Render ──────────────────────────────────────
  return (
    <>
      {/* Lớp backdrop phủ nền: click vào đây để đóng popup */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Container popup: z-50 để nằm trên backdrop z-40 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg bg-white shadow-2xl rounded-sm overflow-hidden animate-in fade-in zoom-in duration-200">

          {/* Nút đóng góc trên phải */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <BiX size={30} className="text-gray-600" />
          </button>

          <div className="p-8 pt-12 flex flex-col items-center">

            {/* Logo thương hiệu */}
            <div className="mb-8">
              <div className='h-full flex items-center justify-center'>
                <img className='w-[35px] h-[50px]' src={logo} alt="logo" />
              </div>
            </div>

            <h2 className="text-xl font-bold mb-8 uppercase tracking-wider text-gray-800">
              Tìm một mã cổ phiếu
            </h2>

            {/* Khung input */}
            <div className="w-full border border-gray-300 rounded-md px-6 py-4 bg-white">
              <label className="bg-white text-xs text-gray-500 font-medium">
                Nhập dữ liệu tại đây
              </label>

              <div className="flex items-center gap-2 pb-8">
                <input
                  ref={inputRef}
                  type="text"
                  value={searchValue}
                  // Tự động chuyển sang chữ hoa ngay khi gõ — không cần nhớ caps lock
                  onChange={(e) => setSearchValue(e.target.value.toUpperCase())}
                  onKeyDown={handleKeyDown}
                  placeholder="Ví dụ: VIC, HPG, MBB..."
                  className="w-full outline-none text-sm text-gray-700 uppercase"
                  maxLength={10} // Mã cổ phiếu VN tối đa 3-4 ký tự, 10 là giới hạn an toàn
                />
              </div>

              {/* Footer: hint text + nút Send */}
              <div className="mt-4 flex justify-between items-center text-[11px]">
                <span>Nhập mã cổ phiếu tối đa <strong>10</strong> ký tự.</span>
                <button
                  onClick={handleSubmit}
                  // Disabled khi input rỗng — tránh gửi request vô nghĩa lên server
                  disabled={!searchValue.trim()}
                  className="bg-black p-2 px-4 rounded hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <BiSend size={16} className="text-white transform -rotate-45" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SearchPopup;
