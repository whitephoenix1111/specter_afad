import React, { useState } from 'react';
import { BiSun, BiSearch } from "react-icons/bi"
import SearchPopup from '../popups/SearchPopup'

const SearchBar = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Mock data cho ngày tháng - Trong thực tế nên dùng date-fns hoặc Intl.DateTimeFormat
  const today = {
    dayOfWeek: "Thứ năm",
    date: "19 THÁNG 9",
    label: "HÔM NAY"
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    // Logic tìm kiếm mã cổ phiếu sẽ thực hiện ở đây
  };

  return (
    <div className="flex flex-col w-full max-w-md px-[20px] py-[40px] bg-white font-sans border-b">
      
      {/* Header: Date Display */}
      <div className="flex flex-col mb-12">
        <div className="flex items-center gap-2 text-orange-500 font-bold text-[18px] ml-auto">
          <BiSun size={24} />
          <span>{today.label}</span>
        </div>
        <div className="text-[18px] font-black mt-1 ml-auto">
          {today.date}
        </div>
        <div className="text-gray-600 text-[14px] ml-auto">
          {today.dayOfWeek}
        </div>
      </div>

      {/* Input: Search Field */}
      <div className="relative group" onClick={() => setIsSearchOpen(true)}>
        <div className="flex items-center border-b border-gray-800 pb-4 cursor-pointer">
          <input
            type="text"
            placeholder="Tìm cổ phiếu"
            value={searchTerm}
            onChange={handleSearch}
            readOnly
            className="w-full text-[14px] outline-none placeholder-gray-400 bg-transparent cursor-pointer"
          />
          <button 
            aria-label="Search"
            className="ml-2 hover:scale-110 transition-transform"
          >
            <BiSearch size={24} className="text-black" />
          </button>
        </div>
      </div>

      <SearchPopup
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

    </div>
  );
};

export default SearchBar;