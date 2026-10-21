import Link from "next/link";

import { Header } from "@/components/Header";

export default function NotFound(): JSX.Element {
  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-stone-900">페이지를 찾을 수 없습니다</h1>
        <p className="text-stone-500">주소가 잘못되었거나 삭제된 페이지입니다.</p>
        <Link
          href="/"
          className="rounded bg-primary-500 px-5 py-2.5 font-bold text-white transition hover:bg-primary-600"
        >
          홈으로 가기
        </Link>
      </main>
    </>
  );
}
