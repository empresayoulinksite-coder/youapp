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
  Shirt,
  Footprints,
  Watch,
  Sparkles,
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
  { slug: "farmacia", label: "Farmácia", Icon: Pill, tint: "bg-red-50 text-red-600", matches: ["Farmácia", "Farmacia"] },
  { slug: "pet", label: "Pet", Icon: Dog, tint: "bg-purple-50 text-purple-600", matches: ["Pet", "Petshop", "Pet Shop"] },
  { slug: "shopping", label: "Shopping", Icon: ShoppingBag, tint: "bg-fuchsia-50 text-fuchsia-600", matches: ["Shopping", "Loja"] },
  { slug: "moda", label: "Moda", Icon: Shirt, tint: "bg-pink-50 text-pink-700", matches: ["Moda", "Roupas", "Roupa", "Vestuário"] },
  { slug: "calcados", label: "Calçados", Icon: Footprints, tint: "bg-amber-50 text-amber-700", matches: ["Calçados", "Calcados", "Sapatos", "Tênis"] },
  { slug: "acessorios", label: "Acessórios", Icon: Watch, tint: "bg-slate-100 text-slate-700", matches: ["Acessórios", "Acessorios", "Bolsas", "Joias", "Relógios"] },
  { slug: "beleza", label: "Beleza", Icon: Sparkles, tint: "bg-rose-50 text-rose-700", matches: ["Beleza", "Cosméticos", "Cosmeticos", "Perfumaria", "Maquiagem"] },
];

export const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const findCategoryBySlug = (slug: string) =>
  categories.find((c) => c.slug === slug);

// Categorias que usam o layout de vitrine (e-commerce) em vez do delivery clássico.
export const ECOMMERCE_CATEGORY_SLUGS = ["moda", "calcados", "acessorios", "beleza"] as const;
const ECOM_SET = new Set<string>(ECOMMERCE_CATEGORY_SLUGS);

export const isEcommerceCategorySlug = (slug: string | null | undefined) =>
  !!slug && ECOM_SET.has(slug);

// Verifica se uma loja (pelo seu campo `category`) pertence ao mundo e-commerce.
export const isEcommerceStoreCategory = (storeCategory: string) => {
  const n = norm(storeCategory);
  return categories.some(
    (c) => ECOM_SET.has(c.slug) && c.matches.map(norm).includes(n),
  );
};

