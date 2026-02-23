import React from 'react';
import type { HeroArticle } from '../../types/article';
import { MOCK_HERO } from '../../data/mockArticles';

interface HeroCardProps {
  data?: HeroArticle;
}

const HeroCard: React.FC<HeroCardProps> = ({ data = MOCK_HERO }) => {
  return (
    <article className="group flex flex-col w-full bg-white pr-[30px] pl-[60px] py-[40px]">
      {/* 1. Header: Giữ đồng nhất với ArticleCard */}
        <div className="flex items-center gap-3 mb-2">
            <div className="bg-[#E67E22] text-white w-10 h-10 flex items-center justify-center font-bold rounded shadow-sm shrink-0">
            {data.date}
            </div>
            <div className="text-black font-bold text-[16px] leading-tight">{data.month}</div>
        </div>
        <div className="flex flex-col uppercase tracking-wider mb-4">
            <div className="text-[10px] mt-1 font-bold">
                <span className="text-[#E67E22]">{data.category}</span>
                <span className="text-gray-400 mx-1">/</span>
                <span className="text-black">{data.subCategory}</span>
            </div>
        </div>

        {/* 2. Body Section: Grid 2 cột cho Ảnh và Tiêu đề */}
        <div className="grid grid-cols-12 gap-4 items-center">
          {/* Khối Ảnh bên trái - Chiếm 10/12 cột */}
          <div className="col-span-10 overflow-hidden relative">
            <img
              src={data.imageUrl}
              alt={data.title}
              className="w-[370px] h-[208px] grayscale group-hover:grayscale-0 transition-all duration-700"
            />
          </div>

          {/* Khối Tiêu đề bên phải - Chiếm 2/12 cột */}
          <div className="col-span-2">
            <h2 className="text-[24px] font-extrabold leading-tight text-black break-words">
              MBB Có Tân Lãnh Đạo Mới
            </h2>
          </div>
        </div>

        {/* 3. Footer Section: Description & Button */}
        <div className="mt-6 flex flex-col md:flex-row justify-between items-end gap-4">
          <p className="text-gray-600 text-sm max-w-xl leading-relaxed">
            {data.description}
          </p>

          <button className="bg-black text-white text-[11px] uppercase font-bold px-8 py-4 whitespace-nowrap hover:bg-zinc-800 transition-colors shadow-lg">
            Đọc ngay
          </button>
        </div>
    </article>
  );
};

export default HeroCard;
