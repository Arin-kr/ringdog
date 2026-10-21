"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import { clearToken, isLoggedIn } from "@/lib/auth";
import { CATEGORIES, categorySearchHref } from "@/lib/categories";
import { Logo } from "@/components/Logo";

const QUICK_CATEGORIES = CATEGORIES.slice(0, 4);

export function Header(): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

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
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-primary-600">
          <Logo className="h-9 w-9" />
          RingDog
        </Link>

        <form className="flex min-w-[240px] flex-1" onSubmit={handleSearch}>
          <input
            type="search"
            placeholder="키워드 검색 (예: 가죽, 에어팟)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 flex-1 rounded-l-md border-2 border-r-0 border-primary-500 px-4 text-base text-stone-800 placeholder:text-stone-400 focus:outline-none"
          />
          <button
            type="submit"
            className="h-11 rounded-r-md bg-primary-500 px-6 text-base font-bold text-white transition hover:bg-primary-600"
          >
            검색
          </button>
        </form>

        <nav className="flex items-center gap-5 text-[15px] text-stone-700">
          <Link href="/cart" className="hover:text-primary-600">
            장바구니
          </Link>
          {loggedIn ? (
            <>
              <Link href="/orders" className="hover:text-primary-600">
                주문내역
              </Link>
              <button type="button" className="hover:text-primary-600" onClick={handleLogout}>
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-primary-600">
                로그인
              </Link>
              <Link href="/signup" className="hover:text-primary-600">
                회원가입
              </Link>
            </>
          )}
        </nav>
      </div>

      <div className="border-t border-stone-100">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 text-[15px] font-medium text-stone-700">
          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="py-3 font-bold text-stone-900 hover:text-primary-600"
            >
              ☰ 카테고리
            </button>
            {menuOpen && (
              <ul className="absolute left-0 top-full z-30 w-44 rounded-b-md border border-stone-200 bg-white py-1 shadow-soft-lg">
                {CATEGORIES.map((category) => (
                  <li key={category.slug}>
                    <Link
                      href={categorySearchHref(category)}
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2 hover:bg-primary-50 hover:text-primary-600"
                    >
                      {category.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link href="/?q=%EC%84%B8%EC%9D%BC" className="py-3 text-primary-600 hover:underline">
            타임세일
          </Link>
          <Link href="/#all-products" className="py-3 hover:text-primary-600">
            신상품
          </Link>
          {QUICK_CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              href={categorySearchHref(category)}
              className="hidden py-3 hover:text-primary-600 sm:block"
            >
              {category.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
