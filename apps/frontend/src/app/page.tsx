import { Suspense } from "react";

import { Header } from "@/components/Header";
import { ProductCatalog } from "@/components/ProductCatalog";

export default function HomePage(): JSX.Element {
  return (
    <>
      <Header />
      <main>
        <Suspense fallback={<p>불러오는 중...</p>}>
          <ProductCatalog />
        </Suspense>
      </main>
    </>
  );
}
