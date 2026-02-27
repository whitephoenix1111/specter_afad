// ============================================================
// components/widgets/Porfolio.tsx
// Widget danh mục đầu tư — hiển thị dưới dạng lưới ô vuông button.
//
// Tính năng:
//   - Mỗi mã là một ô vuông nhỏ, click để load tin tức
//   - Mã active → nền đen, chữ trắng
//   - Mã inactive → nền trắng, viền xám, hover nền xám nhạt
//   - MBB luôn là mã đầu tiên (đảm bảo từ App.tsx)
// ============================================================

import React from "react";

interface PortfolioProps {
  tickers: string[];
  activeTicker: string | null;
  onSelect: (ticker: string) => void;
}

const Portfolio: React.FC<PortfolioProps> = ({ tickers, activeTicker, onSelect }) => {
  return (
    <div className="bg-white font-sans w-full px-[20px] py-[32px]">

      {/* Tiêu đề */}
      <div className="flex items-center mb-5">
        <h2 className="text-lg font-bold tracking-tighter ml-auto">DANH MỤC</h2>
      </div>

      {/* Lưới ô vuông */}
      {tickers.length === 0 ? (
        <div className="text-xs text-gray-300 pt-1">Chưa có mã nào</div>
      ) : (
        <div className="flex flex-wrap-reverse gap-2">
          {[...tickers].reverse().map((ticker) => {
            const isActive = ticker === activeTicker;
            return (
              <button
                key={ticker}
                onClick={() => onSelect(ticker)}
                title={`Xem tin tức ${ticker}`}
                className={`
                  flex-1 min-w-[calc(50%-4px)] py-2 text-[13px] font-black uppercase tracking-wider
                  border transition-all duration-150 cursor-pointer text-center
                  ${isActive
                    ? "bg-black text-white border-black"
                    : "bg-white text-black border-gray-300 hover:border-black hover:bg-gray-50"
                  }
                `}
              >
                {ticker}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Portfolio;
