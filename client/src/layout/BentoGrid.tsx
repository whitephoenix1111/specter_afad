// ============================================================
// layout/BentoGrid.tsx
// Layout chính của toàn bộ ứng dụng — component "trung tâm điều phối".
//
// BentoGrid làm 4 việc:
//   1. Nhận fetchState từ App → quyết định render rỗng hay data thật
//   2. Phân loại articles[] thành 4 nhóm để đổ vào đúng cột
//   3. Chọn bài hero (isFeatured) để render HeroCard
//   4. Render toàn bộ grid 5 cột (4 nội dung + 1 sidebar)
//
// Cấu trúc grid:
//   [ CÂN ĐỐI | TĂNG TRƯỞNG | DIỄN BIẾN GIÁ + RỦI RO (col-span-2) | SIDEBAR ]
//     274px      274px           274px + 274px                          220px
// ============================================================

import { useState } from 'react';
import logo from '../assets/logo.png';
import { BiBook, BiLoader } from "react-icons/bi";
import ArticleCard from '../components/cards/ArticleCard';
import SearchBar from '../components/widgets/SearchBar';
import CalendarComponent from '../components/widgets/Calendar';
import Portfolio from '../components/widgets/Porfolio';
import HeroCard from '../components/cards/HeroCard';
import EmptyColumnPlaceholder from '../components/cards/EmptyColumnPlaceholder';
import SpecterPopup from '../components/popups/SpecterPopup';
import type { FetchState, Article } from '../types/article';


// Không dùng mock data — grid hiển thị rỗng cho đến khi user search ticker đầu tiên.

// ── HELPER: Format ngày từ ISO sang dạng hiển thị ──────────
// Input:  "2025-09-19T10:30:00.000Z"
// Output: { date: "19", month: "Tháng 9" }
// Nếu ISO string không hợp lệ → trả về placeholder "--" / "---" thay vì crash.
function formatDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: "--", month: "---" };
  return {
    date: String(d.getDate()).padStart(2, "0"), // Đảm bảo luôn 2 chữ số: "5" → "05"
    month: `Tháng ${d.getMonth() + 1}`,        // getMonth() trả 0-based → +1
  };
}


// ── Props ──────────────────────────────────────────────────
interface BentoGridProps {
  fetchState: FetchState;                        // Trạng thái fetch từ useStockNews (App.tsx)
  onSearch: (ticker: string) => void;            // Callback khi user submit mã từ SearchBar
  portfolio: string[];                           // Danh sách mã trong danh mục
  activeTicker: string | null;                   // Mã đang được xem
  onSelectTicker: (ticker: string) => void;      // Click mã trong Portfolio
  onAddToPortfolio: (ticker: string) => void;    // Thêm mã mới vào portfolio
  // onReset: () => void;                        // TODO: thêm lại khi có nút "X" xoá kết quả
}


