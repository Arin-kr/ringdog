import { Suspense } from "react";

import { Header } from "@/components/Header";
import { ProductCatalog } from "@/components/ProductCatalog";

export default function HomePage(): JSX.Element {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Suspense fallback={<p className="text-stone-500">불러오는 중...</p>}>
          <ProductCatalog />
        </Suspense>
      </main>
    </>
  );
}
