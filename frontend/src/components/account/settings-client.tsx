"use client";
import Link from "@/components/common/app-link";
import { useAuth } from "@/components/provider/auth-provider";
import { useTheme } from "@/components/provider/theme-provider";
import { ChoiceGroup } from "@/components/workspace/choice-group";
import CalendarConnection from "./calendar-connection";
import LogoutControls from "./logout-controls";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export default function SettingsClient() {
  const { session, isAdmin, isLoading } = useAuth();
  const { theme, setTheme, isLargeText, toggleLargeText } = useTheme();
  const company = useQuery({
    queryKey: ["settings-company", session?.id],
    queryFn: () => apiFetch<{ name: string }>("/admin/accounts/company"),
    enabled: !!session && isAdmin,
  });
  if (isLoading) return <main className="work-page">설정을 불러오는 중…</main>;
  if (!session)
    return (
      <main className="work-page">
        <Link href="/login?next=/settings">로그인 후 설정을 이용하세요.</Link>
      </main>
    );
  const role = {
    PLATFORM_ADMIN: "플랫폼 관리자",
    SUPER_ADMIN: "최고관리자",
    ADMIN: "관리자",
    USER: "사용자",
  }[session.role];
  return (
    <main className="work-page settings-page">
      <h1 className="hidden lg:block">설정</h1>
      <section className="work-panel settings-section settings-account-section">
        <h2>내 계정</h2>
        <Link href="/account" className="settings-link settings-account" aria-label={`${session.name} 내 정보 · 비밀번호 관리`}>
          <span className="settings-account-details">
            <strong>{session.name}</strong>
            <small>{session.email}</small>
            <small>{company.data?.name ? `${company.data.name} · ` : ""}{role}</small>
          </span>
          <span aria-hidden="true">›</span>
        </Link>
        <p className="settings-account-hint">내 정보 · 비밀번호 관리</p>
      </section>
      <section className="work-panel settings-section">
        <h2>화면 설정</h2>
        <ChoiceGroup
          legend="화면 테마"
          value={theme}
          onChange={(v) => setTheme(v as "light" | "dark" | "system")}
          options={[
            ["light", "밝게"],
            ["dark", "어둡게"],
            ["system", "기기 설정"],
          ]}
        />
        <button
          type="button"
          role="switch"
          aria-checked={isLargeText}
          className="settings-switch"
          onClick={toggleLargeText}
        >
          <span>
            <strong>큰 글씨</strong>
            <small>본문과 주요 정보를 더 크게 표시합니다.</small>
          </span>
          <span
            aria-hidden="true"
            className={isLargeText ? "on" : ""}
          >
            <i />
          </span>
        </button>
      </section>
      <section className="work-panel settings-section">
        <h2>알림</h2>
        <SettingsLink
          href="/baselines"
          title="도착한 알림"
          description="문제 확인과 알림 일시 중지"
        />
        <SettingsLink
          href="/baselines?view=settings"
          title="알림 설정"
          description="병원별 기준 · 받는 시간 · 반복"
        />
      </section>
      {isAdmin && (
        <section className="work-panel settings-section">
          <h2>관리</h2>
          <SettingsLink
            href="/admin"
            title="관리 설정"
            description="사용자·초대·병원·측정항목·활동 기록"
          />
          {session.role === "PLATFORM_ADMIN" && (
            <SettingsLink
              href="/companies"
              title="회사 관리"
              description="고객 회사 등록과 소속 관리"
            />
          )}
        </section>
      )}
      <section className="work-panel settings-section">
        <h2>서비스 안내</h2>
        <SettingsLink href="/about" title="MReyes 소개" description="모니터링과 현장 서비스 관리" />
        <SettingsLink href="/terms" title="이용약관" description="서비스 이용 안내" />
        <SettingsLink href="/privacy" title="개인정보 처리방침" description="개인정보 처리 및 권리 안내" />
        <SettingsLink href="/privacy-requests" title="개인정보 요청" description="열람·정정·삭제 요청과 처리 결과" />
      </section>
      <CalendarConnection userId={session.id} />
      <LogoutControls />
    </main>
  );
}
function SettingsLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="settings-link"
    >
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <span aria-hidden="true">›</span>
    </Link>
  );
}