const BentoGrid: React.FC<BentoGridProps> = ({ fetchState, onSearch, portfolio, activeTicker, onSelectTicker, onAddToPortfolio }) => {

  // ── State nội bộ ────────────────────────────────────────
  const [isSpecterOpen, setIsSpecterOpen] = useState(false);

  // Expand/collapse từng cột — mặc định tất cả thu gọn (false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    canDoi: false,
    tangTruong: false,
    dienBienGia: false,
    ruiRo: false,
  });

  const toggleExpand = (col: string) =>
    setExpanded(prev => ({ ...prev, [col]: !prev[col] }));

  const MAX_VISIBLE = 2;


  // ── BƯỚC 1: Xác định nguồn dữ liệu ─────────────────────
  // Chưa search / đang load / lỗi → mảng rỗng, grid hiển thị trống.
  // Search thành công → dùng data thật từ server.
  const articles: Article[] =
    fetchState.status === "success" ? fetchState.data.articles : [];

  // Lấy ticker để hiển thị ở header cột 1 (VD: "VIC · Nền Tảng")
  const ticker =
    fetchState.status === "success" ? fetchState.data.ticker : null;


  // ── BƯỚC 2: Phân loại articles vào 4 nhóm ──────────────
  // Mỗi nhóm là một mảng con của articles[] — lọc theo category.
  // Thứ tự render trong JSX sẽ dùng đúng mảng này.
  const canDoi      = articles.filter(a => a.category === "CÂN ĐỐI");
  const tangTruong  = articles.filter(a => a.category === "TĂNG TRƯỞNG");
  const dienBienGia = articles.filter(a => a.category === "DIỄN BIẾN GIÁ");
  const ruiRo       = articles.filter(a => a.category === "RỦI RO");


  // ── BƯỚC 3: Xác định bài hero ───────────────────────────
  // Chỉ hiện HeroCard khi có bài RỦI RO:
  //   1. Bài có isFeatured = true (do AI chọn, đúng 1 bài trong toàn mảng)
  //   2. Nếu không có isFeatured → lấy bài RỦI RO đầu tiên
  //   3. Không có bài RỦI RO nào → null → HeroCard không render
  const heroArticle =
    articles.find(a => a.isFeatured) ??
    ruiRo[0] ??
    null;


  // ── BƯỚC 4: Render ──────────────────────────────────────
  return (
    <>
      <div className="max-w-8xl mx-auto ">

        {/* Loading Overlay: hiện khi đang chờ server (fetchState.status === "loading").
            fixed + inset-0 phủ toàn màn hình, z-50 đè lên grid.
            Backdrop blur-sm làm mờ grid phía sau, không che trắng hoàn toàn. */}
        {fetchState.status === "loading" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <BiLoader size={40} className="animate-spin text-orange-500" />
              <p className="text-sm font-bold uppercase tracking-widest">Đang tải dữ liệu...</p>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            GRID CHÍNH: 5 cột
            repeat(4, 274px) = 4 cột nội dung × 274px
            220px            = 1 cột sidebar
            Tổng: 274×4 + 220 = 1316px
            ════════════════════════════════════════════════ */}
        <div className="border-l  border-black" style={{ width: '1316px' }}>

          {/* Error Banner — khớp width với grid */}
          {fetchState.status === "error" && (
            <div className="w-full bg-red-50 border-b border-r border-black text-red-700 text-xs font-bold px-6 py-2 flex justify-between items-center">
              <span>⚠ Lỗi: {fetchState.message}</span>
              <span className="opacity-60">Vui lòng thử lại</span>
            </div>
          )}

          {/* Empty state — khớp width với grid */}
          {fetchState.status === "success" && articles.length === 0 && (
            <div className="w-full border-b border-r border-black bg-[#E67E22] text-white text-xs font-bold px-8 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-white/60 uppercase tracking-widest">Kết quả tìm kiếm</span>
                <span className="text-white/40">·</span>
                <span>Không tìm thấy tin tức nào cho mã</span>
                <span className="bg-white text-[#E67E22] px-2 py-0.5 rounded-sm font-black tracking-wider">
                  {fetchState.data.ticker}
                </span>
              </div>
              <span className="text-white/70 uppercase tracking-widest">Hãy thử mã khác</span>
            </div>
          )}

          <div className="grid gap-0" style={{ gridTemplateColumns: 'repeat(4, 274px) 220px' }}>


            {/* ╔══════════════════╗
                ║  CỘT 1: CÂN ĐỐI  ║  274px
                ╚══════════════════╝
                Tin trung lập, thông tin nền tảng về công ty. */}
            <div className="border-r border-black flex flex-col">

              {/* Header cột — hiển thị ticker nếu đã search, ngược lại "Cân Đối" */}
              <div className="h-[70px] border-b border-black flex items-center justify-between font-bold text-xs uppercase">
                <div className='w-[80px] h-full flex items-center justify-center border-r'>
                  <img className='w-[35px] h-[50px]' src={logo} alt="logo" />
                </div>
                <div className='pr-[30px]'>
                  {ticker ? `${ticker} · Cân Đối` : "Cân Đối"}
                </div>
              </div>

              {/* Danh sách bài CÂN ĐỐI */}
              <div className="flex flex-col">
                {canDoi.length === 0 && fetchState.status === "success" ? (
                  <EmptyColumnPlaceholder
                    category="CÂN ĐỐI"
                    oldArticle={articles.filter(a => a.category === "CÂN ĐỐI")[0]}
                  />
                ) : (
                  <>
                    {(expanded.canDoi ? canDoi : canDoi.slice(0, MAX_VISIBLE)).map((article, i) => {
                      const { date, month } = formatDate(article.publishedAt);
                      return (
                        <ArticleCard
                          key={article.url + i}
                          date={date}
                          month={month}
                          source={article.source}
                          subCategory={article.category}
                          title={article.title}
                          imageUrl={article.imageUrl}
                          url={article.url}
                        />
                      );
                    })}
                    {canDoi.length > MAX_VISIBLE && (
                      <button
                        onClick={() => toggleExpand('canDoi')}
                        className="cursor-pointer w-full py-4 text-[10px] font-black uppercase tracking-widest border-b border-dashed text-gray-400 hover:text-black hover:bg-gray-50 transition-all duration-200"
                      >
                        {expanded.canDoi ? '↑ Thu gọn' : `+ ${canDoi.length - MAX_VISIBLE} tin khác`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>


            {/* ╔══════════════════════╗
                ║  CỘT 2: TĂNG TRƯỞNG  ║  274px
                ╚══════════════════════╝
                Tin tích cực, triển vọng tăng trưởng. */}
            <div className="border-r border-black flex flex-col">

              <div className="w-full h-[70px] border-b border-black flex items-center justify-end font-bold text-xs uppercase">
                <div className='pr-[30px]'>Tăng trưởng</div>
              </div>

              <div className="flex flex-col">
                {tangTruong.length === 0 && fetchState.status === "success" ? (
                  <EmptyColumnPlaceholder
                    category="TĂNG TRƯỞNG"
                    oldArticle={articles.filter(a => a.category === "TĂNG TRƯỞNG")[0]}
                  />
                ) : (
                  <>
                    {(expanded.tangTruong ? tangTruong : tangTruong.slice(0, MAX_VISIBLE)).map((article, i) => {
                      const { date, month } = formatDate(article.publishedAt);
                      return (
                        <ArticleCard
                          key={article.url + i}
                          date={date}
                          month={month}
                          source={article.source}
                          subCategory={article.category}
                          title={article.title}
                          imageUrl={article.imageUrl}
                          url={article.url}
                        />
                      );
                    })}
                    {tangTruong.length > MAX_VISIBLE && (
                      <button
                        onClick={() => toggleExpand('tangTruong')}
                        className="cursor-pointer w-full py-4 text-[10px] font-black uppercase tracking-widest border-b border-dashed text-gray-400 hover:text-black hover:bg-gray-50 transition-all duration-200"
                      >
                        {expanded.tangTruong ? '↑ Thu gọn' : `+ ${tangTruong.length - MAX_VISIBLE} tin khác`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>


            {/* ╔═══════════════════════════════════════════════╗
                ║  CỘT 3+4: DIỄN BIẾN GIÁ + RỦI RO (col-span-2) ║  548px
                ╚═══════════════════════════════════════════════╝
                Hai cột ghép lại, chia sẻ một HeroCard phía trên chiếm hết 548px.
                Phía dưới HeroCard mới tách lại thành 2 cột riêng biệt 274px. */}
            <div className="col-span-2 border-r border-black flex flex-col">

              {/* Header kép: 2 tiêu đề nằm cạnh nhau trong grid 274+274 */}
              <div className="grid border-b border-black h-[70px]" style={{ gridTemplateColumns: '274px 274px' }}>
                <div className="border-r border-black flex items-center justify-end font-bold text-xs uppercase">
                  <div className='pr-[30px]'>Diễn biến giá</div>
                </div>
                <div className="flex items-center justify-end font-bold text-xs uppercase">
                  <div className='pr-[30px]'>Rủi ro</div>
                </div>
              </div>

              {/* HeroCard: chiếm toàn bộ 548px, chỉ render khi có bài được chọn */}
              {heroArticle && (
                <div className="border-b border-black">
                  <HeroCard
                    date={formatDate(heroArticle.publishedAt).date}
                    month={formatDate(heroArticle.publishedAt).month}
                    source={heroArticle.source}
                    subCategory={heroArticle.category}
                    title={heroArticle.title}
                    imageUrl={heroArticle.imageUrl}
                    description={heroArticle.summary ?? ""} // summary chỉ có khi isFeatured
                    url={heroArticle.url}
                  />
                </div>
              )}

              {/* Phần dưới HeroCard: tách lại thành 2 cột riêng */}
              <div className="grid flex-1" style={{ gridTemplateColumns: '274px 274px' }}>

                {/* Cột 3: DIỄN BIẾN GIÁ */}
                <div className="border-r border-black flex flex-col">
                  {dienBienGia.length === 0 && fetchState.status === "success" ? (
                    <EmptyColumnPlaceholder
                      category="DIỄN BIẾN GIÁ"
                      oldArticle={articles.filter(a => a.category === "DIỄN BIẾN GIÁ")[0]}
                    />
                  ) : (
                    <>
                      {(expanded.dienBienGia ? dienBienGia : dienBienGia.slice(0, MAX_VISIBLE)).map((article, i) => {
                        const { date, month } = formatDate(article.publishedAt);
                        return (
                          <ArticleCard
                            key={article.url + i}
                            date={date}
                            month={month}
                            source={article.source}
                            subCategory={article.category}
                            title={article.title}
                            imageUrl={article.imageUrl}
                            url={article.url}
                          />
                        );
                      })}
                      {dienBienGia.length > MAX_VISIBLE && (
                        <button
                          onClick={() => toggleExpand('dienBienGia')}
                          className="cursor-pointer w-full py-4 text-[10px] font-black uppercase tracking-widest border-b border-dashed text-gray-400 hover:text-black hover:bg-gray-50 transition-all duration-200"
                        >
                          {expanded.dienBienGia ? '↑ Thu gọn' : `+ ${dienBienGia.length - MAX_VISIBLE} tin khác`}
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Cột 4: RỦI RO — loại trừ bài isFeatured vì bài đó đã render ở HeroCard */}
                <div className="flex flex-col border-r">
                  {ruiRo.filter(a => !a.isFeatured).length === 0 && fetchState.status === "success" ? (
                    <EmptyColumnPlaceholder
                      category="RỦI RO"
                      oldArticle={articles.filter(a => a.category === "RỦI RO")[0]}
                    />
                  ) : (
                    <>
                      {(expanded.ruiRo ? ruiRo.filter(a => !a.isFeatured) : ruiRo.filter(a => !a.isFeatured).slice(0, MAX_VISIBLE)).map((article, i) => {
                        const { date, month } = formatDate(article.publishedAt);
                        return (
                          <ArticleCard
                            key={article.url + i}
                            date={date}
                            month={month}
                            source={article.source}
                            subCategory={article.category}
                            title={article.title}
                            imageUrl={article.imageUrl}
                            url={article.url}
                          />
                        );
                      })}
                      {ruiRo.filter(a => !a.isFeatured).length > MAX_VISIBLE && (
                        <button
                          onClick={() => toggleExpand('ruiRo')}
                          className="cursor-pointer w-full py-4 text-[10px] font-black uppercase tracking-widest border-b border-dashed text-gray-400 hover:text-black hover:bg-gray-50 transition-all duration-200"
                        >
                          {expanded.ruiRo ? '↑ Thu gọn' : `+ ${ruiRo.filter(a => !a.isFeatured).length - MAX_VISIBLE} tin khác`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>


            {/* ╔═══════════╗
                ║  SIDEBAR  ║  220px
                ╚═══════════╝
                Cột phải: nút Specter + SearchBar + Calendar + Portfolio.
                SearchBar là nơi duy nhất user tương tác để trigger fetch API. */}
            <div className="flex flex-col border-r">

              {/* Header sidebar: nút mở popup giải thích Specter là gì */}
              <div className="h-[70px] border-b  border-black flex items-center justify-end font-bold text-xs">
                <button
                  onClick={() => setIsSpecterOpen(true)}
                  className="border mx-[20px] py-1 flex items-center rounded-xs w-max cursor-pointer hover:bg-black hover:text-white transition-colors"
                >
                  <BiBook size={24} className='ml-[10px]' />
                  <div className='pl-2 pr-4'>SPECTER LÀ GÌ?</div>
                </button>
              </div>

              {/* SearchBar: nhận onSearch prop, khi user submit ticker sẽ gọi
                  fetchStock() trong useStockNews qua chuỗi: SearchBar → SearchPopup → App */}
              <SearchBar onSearch={onSearch} onAddToPortfolio={onAddToPortfolio} />

              {/* Widget lịch và danh mục */}
              <CalendarComponent />
              <Portfolio
                tickers={portfolio}
                activeTicker={activeTicker}
                onSelect={onSelectTicker}
              />
            </div>

          </div>{/* end grid */}
        </div>{/* end wrapper 1316px */}
      </div>

      {/* Popup giải thích Specter — nằm ngoài grid để fixed/absolute không bị clip */}
      <SpecterPopup isOpen={isSpecterOpen} onClose={() => setIsSpecterOpen(false)} />
    </>
  );
};

export default BentoGrid;
