"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { clearToken, isLoggedIn } from "@/lib/auth";
import { Logo } from "@/components/Logo";

export function Header(): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setLoggedIn(isLoggedIn());
  }, [pathname]);

  function handleSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `/?q=${encodeURIComponent(q)}` : "/");
  }

  function handleLogout(): void {
    clearToken();
    setLoggedIn(false);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="bg-primary-500 text-white shadow-soft">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-heading text-xl">
          <Logo className="h-8 w-8" />
          RingDog
        </Link>

        <form className="flex min-w-[200px] flex-1 gap-2" onSubmit={handleSearch}>
          <input
            type="search"
            placeholder="키워드 검색 (예: 가죽, 에어팟)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="flex-1 rounded-full border-none px-4 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-white"
          />
          <button
            type="submit"
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-primary-600 transition hover:bg-primary-50"
          >
            검색
          </button>
        </form>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/cart" className="hover:underline">
            장바구니
          </Link>
          {loggedIn ? (
            <>
              <Link href="/orders" className="hover:underline">
                주문내역
              </Link>
              <button type="button" className="hover:underline" onClick={handleLogout}>
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:underline">
                로그인
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-white px-3 py-1.5 font-medium text-primary-600 transition hover:bg-primary-50"
              >
                회원가입
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
