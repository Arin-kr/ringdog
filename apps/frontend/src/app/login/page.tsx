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
      <main className="auth-page">
        <h1>로그인</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            이메일
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="button" disabled={loading}>
            {loading ? "처리 중..." : "로그인"}
          </button>
        </form>
        <p>
          계정이 없으신가요? <Link href="/signup">회원가입</Link>
        </p>
      </main>
    </>
  );
}
