import React from 'react';
import type { Article } from '../../types/article';

type ArticleCardProps = Partial<Article>;

const ArticleCard: React.FC<ArticleCardProps> = ({
  date = "19",
  month = "Tháng 9",
  category = "TIN TỨC",
  subCategory = "THỊ TRƯỜNG",
  title = "Tiêu đề bài viết mặc định",
  imageUrl = "https://picsum.photos/400/300"
}) => {
  return (
    <article className="group flex flex-col w-full bg-white pr-[30px] pl-[60px] py-[40px] border-b">
      {/* Header: Date & Category */}
        <div className="flex items-center gap-3 mb-2">
            <div className="bg-[#E67E22] text-white w-10 h-10 flex items-center justify-center font-bold rounded shadow-sm shrink-0">
            {date}
            </div>
            <div className="text-black font-bold text-[16px] leading-tight">{month}</div>
        </div>
        <div className="flex flex-col uppercase tracking-wider mb-4">
            <div className="text-[10px] mt-1 font-bold">
                <span className="text-[#E67E22]">{category}</span>
                <span className="text-gray-400 mx-1">/</span>
                <span className="text-black">{subCategory}</span>
            </div>
        </div>

        {/* Title Section */}
        <h3 className="text-xl font-extrabold leading-tight mb-2 text-black min-h-[56px] line-clamp-2">
            {title}
        </h3>

        {/* Image & Action Button Section */}
        <div className="relative w-full">
            <div className="overflow-hidden bg-gray-100 w-[95%]">
            <img
                src={imageUrl}
                alt={title}
                className="w-full grayscale group-hover:grayscale-0 transition-all duration-500 object-cover aspect-[4/3]"
            />
            </div>

            <button className="absolute bottom-[-12px] right-0 bg-black text-white text-[10px] uppercase font-bold px-8 py-3 shadow-md active:scale-95 transition-all">
                Đọc ngay
            </button>
        </div>
    </article>
  );
};

export default ArticleCard;
