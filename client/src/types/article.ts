export interface Article {
  id: number | string;
  date: string;
  month: string;
  category: string;
  subCategory: string;
  title: string;
  imageUrl: string;
}

export interface HeroArticle extends Article {
  description: string;
}
