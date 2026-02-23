const CalendarComponent = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const today = now.getDate();

  const monthNames = [
    "THÁNG 1","THÁNG 2","THÁNG 3","THÁNG 4","THÁNG 5","THÁNG 6",
    "THÁNG 7","THÁNG 8","THÁNG 9","THÁNG 10","THÁNG 11","THÁNG 12"
  ];

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = Array.from({ length: daysInMonth }, (_, i) => ({
    value: String(i + 1).padStart(2, '0'),
    isToday: i + 1 === today,
  }));

  return (
    <div className="px-[20px] py-[40px] bg-white font-sans w-full border-b border-black">
      {/* Header */}
      <div className="flex items-center mb-5">
        <h2 className="text-lg font-bold tracking-tighter ml-auto">LỊCH {monthNames[month]}</h2>
      </div>

      {/* Calendar Grid */}
      <div className="relative inline-grid grid-cols-6 gap-y-4 gap-x-1 w-full">

        {days.map((day, index) => (
          <div
            key={index}
            className={[
              "z-10 flex items-center justify-center text-[12px] font-medium w-8 h-7 rounded-md",
              day.isToday
                ? "bg-[#E67E22] text-white"
                : "text-black hover:bg-gray-100 cursor-pointer"
            ].join(' ')}
          >
            {day.value}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CalendarComponent;
