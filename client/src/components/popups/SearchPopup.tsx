import React, { useState, useEffect, useRef } from 'react';
import { BiX, BiSend } from 'react-icons/bi';
import logo from '../../assets/logo.png'

interface SearchPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const SearchPopup: React.FC<SearchPopupProps> = ({ isOpen, onClose }) => {
  const [searchValue, setSearchValue] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus vào input khi mở popup
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      // Chặn scroll body khi popup mở
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop: Phủ nền đen mờ toàn bộ phía sau */}
      <div 
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose} 
      />

      {/* Popup Content */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg bg-white shadow-2xl rounded-sm overflow-hidden animate-in fade-in zoom-in duration-200">
          
          {/* Nút Close */}
          <button 
            onClick={onClose}
            className="absolute right-4 top-4 p-1 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <BiX size={30} className="text-gray-600" />
          </button>

          <div className="p-8 pt-12 flex flex-col items-center">
            {/* Logo placeholder (Biểu tượng chữ S cách điệu) */}
            <div className="mb-8">
                <div className='h-full flex items-center justify-center'>
                    <img className='w-[35px] h-[50px]' src={logo} alt="logo" />
                </div>
            </div>

            <h2 className="text-xl font-bold mb-8 uppercase tracking-wider text-gray-800">
              Tìm một mã cổ phiếu
            </h2>

            {/* Input Container */}
            <div className="w-full border border-gray-300 rounded-md px-6 py-4 bg-white">
              <label className="bg-white text-xs text-gray-500 font-medium">
                Nhập dữ liệu tại đây
              </label>
              
              <div className="flex items-center gap-2 pb-8">
                <input
                  ref={inputRef}
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Nhập mã cổ phiếu hoặc tên doanh nghiệp..."
                  className="w-full outline-none text-sm text-gray-700"
                  maxLength={500}
                />
              </div>

              <div className="mt-4 flex justify-between items-center text-[11px]">
                <span>Vui lòng không nhập quá <strong>500</strong> ký tự.</span>
                <button className="bg-black p-2 px-4 rounded hover:bg-gray-800 transition-colors cursor-pointer">
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