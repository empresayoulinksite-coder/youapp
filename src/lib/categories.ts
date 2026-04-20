import {
  UtensilsCrossed,
  Pizza,
  Beef,
  IceCream,
  Coffee,
  Sandwich,
  Soup,
  Salad,
  Cookie,
  Beer,
  Apple,
  Pill,
  Dog,
  ShoppingBag,
} from "lucide-react";

export type Category = {
  slug: string;
  label: string;
  Icon: typeof Pizza;
  tint: string;
  // matches: lista de valores aceitos no campo stores.category (case/acentos ignorados).
  matches: string[];
};

export const categories: Category[] = [
  { slug: "restaurantes", label: "Restaurantes", Icon: UtensilsCrossed, tint: "bg-brand-soft text-brand", matches: ["Lanches", "Pizza", "Japonesa", "Brasileira", "Saudável", "Italiana", "Mexicana", "Árabe", "Vegetariana"] },
  { slug: "mercado", label: "Mercado", Icon: Apple, tint: "bg-green-50 text-green-600", matches: ["Mercado"] },
  { slug: "lanches", label: "Lanches", Icon: Sandwich, tint: "bg-amber-50 text-amber-600", matches: ["Lanches"] },
  { slug: "pizza", label: "Pizza", Icon: Pizza, tint: "bg-orange-50 text-orange-600", matches: ["Pizza"] },
  { slug: "brasileira", label: "Brasileira", Icon: Beef, tint: "bg-rose-50 text-rose-600", matches: ["Brasileira"] },
  { slug: "japonesa", label: "Japonesa", Icon: Soup, tint: "bg-pink-50 text-pink-600", matches: ["Japonesa"] },
  { slug: "saudavel", label: "Saudável", Icon: Salad, tint: "bg-emerald-50 text-emerald-600", matches: ["Saudável"] },
  { slug: "doces", label: "Doces", Icon: Cookie, tint: "bg-yellow-50 text-yellow-700", matches: ["Doces", "Confeitaria"] },
  { slug: "sorvetes", label: "Sorvetes", Icon: IceCream, tint: "bg-sky-50 text-sky-600", matches: ["Sorvetes", "Açaí"] },
  { slug: "cafe", label: "Café", Icon: Coffee, tint: "bg-stone-100 text-stone-700", matches: ["Café", "Cafeteria"] },
  { slug: "bebidas", label: "Bebidas", Icon: Beer, tint: "bg-indigo-50 text-indigo-600", matches: ["Bebidas", "Adega"] },
];

export const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const findCategoryBySlug = (slug: string) =>
  categories.find((c) => c.slug === slug);
