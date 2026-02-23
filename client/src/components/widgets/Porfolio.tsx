
const data = [
  { gia: "97.356",  san: "HOSE", ma: "MBB", highlight: false },
  { gia: "927.356", san: "HOSE", ma: "VNM", highlight: true  },
  { gia: "927.356", san: "HOSE", ma: "VIC", highlight: false },
  { gia: "927.356", san: "HOSE", ma: "HPG", highlight: false },
  { gia: "927.356", san: "HOSE", ma: "FPT", highlight: false },
];

const Portfolio = () => {
  return (
    <div className="bg-white font-sans w-full relative px-[20px] py-[40px]">

      {/* Tiêu đề */}
      <div className="text-base font-bold text-right pr-4 py-3 relative z-10">
        DANH MỤC
      </div>

      {/* Header hàng */}
      <div className="flex py-2 border-b border-gray-200 relative z-10">
        <div className="flex-1 text-right text-xs text-gray-400 font-medium">Giá</div>
        <div className="flex-1 text-right text-xs text-gray-400 font-medium">Sàn</div>
        <div className="flex-1 text-right text-xs text-gray-400 font-medium">Mã</div>
      </div>

      {/* Các hàng data */}
      {data.map((item, index) => (
        <div
          key={index}
          className={`flex py-2 hover:bg-gray-50 transition-colors relative z-10 ${item.highlight ? 'text-[#E67E22]' : 'text-black'}`}
        >
          <div className="flex-1 text-right text-sm font-medium">{item.gia}</div>
          <div className="flex-1 text-right text-sm font-medium">{item.san}</div>
          <div className="flex-1 text-right text-sm font-medium">{item.ma}</div>
        </div>
      ))}

    </div>
  );
};

export default Portfolio;
