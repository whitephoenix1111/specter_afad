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
              Đây là hệ thống phân tích dữ liệu thời gian thực được thiết kế để giải quyết vấn đề
              <strong className="font-semibold"> 'nhiều thông tin' (Information Overload)</strong> trong đầu tư. Thay vì để nhà đầu tư bơi trong
              biển tin tức hỗn loạn, chúng tôi loại bỏ 90% tạp âm của thị trường để mang đến cho
              bạn 10% giá trị cốt lõi.
            </p>
            <p className="text-[15px]">
              Chỉ cần nhập mã cổ phiếu, <span className="font-bold">SPECTER</span> sẽ thay bạn 'đọc' toàn bộ thị trường trong 24h
              qua. Dashboard không hiển thị những bảng biểu phức tạp; nó cung cấp 4 câu trả lời đắt
              giá cho 4 vấn đề sống còn của một cổ phiếu. Kết hợp với hình ảnh nghệ thuật sinh ra từ
              AI đại diện cho trạng thái thị trường, bạn sẽ cảm nhận được nhịp đập của cổ phiếu mà
              không cần tốn hàng giờ nghiên cứu.
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