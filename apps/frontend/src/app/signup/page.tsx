"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Header } from "@/components/Header";
import { apiFetch, ApiError } from "@/lib/apiClient";

export default function SignupPage(): JSX.Element {
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
      await apiFetch("/api/auth/signup", {
        method: "POST",
        body: { email, password },
      });
      router.push("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "회원가입에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />
      <main className="auth-page">
        <h1>회원가입</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            이메일
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            비밀번호 (8자 이상)
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
            {loading ? "처리 중..." : "가입하기"}
          </button>
        </form>
        <p>
          이미 계정이 있으신가요? <Link href="/login">로그인</Link>
        </p>
      </main>
    </>
  );
}
