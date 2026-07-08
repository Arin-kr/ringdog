"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { clearToken, isLoggedIn } from "@/lib/auth";

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
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="site-header__logo">
          RingDog
        </Link>

        <form className="site-header__search" onSubmit={handleSearch}>
          <input
            type="search"
            placeholder="키워드 검색 (예: 가죽, 에어팟)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="submit">검색</button>
        </form>

        <nav className="site-header__nav">
          <Link href="/cart">장바구니</Link>
          {loggedIn ? (
            <button type="button" className="link-button" onClick={handleLogout}>
              로그아웃
            </button>
          ) : (
            <>
              <Link href="/login">로그인</Link>
              <Link href="/signup" className="button button--small">
                회원가입
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
