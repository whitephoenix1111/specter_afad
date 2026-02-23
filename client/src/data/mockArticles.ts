import type { Article, HeroArticle } from '../types/article';

export const MOCK_HERO: HeroArticle = {
  id: "hero-1",
  date: "19",
  month: "Tháng 9",
  category: "TIN TỨC",
  subCategory: "RỦI RO",
  title: "MBB Có Tân Lãnh Đạo Mới",
  description: "Lorem Ipsum chỉ đơn giản là một đoạn văn bản giả, được dùng vào việc trình bày và dàn trang phục vụ cho in ấn.",
  imageUrl: "https://picsum.photos/800/600?random=hero"
};

export const MOCK_ARTICLES: Article[] = [
  {
    id: 1,
    date: "19",
    month: "Tháng 9",
    category: "TIN TỨC",
    subCategory: "THỊ TRƯỜNG",
    title: "Thay Đổi Hoặc Là Chết",
    imageUrl: "https://picsum.photos/400/300?random=1"
  },
  {
    id: 2,
    date: "19",
    month: "Tháng 9",
    category: "TIN TỨC",
    subCategory: "RỦI RO",
    title: "MBB Có Tân Lãnh Đạo Mới",
    imageUrl: "https://picsum.photos/400/300?random=2"
  },
  {
    id: 3,
    date: "19",
    month: "Tháng 9",
    category: "TIN TỨC",
    subCategory: "THỊ TRƯỜNG",
    title: "Thế Cục Giữa Nhóm Big 4 Thay Đổi Khá Lớn",
    imageUrl: "https://picsum.photos/400/300?random=3"
  }
];
