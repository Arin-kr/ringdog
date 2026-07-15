/**
 * Keyed by the seed data's `adjective` tag (packages/db/prisma/seed.ts
 * ADJECTIVES). Each value is a Tailwind class string for the badge behind
 * a product icon — background/gradient, icon (text) color, and any extra
 * ring/shadow treatment matching that material's real-world look.
 */
export const MATERIAL_STYLES: Record<string, string> = {
  가죽: "bg-gradient-to-br from-amber-700 to-amber-900 text-amber-50",
  미니멀: "bg-stone-100 text-stone-500 ring-1 ring-stone-200",
  빈티지: "bg-gradient-to-br from-orange-200 to-rose-300 text-rose-800",
  우드: "bg-gradient-to-br from-yellow-800 to-yellow-950 text-yellow-50",
  메탈: "bg-gradient-to-br from-slate-300 to-slate-500 text-slate-800",
  실리콘: "bg-gradient-to-br from-sky-200 to-sky-300 text-sky-700",
  레트로: "bg-gradient-to-br from-fuchsia-300 to-amber-200 text-fuchsia-800",
  홀로그램: "bg-[conic-gradient(from_90deg,#fbc2eb,#a6c1ee,#fbc2eb)] text-violet-700",
  파스텔: "bg-gradient-to-br from-primary-100 to-mint-100 text-primary-600",
  캔버스: "bg-stone-200 text-stone-600",
  니트: "bg-gradient-to-br from-rose-100 to-rose-200 text-rose-700",
  투명: "bg-white/60 text-stone-500 ring-1 ring-stone-200 backdrop-blur",
  각인: "bg-gradient-to-br from-zinc-300 to-zinc-400 text-zinc-800",
  야광: "bg-mint-900 text-mint-300 shadow-[0_0_16px_2px_rgba(74,222,128,0.5)]",
  미니: "bg-gradient-to-br from-primary-100 to-primary-200 text-primary-700",
};

export const DEFAULT_MATERIAL_STYLE = "bg-stone-100 text-stone-400 ring-1 ring-stone-200";
