import { useState } from 'react'
import logo from '../assets/logo.png'
import { BiBook } from "react-icons/bi"
import ArticleCard from '../components/cards/ArticleCard'
import SearchBar from '../components/widgets/SearchBar'
import CalendarComponent from '../components/widgets/Calendar'
import Portfolio from '../components/widgets/Porfolio'
import HeroCard from '../components/cards/HeroCard'
import { MOCK_ARTICLES, MOCK_HERO } from '../data/mockArticles'
import SpecterPopup from '../components/popups/SpecterPopup'

const BentoGrid = () => {
  const [isSpecterOpen, setIsSpecterOpen] = useState(false)

  return (
    <>
    <div className="max-w-8xl mx-auto">
      {/* Cấu trúc Grid chính: 274px × 4 cột nội dung + 220px sidebar = 1316px */}
      <div className="grid gap-0 border-l border-black" style={{ gridTemplateColumns: 'repeat(4, 274px) 220px' }}>
        
        {/* CỘT 1: CHẤT LƯỢNG — 274px */}
        <div className="border-r border-black flex flex-col">
          <div className="h-12 border-b border-black flex items-center justify-between font-bold text-xs uppercase h-[70px]">
            <div className='w-[80px] h-full flex items-center justify-center border-r'><img className='w-[35px] h-[50px]' src={logo} alt="logo" /></div>
            <div className='pr-[30px]'>Nền Tảng</div>
          </div>

        </div>

        {/* CỘT 2: TĂNG TRƯỞNG — 274px */}
        <div className="border-r border-black flex flex-col">
          <div className="w-full h-12 border-b border-black flex items-center justify-end font-bold text-xs uppercase h-[70px]">
            <div className='pr-[30px]'>Tăng trưởng</div>
          </div>
        </div>

        {/* CỘT 3+4: DIỄN BIẾN THỊ TRƯỜNG + BIẾN ĐỘNG RỦI RO — 548px (col-span-2) */}
        <div className="col-span-2 border-r border-black flex flex-col">
          {/* 2 header nằm cạnh nhau */}
          <div className="grid border-b border-black h-[70px]" style={{ gridTemplateColumns: '274px 274px' }}>
            <div className="border-r border-black flex items-center justify-end font-bold text-xs uppercase">
              <div className='pr-[30px]'>Diễn biến thị trường</div>
            </div>
            <div className="flex items-center justify-end font-bold text-xs uppercase">
              <div className='pr-[30px]'>Biến động rủi ro</div>
            </div>
          </div>

          {/* HeroCard chiếm toàn bộ 2 cột */}
          <div className="border-b border-black">
            <HeroCard data={MOCK_HERO} />
          </div>

          {/* Bên dưới HeroCard: chia lại 2 cột riêng cho ArticleCard */}
          <div className="grid flex-1" style={{ gridTemplateColumns: '274px 274px' }}>
            {/* Cột 3: Diễn biến thị trường */}
            <div className="border-r border-black flex flex-col gap-6">
                {MOCK_ARTICLES.filter((_, i) => i % 2 === 0).map(article => (
                <ArticleCard key={article.id} {...article} />
              ))}
            </div>
            {/* Cột 4: Biến động rủi ro */}
            <div className="flex flex-col gap-6 border-r">
                {MOCK_ARTICLES.filter((_, i) => i % 2 !== 0).map(article => (
                <ArticleCard key={article.id} {...article} />
              ))}
            </div>
          </div>
        </div>

        {/* SIDEBAR — 220px */}
        <div className="border-r border-black flex flex-col">
          <div className="h-12 border-b border-black flex items-center justify-end font-bold text-xs h-[70px]">
            <button
              onClick={() => setIsSpecterOpen(true)}
              className="border mx-[20px] py-1 flex items-center rounded-xs w-max cursor-pointer hover:bg-black hover:text-white transition-colors"
            >
              <BiBook size={24} className='ml-[10px]' />
              <div className='pl-2 pr-4'>SPECTER LÀ GÌ?</div>
            </button>
          </div>

          <SearchBar />

          <CalendarComponent />

          <Portfolio />
        </div>

      </div>
    </div>

      <SpecterPopup
        isOpen={isSpecterOpen}
        onClose={() => setIsSpecterOpen(false)}
      />
    </>
  )
}

export default BentoGrid