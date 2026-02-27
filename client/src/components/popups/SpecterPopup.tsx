import React, { useEffect, useCallback } from 'react';
import logo from '../../assets/logo.png'

// Định nghĩa kiểu dữ liệu cho Props
interface SpecterPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string; 
}

const SpecterPopup: React.FC<SpecterPopupProps> = ({ 
  isOpen, 
  onClose, 
  title = "SPECTER LÀ GÌ?" 
}) => {
  
  // Logic: Đóng popup khi nhấn phím ESC (Best practice cho UX)
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Ngăn scroll thanh cuộn phía sau khi popup đang mở
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    // Backdrop: Overlay đen mờ, z-index cao
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 transition-opacity duration-300"
      onClick={onClose} // Đóng khi click ra ngoài vùng trắng
    >
      
      {/* Modal Container: Ngăn nổi bọt click (stopPropagation) */}
      <div 
        className="relative w-full max-w-2xl bg-white shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] border border-gray-200 rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Nội dung chi tiết */}
        <div className="p-8 md:p-14 flex flex-col items-center text-center">
          
          {/* Logo S cách điệu */}
          <div className="mb-8">
            <div className='h-full flex items-center justify-center'>
                <img className='w-[35px] h-[50px]' src={logo} alt="logo" />
            </div>
          </div>

          {/* Heading */}
          <h2 className="text-2xl font-bold mb-6 text-black uppercase">
            {title}
          </h2>

          {/* Divider nhỏ */}
          <div className="w-16 h-[1.5px] bg-black mb-10"></div>

          {/* Body Content */}
          <article className="space-y-6 text-gray-800 leading-[1.8] text-justify md:text-center font-normal">
            <p className="text-[15px]">
              Thị trường không thiếu thông tin — nó đang thừa. Mỗi ngày hàng chục bài báo
              viết về cùng một mã cổ phiếu, từ góc độ khác nhau, với mức độ quan trọng khác nhau.
              <strong className="font-semibold"> SPECTER</strong> được xây dựng để giải quyết
              đúng vấn đề đó.
            </p>
            <p className="text-[15px]">
              Chỉ cần nhập mã, hệ thống lập tức quét toàn bộ báo chí tài chính Việt Nam
              và để AI sắp xếp mọi thứ vào đúng chỗ: tăng trưởng ra tăng trưởng,
              rủi ro ra rủi ro. Tín hiệu đáng lo nhất được đẩy lên đầu
              — để bạn không bỏ lỡ điều quan trọng nhất giữa muôn vàn tiếng ồn.
            </p>
          </article>

          {/* Divider mờ phía dưới */}
          <div className="w-12 h-[1px] bg-gray-200 mt-10 mb-10"></div>

          {/* Nút Action */}
          <button
            onClick={onClose}
            className="group relative px-16 py-4 border border-gray-400 overflow-hidden transition-all hover:border-black active:scale-95 cursor-pointer"
          >
            <span className="relative z-10 text-xs font-bold uppercase tracking-[0.3em] transition-colors group-hover:text-white">
              Tôi đã hiểu
            </span>
            {/* Hiệu ứng hover slide-up */}
            <div className="absolute inset-0 bg-black translate-y-full transition-transform duration-300 group-hover:translate-y-0"></div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpecterPopup;