"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Header } from "@/components/Header";
import { apiFetch, ApiError } from "@/lib/apiClient";
import { setToken } from "@/lib/auth";

interface LoginResponse {
  token: string;
  expires_in: string;
}

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setToken(data.token);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-sm px-6 py-8">
        <h1 className="font-heading text-2xl text-stone-800">로그인</h1>
        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1 text-sm text-stone-600">
            이메일
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-xl border border-stone-200 px-3 py-2 text-base text-stone-800 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-stone-600">
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              className="rounded-xl border border-stone-200 px-3 py-2 text-base text-stone-800 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </label>
          {error && <p className="text-red-600">{error}</p>}
          <button
            type="submit"
            className="rounded-full bg-primary-500 px-4 py-2.5 font-medium text-white transition hover:bg-primary-600 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "처리 중..." : "로그인"}
          </button>
        </form>
        <p className="mt-4 text-sm text-stone-600">
          계정이 없으신가요?{" "}
          <Link href="/signup" className="font-medium text-primary-600 underline">
            회원가입
          </Link>
        </p>
      </main>
    </>
  );
}
