// ============================================================
// components/popups/SearchPopup.tsx
// Popup modal tìm kiếm mã cổ phiếu.
//
// Luồng hoạt động:
//   1. SearchBar click → isSearchOpen = true → popup hiện ra
//   2. User gõ mã (VD: "vic") → tự động uppercase → "VIC"
//   3. User nhấn Enter / nút Send → handleSubmit()
//   4. handleSubmit() validate → gọi onSubmit(ticker) → bubble lên SearchBar → App → useStockNews
//   5. Popup tự đóng, input reset về rỗng
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { BiX, BiSend } from 'react-icons/bi';
import logo from '../../assets/logo.png';


// ── Props ──────────────────────────────────────────────────
interface SearchPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (ticker: string) => void;
}


const SearchPopup: React.FC<SearchPopupProps> = ({ isOpen, onClose, onSubmit }) => {

  const [searchValue, setSearchValue] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);


  // ── Side effects khi popup mở/đóng ──────────────────────
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);


  // ── Submit ───────────────────────────────────────────────
  const handleSubmit = () => {
    const ticker = searchValue.trim().toUpperCase();
    if (!ticker) return;

    // Chỉ cho phép A-Z và 0-9, không có ký tự đặc biệt, tối đa 3 ký tự
    if (!/^[A-Z0-9]{1,3}$/.test(ticker)) {
      setValidationError('Mã chỉ gồm chữ cái và số, tối đa 3 ký tự.');
      return;
    }

    setValidationError('');
    onSubmit(ticker);
    setSearchValue('');
    onClose();
  };


  // ── Phím tắt ─────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') onClose();
  };


  if (!isOpen) return null;


  // ── Render ───────────────────────────────────────────────
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg bg-white shadow-2xl rounded-sm overflow-hidden animate-in fade-in zoom-in duration-200">

          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <BiX size={30} className="text-gray-600" />
          </button>

          <div className="p-8 pt-12 flex flex-col items-center">

            <div className="mb-8">
              <div className='h-full flex items-center justify-center'>
                <img className='w-[35px] h-[50px]' src={logo} alt="logo" />
              </div>
            </div>

            <h2 className="text-xl font-bold mb-8 uppercase tracking-wider text-gray-800">
              Tìm một mã cổ phiếu
            </h2>

            <div className="w-full border border-gray-300 rounded-md px-6 py-4 bg-white">
              <label className="bg-white text-xs text-gray-500 font-medium">
                Nhập dữ liệu tại đây
              </label>

              <div className="flex items-center gap-2 pb-8">
                <input
                  ref={inputRef}
                  type="text"
                  value={searchValue}
                  onChange={(e) => {
                    setSearchValue(e.target.value.toUpperCase());
                    setValidationError(''); // xóa lỗi khi user bắt đầu gõ lại
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Ví dụ: VIC, HPG, MBB..."
                  className="w-full outline-none text-sm text-gray-700 uppercase"
                  maxLength={3}
                />
              </div>

              {/* Thông báo lỗi validate */}
              {validationError && (
                <p className="text-red-500 text-[10px] font-semibold mb-2">{validationError}</p>
              )}

              <div className="mt-4 flex justify-between items-center text-[11px]">
                <span>Nhập mã cổ phiếu tối đa <strong>3</strong> ký tự.</span>
                <button
                  onClick={handleSubmit}
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
