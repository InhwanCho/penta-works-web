"use client";

import ThreeDotLoader from "@/components/icons/three-dot-loader";
import { useAuth } from "@/components/provider/auth-provider";
import {
  ALERT_KIND_LABEL,
  type AlertLogKind,
  MOCK_ALERT_LOGS,
  MOCK_ALERT_THRESHOLDS,
  MOCK_USERS_ROWS,
  USER_ROLE_LABEL,
  formatIsoDate,
  formatIsoDateTime,
} from "@/components/admin/mock-data";
import Link from "next/link";
import type React from "react";
import { useState } from "react";

type TabKey = "thresholds" | "logs" | "users";

const TABS: readonly { key: TabKey; label: string; table: string }[] = [
  { key: "thresholds", label: "알림 임계값", table: "alert_settings" },
  { key: "logs", label: "발송 이력", table: "alert_log" },
  { key: "users", label: "사용자", table: "users" },
] as const;

export default function AdminClient() {
  const { session, isLoading } = useAuth();
  const [tab, setTab] = useState<TabKey>("thresholds");

  if (isLoading) {
    return (
      <main className="mx-auto flex h-[90vh] w-full items-center justify-center">
        <ThreeDotLoader size="xl" />
      </main>
    );
  }

  if (!session || session.role !== "admin") {
    return <AccessDenied hasSession={!!session} />;
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
      <header className="mb-5 lg:mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-text-major dark:text-text-dark-primary text-xl font-semibold tracking-tight lg:text-2xl">
            관리자
          </h1>
          <MockBadge />
        </div>
        <p className="text-text-secondary dark:text-text-dark-primary/60 mt-1 text-sm">
          {session.username} (관리자) 로 로그인했습니다. 아래 화면은 실제 DB와
          연결되지 않은 목업입니다.
        </p>
      </header>

      {/* 목업 안내 배너 */}
      <div className="mb-5 rounded-lg border border-amber-300/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-300">
        <span className="font-semibold">아직 DB에 연결되지 않았습니다.</span>{" "}
        표시되는 값은 전부 고정된 예시 데이터이며, 저장·수정 기능은 동작하지
        않습니다.
      </div>

      {/* 탭 */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div
          role="group"
          aria-label="관리자 화면 섹션 선택"
          className="dark:bg-background-dark-secondary/60 bg-background-tertiary inline-flex h-9 items-center rounded-md p-1 text-sm"
        >
          {TABS.map((t) => (
            <TabButton
              key={t.key}
              label={t.label}
              active={tab === t.key}
              onClick={() => setTab(t.key)}
            />
          ))}
        </div>
      </div>

      {tab === "thresholds" && <ThresholdSection />}
      {tab === "logs" && <AlertLogSection />}
      {tab === "users" && <UserSection />}
    </main>
  );
}

/* ---------------- 섹션: 알림 임계값 ---------------- */

function ThresholdSection() {
  const enabledCount = MOCK_ALERT_THRESHOLDS.filter((t) => t.enabled).length;

  return (
    <Section
      title="알림 임계값"
      description="측정 항목별 알림 발송 범위입니다. 현재는 읽기 전용입니다."
      table="alert_settings"
      meta={`사용중 ${enabledCount} / 전체 ${MOCK_ALERT_THRESHOLDS.length}`}
    >
      <TableWrap>
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <THead>
            <tr>
              <Th>항목</Th>
              <Th>설명</Th>
              <Th className="text-right">최소값</Th>
              <Th className="text-right">최대값</Th>
              <Th className="text-right">사용여부</Th>
            </tr>
          </THead>
          <tbody>
            {MOCK_ALERT_THRESHOLDS.map((t) => (
              <Tr key={t.key}>
                <Td className="text-text-major dark:text-text-dark-primary font-semibold">
                  {t.key}
                </Td>
                <Td className="text-text-secondary dark:text-text-dark-primary/70">
                  {t.label}
                  {t.unit ? (
                    <span className="text-text-secondary/70 dark:text-text-dark-primary/50 ml-1 text-xs">
                      ({t.unit})
                    </span>
                  ) : null}
                </Td>
                <Td
                  className={[
                    "text-right tabular-nums",
                    t.enabled
                      ? "text-text-major dark:text-text-dark-primary/90 font-medium"
                      : "text-text-secondary dark:text-text-dark-primary/60",
                  ].join(" ")}
                >
                  {t.min}
                </Td>
                <Td
                  className={[
                    "text-right tabular-nums",
                    t.enabled
                      ? "text-text-major dark:text-text-dark-primary/90 font-medium"
                      : "text-text-secondary dark:text-text-dark-primary/60",
                  ].join(" ")}
                >
                  {t.max}
                </Td>
                <Td className="text-right">
                  <UsageBadge enabled={t.enabled} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </Section>
  );
}

/* ---------------- 섹션: 알림 발송 이력 ---------------- */

function AlertLogSection() {
  return (
    <Section
      title="알림 발송 이력"
      description="최근에 발송된 알림입니다. 최신순으로 정렬되어 있습니다."
      table="alert_log"
      meta={`최근 ${MOCK_ALERT_LOGS.length}건`}
    >
      <TableWrap>
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <THead>
            <tr>
              <Th>병원명</Th>
              <Th>유형</Th>
              <Th>메시지</Th>
              <Th className="text-right">트리거값</Th>
              <Th className="text-right">발송시각</Th>
            </tr>
          </THead>
          <tbody>
            {MOCK_ALERT_LOGS.map((row) => (
              <Tr key={row.id}>
                <Td className="text-text-major dark:text-text-dark-primary font-medium">
                  {row.site}
                </Td>
                <Td>
                  <KindBadge kind={row.kind} />
                </Td>
                <Td
                  wrap
                  className="text-text-secondary dark:text-text-dark-primary/70"
                >
                  <span className="block max-w-[420px] leading-relaxed">
                    {row.message}
                    <span className="text-text-secondary/70 dark:text-text-dark-primary/50 ml-1.5 text-xs">
                      · {row.metric}
                    </span>
                  </span>
                </Td>
                <Td className="text-text-major dark:text-text-dark-primary/90 text-right font-semibold tabular-nums">
                  {row.triggeredValue}
                </Td>
                <Td className="text-text-secondary dark:text-text-dark-primary/70 text-right tabular-nums">
                  {formatIsoDateTime(row.sentAt)}
                </Td>
              </Tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </Section>
  );
}

/* ---------------- 섹션: 사용자 목록 ---------------- */

function UserSection() {
  return (
    <Section
      title="사용자 목록"
      description="로그인 계정 목록입니다. 비밀번호는 어떤 경우에도 표시하지 않습니다."
      table="users"
      meta={`총 ${MOCK_USERS_ROWS.length}명`}
    >
      <TableWrap>
        <table className="w-full min-w-[420px] border-collapse text-sm">
          <THead>
            <tr>
              <Th>아이디</Th>
              <Th>권한</Th>
              <Th className="text-right">생성일</Th>
            </tr>
          </THead>
          <tbody>
            {MOCK_USERS_ROWS.map((u) => (
              <Tr key={u.id}>
                <Td className="text-text-major dark:text-text-dark-primary font-medium">
                  {u.username}
                </Td>
                <Td>
                  <RoleBadge admin={u.role === "admin"}>
                    {USER_ROLE_LABEL[u.role]}
                  </RoleBadge>
                </Td>
                <Td className="text-text-secondary dark:text-text-dark-primary/70 text-right tabular-nums">
                  {formatIsoDate(u.createdAt)}
                </Td>
              </Tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </Section>
  );
}

/* ---------------- 접근 제한 ---------------- */

function AccessDenied({ hasSession }: { hasSession: boolean }) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-5 lg:px-8 lg:py-8">
      <div className="dark:border-background-dark-secondary dark:bg-background-dark-card mx-auto max-w-md rounded-lg border bg-white p-6 text-center shadow-[0_1px_2px_0_rgb(0_0_0_/_0.03)]">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
          <LockIcon className="h-5 w-5" />
        </div>

        <h1 className="text-text-major dark:text-text-dark-primary mt-4 text-lg font-semibold tracking-tight">
          접근 권한이 없습니다
        </h1>

        <p className="text-text-secondary dark:text-text-dark-primary/60 mt-2 text-sm leading-relaxed">
          {hasSession
            ? "관리자 계정으로 로그인해야 이 화면을 볼 수 있습니다. 다른 계정으로 다시 로그인해 주세요."
            : "이 화면은 관리자 전용입니다. 먼저 로그인해 주세요."}
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/login?next=/admin"
            className="bg-button-primary hover:bg-button-primary-hover inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold text-white transition-colors dark:text-white"
          >
            로그인하러 가기
          </Link>
          <Link
            href="/"
            className="text-text-secondary hover:bg-background-tertiary hover:text-text-major dark:border-background-dark-secondary dark:text-text-dark-primary/70 dark:hover:bg-background-dark-secondary dark:hover:text-text-dark-primary inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium transition-colors"
          >
            대시보드로
          </Link>
        </div>
      </div>
    </main>
  );
}

/* ---------------- 공통 UI ---------------- */

function Section({
  title,
  description,
  table,
  meta,
  children,
}: {
  title: string;
  description: string;
  table: string;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dark:border-background-dark-secondary dark:bg-background-dark-card rounded-lg border bg-white shadow-[0_1px_2px_0_rgb(0_0_0_/_0.03)]">
      <div className="dark:border-background-dark-secondary flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-text-major dark:text-text-dark-primary text-[15px] font-semibold tracking-tight">
              {title}
            </h2>
            <TableTag table={table} />
          </div>
          <p className="text-text-secondary dark:text-text-dark-primary/60 mt-1 text-xs leading-relaxed">
            {description}
          </p>
        </div>
        <span className="text-text-secondary dark:text-text-dark-primary/60 shrink-0 text-xs font-medium tabular-nums">
          {meta}
        </span>
      </div>

      {children}
    </section>
  );
}

/** 나중에 실제 연동할 때 참고할 원본 테이블명 */
function TableTag({ table }: { table: string }) {
  return (
    <span className="text-text-secondary/80 dark:bg-background-dark-secondary/60 dark:text-text-dark-primary/50 bg-background-tertiary rounded px-1.5 py-0.5 font-mono text-[10px] font-medium">
      {table}
    </span>
  );
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto overscroll-x-contain rounded-b-lg">
      {children}
    </div>
  );
}

function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="dark:border-background-dark-secondary dark:bg-background-dark-secondary/40 dark:text-text-dark-primary/70 bg-background-primary/60 text-text-secondary border-b">
      {children}
    </thead>
  );
}

function Tr({ children }: { children: React.ReactNode }) {
  return (
    <tr className="dark:border-background-dark-secondary dark:hover:bg-background-dark-secondary/30 hover:bg-background-primary/40 border-b transition-colors last:border-b-0">
      {children}
    </tr>
  );
}

function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={[
        "px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide whitespace-nowrap uppercase",
        className,
      ].join(" ")}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  wrap = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** 긴 문장 셀에서 줄바꿈을 허용합니다. (기본은 한 줄 고정) */
  wrap?: boolean;
}) {
  return (
    <td
      className={[
        "px-4 py-3",
        wrap ? "whitespace-normal" : "whitespace-nowrap",
        className,
      ].join(" ")}
    >
      {children}
    </td>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex h-7 cursor-pointer items-center justify-center rounded px-3 text-xs font-semibold transition-all",
        active
          ? "dark:bg-background-dark-card dark:text-text-dark-primary text-text-major bg-white shadow-sm"
          : "text-text-secondary hover:text-text-major dark:text-text-dark-primary/60 dark:hover:text-text-dark-primary",
      ].join(" ")}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function MockBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
      {/* 점 자체에 ping 을 걸면 주기마다 사라지므로, 잔상 레이어를 따로 둡니다. */}
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
      </span>
      목업 데이터
    </span>
  );
}

function UsageBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        enabled
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
      ].join(" ")}
    >
      <span
        className={[
          "h-1.5 w-1.5 rounded-full",
          enabled ? "bg-emerald-500" : "bg-slate-400",
        ].join(" ")}
      />
      {enabled ? "사용중" : "미사용"}
    </span>
  );
}

function KindBadge({ kind }: { kind: AlertLogKind }) {
  const cls =
    kind === "critical"
      ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
      : kind === "warning"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";

  const dotCls =
    kind === "critical"
      ? "bg-red-500"
      : kind === "warning"
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <span
      className={[
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        cls,
      ].join(" ")}
    >
      <span className={["h-1.5 w-1.5 rounded-full", dotCls].join(" ")} />
      {ALERT_KIND_LABEL[kind]}
    </span>
  );
}

function RoleBadge({
  admin,
  children,
}: {
  admin: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        admin
          ? "bg-brand-primary/10 text-brand-primary dark:bg-brand-dark-primary/20 dark:text-brand-dark-primary"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function LockIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect
        x="4"
        y="10"
        width="16"
        height="10"
        rx="2"
      />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
