# PENTA WORKS Helium Monitoring Dashboard

MRI 장비의 헬륨 가스 압력(He Pressure)과 잔량(He Level)을 모니터링하기 위한 웹 대시보드 애플리케이션입니다. 각 병원(사이트)의 장비 상태를 실시간에 가깝게 확인하고, 문제가 발생한 장비를 빠르게 식별할 수 있습니다.

대부분 모바일 웹뷰 환경에서 사용되는 점을 고려해 모바일 우선(Mobile-first) 디자인으로 구성되어 있으며, 연령대가 있는 사용자도 쉽게 볼 수 있도록 가독성을 중시했습니다. 전반적인 UI는 shadcn/ui 스타일의 미니멀한 룩앤필을 따릅니다.

## 주요 기능

### 1. 전체 장비 대시보드 (`/`)

- **실시간 상태 모니터링**: 등록된 전체 MRI 장비의 현재 상태를 한눈에 파악할 수 있습니다.
- **최근 업데이트 시간 표시**: API 호출 시점을 기준으로 데이터가 얼마나 최신인지 확인할 수 있습니다.
- **요약 카드**: 상단에 "전체 / 정상(1시간) / 미수집(24시간)" 요약 카드를 배치해 전체 현황을 한눈에 확인할 수 있습니다.
- **반응형 UI 지원**:
  - 데스크탑: 한눈에 보기 편한 테이블(Table) 형태 제공
  - 모바일: 모바일에 최적화된 카드(Card) 형태 제공 (카드 전체가 링크로 동작)
- **상태 뱃지(Status Badge)**:
  - `정상`: 최근 1시간 이내 데이터 수신됨
  - `주의`: 최근 24시간 이내 수신되었으나 1시간은 경과함
  - `비활성 / 미수집`: 24시간 이상 데이터 수신 없음
- **이상 수치 하이라이트**: 설정된 허용 범위(Control Range)를 벗어난 압력(psi)이나 잔량(%) 수치는 붉은색으로 강조 표시되며, 해당 사이트 카드의 테두리도 함께 강조됩니다.

### 2. 사이트 상세 모니터링 (`/sites/[slug]`)

- **시계열 차트 제공**: 선택한 특정 장비의 헬륨 압력과 잔량 변화 추이를 시계열 꺾은선 그래프(Time Series Line Chart)로 제공합니다.
- **모바일 스크롤 최적화**: 모바일 환경에서 차트를 터치했을 때 화면 스크롤이 막히는 현상을 방지하기 위해 터치 인터랙션을 비활성화(`NoTouchChart` 래퍼 사용)하여 쾌적한 스크롤 경험을 제공합니다.
- **데이터 조회 건수 조절**: 세그먼트 컨트롤(Tabs) 형태로 최근 10건, 20건, 50건, 100건 단위 데이터를 전환할 수 있습니다.

### 3. 병원별 기준값 조회 (`/baselines`)

- **기준값 일람**: 슬랙 알림 기준이 되는 각 병원의 `hePsi` 기준값(BASELINE_MAP)과 허용범위(±20%)를 확인할 수 있는 전용 페이지입니다.
- **병원명 검색**: 상단 검색창으로 병원명을 빠르게 필터링할 수 있습니다.
- **반응형 UI**:
  - 데스크탑: 정렬된 테이블 뷰
  - 모바일: 최소/최대 범위 시각화 바가 포함된 카드 리스트

### 4. 이상 감지 및 슬랙 알림 (`/api/monitor`)

- **cron 기반 모니터링**: 인증 헤더(`Bearer CRON_SECRET`)가 포함된 요청에 한해 실행되며, 전체 사이트의 `hePsi` 값을 조회하여 기준값 대비 ±20% 허용범위를 벗어난 병원을 탐지합니다.
- **Slack Block Kit 메시지**: 가독성을 높이기 위해 header / context / section(fields) / divider 로 구성된 Block Kit 메시지를 사용합니다.
- **편차 방향 및 비율 자동 계산**: 각 이상 병원에 대해 `▲/▼` 방향 표시와 기준값 대비 편차(%)를 함께 안내합니다.
- **fallback text 지원**: Slack 클라이언트가 블록을 렌더링하지 못할 때를 대비한 텍스트 요약도 함께 전송합니다.

## 기술 스택

- **Framework**: Next.js 15 (App Router, React Server Components)
- **UI**: Tailwind CSS 4, shadcn/ui 스타일 룩앤필
- **Data**: @tanstack/react-query, Prisma (MariaDB)
- **Charts**: Chart.js + react-chartjs-2 + chartjs-plugin-zoom
- **Notification**: Slack Incoming Webhook (Block Kit)

## 주요 컴포넌트 구조

- **`DashboardClient`** (`src/components/dashboard/dashboard-client.tsx`): 메인 대시보드 페이지. `/api/dashboard`에서 전체 사이트 목록과 메타데이터, 컨트롤 범위(ctrl)를 가져와 요약 카드 · 테이블 · 카드 리스트를 렌더링합니다.
- **`SiteDetailClient`** (`src/components/site/site-detail-client.tsx`): 개별 사이트 상세 페이지. `/api/sites/[slug]`에서 특정 사이트의 최근 데이터를 가져와 차트를 렌더링합니다.
- **`BaselinesClient`** (`src/components/baselines/baselines-client.tsx`): 병원별 기준값 조회 페이지. 공유 상수 `BASELINE_MAP`을 기반으로 테이블/카드 뷰를 렌더링합니다.
- **`SiteSearchModal`** (`src/components/common/site-search-modal.tsx`): 커맨드 팔레트 스타일의 사이트 검색 모달.
- **`Navbar`** (`src/components/common/navbar.tsx`): 브랜드 그라디언트 배경의 글로벌 헤더. 로고(`/favicon/android-chrome-192x192.png`)와 기준값 / 검색 / 테마 토글을 포함합니다.

## 공유 상수

- **`src/lib/baseline-map.ts`**
  - `BASELINE_MAP`: 병원명 → hePsi 기준값 매핑
  - `BASELINE_TOLERANCE`: 허용범위 비율 (기본 `0.2`, ±20%)
  - `getBaselineEntries()`: 페이지 렌더링용 배열 변환 헬퍼
  - `getBaselineRange(baseline)`: 기준값 기반 min/max 반환

`/api/monitor`와 `/baselines` 페이지가 동일한 상수를 공유하므로, 기준값 수정 시 한 곳만 변경하면 알림과 조회 화면 양쪽에 반영됩니다.

## 환경 변수

| 변수                  | 설명                                                  |
| --------------------- | ----------------------------------------------------- |
| `CRON_SECRET`         | `/api/monitor` 호출 시 필요한 Bearer 토큰             |
| `SLACK_WEBHOOK_URL`   | 이상 감지 시 알림을 발송할 Slack Incoming Webhook URL |
| `NEXT_PUBLIC_API_URL` | `https` 포함 여부로 DEV 배지 노출을 제어              |

## 시작하기

```bash
# 의존성 설치
pnpm install

# 개발 서버 실행
pnpm run dev

# 프로덕션 빌드
pnpm run build
pnpm start
```

## cron 예시

응답 예시:

```json
{
  "ok": true,
  "count": 2,
  "alerts": [
    {
      "name": "연세고든",
      "current": 4.5,
      "baseline": 3.4,
      "min": 2.72,
      "max": 4.08,
      "diffPct": 32.3,
      "direction": "high"
    }
  ]
}
```
