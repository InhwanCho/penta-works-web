# PENTA WORKS

모니터링 서비스의 프론트엔드와 Java 백엔드를 한 저장소에서 관리합니다.

```text
frontend/  Next.js UI — Java API만 호출
backend/   Spring Boot REST API — MariaDB 접근
```

## Local development

1. 루트의 `.env.example`을 복사해 `.env`를 만들고 실제 시크릿을 채웁니다.
2. 백엔드: `cd backend && ./gradlew bootRun`
3. 프론트: `cd frontend && pnpm install && pnpm dev`

프론트의 `NEXT_PUBLIC_API_BASE_URL`은 기본적으로 `http://localhost:8080/api/v1`입니다.

## Container deployment

`docker compose up -d --build`로 MariaDB, backend, frontend를 함께 실행합니다.
MariaDB 데이터는 기존 `homepage_mariadb_data` Docker 볼륨을 그대로 사용하도록 구성되어 있습니다. 현재 서버에는 같은 DB 컨테이너가 독립 실행 중이므로, 실제 첫 Compose 배포 시에는 그 컨테이너를 Compose로 전환하는 짧은 점검 작업이 필요합니다.

## Jenkins deployment

GitHub의 `https://ci.pentaworks.net/github-webhook/` 웹훅 한 개가 다음 두 Jenkins Pipeline을 트리거합니다. 각 잡은 자신이 추적하는 브랜치에 새 커밋이 있을 때만 배포합니다.

MReyes→Office 읽기 전용 연동은 Jenkins Secret Text 자격증 `mreyes-office-api-key`를 사용합니다. dev·prod 배포 시 같은 값을 각 환경파일의 `OFFICE_API_KEY`로 저장하고, 해당 키는 브라우저에 전달하지 않습니다.
MReyes 브라우저는 로그인 JWT로 `GET /api/v1/sites/{siteId}/office-assets`를 호출하고, MReyes 백엔드가 서버 내부에서만 Office API 키를 첨부합니다.
로그인은 이메일을 ID로 사용합니다. Access Token은 기본 30일, HttpOnly Refresh Token은 기본 365일이며 앱을 다시 열거나 Access Token이 만료될 때 기기의 Refresh Token을 유지하면서 DB·쿠키의 만료 기간을 연장합니다. 응답 유실 후 오래 오프라인이거나 배포로 프로세스가 바뀌어도 같은 기기 토큰으로 복구합니다. 토큰은 DB에 SHA-256 해시만 저장하며 만료·폐기·계정 정지는 계속 검사합니다. JWT_SECRET은 배포 사이에 유지해야 합니다. 비밀번호는 BCrypt(12 rounds)로 저장합니다.
정비 사진은 Office API 키가 브라우저에 노출되지 않도록 MReyes 백엔드가 중계하며, 사이트 상세 화면에서 기기 폭에 맞춘 반응형 썸네일로 표시합니다.

| Jenkins job | Branch | Compose project | Access |
| --- | --- | --- | --- |
| `pentaworks-dev` | `dev` | `pentaworks` | `http://192.168.0.210:3000` |
| `pentaworks-prod` | `main` | `pentaworks-prod` | `https://app.pentaworks.net` |

개발 환경은 `docker-compose.yml`과 `/home/inhwan/pentaworks-secrets/.env`를 사용합니다. 운영 환경은 `docker-compose.prod.yml`과 `/home/inhwan/pentaworks-secrets/prod.env`를 사용합니다. 같은 MariaDB 인스턴스를 사용하되 개발은 `pentaworks_mreyes_dev`, 운영은 `pentaworks_mri_db` 스키마와 별도 DB 계정으로 분리합니다.

운영 컨테이너는 호스트의 loopback 포트 `3100`(frontend), `8180`(backend)에만 바인딩됩니다. Nginx 설정은 `deploy/nginx/app.pentaworks.net.conf`에 있으며, 회사 홈페이지가 준비되기 전까지 `pentaworks.net`은 운영 앱으로 임시 리다이렉트됩니다.

운영 컨테이너의 첫 배포가 성공한 뒤 서버에서 아래 명령을 한 번 실행하면 Cloudflare DNS 인증서 발급과 Nginx 사이트 설정이 완료됩니다.

```bash
sudo bash /home/inhwan/apps/pentaworks-prod/deploy/setup-production-origin.sh
```

운영 전환 시에는 별도의 MariaDB 인스턴스와 볼륨을 만들고 `docker-compose.prod.yml`의 `DB_URL` 및 네트워크 구성을 분리해야 합니다.

## Security and verification

대시보드, 사이트 목록·상세, 알림 기준값을 포함한 애플리케이션 API는 로그인이 필요합니다. 모니터 호출은 CRON_SECRET 검증을 유지합니다. JWT_SECRET은 최소 32바이트의 무작위 값으로 설정해야 하며 예시 값은 사용할 수 없습니다. 변경 후 프론트와 백엔드를 함께 배포하세요.

검증: Java 17 이상에서 `cd backend && ./gradlew test`, 프론트에서 `pnpm lint`, `pnpm build`, `pnpm audit --prod`.

Access Token은 빠른 첫 화면 표시를 위해 브라우저 저장소에 유지하고, 장기 로그인용 Refresh Token만 Secure·HttpOnly·SameSite 쿠키에 저장합니다. 로그인 실패가 5회 누적되면 계정을 15분간 잠급니다.

앱 시작 시 Access Token이 5분 이내에 만료될 때만 Refresh Token을 갱신합니다. 서버 재시작·네트워크 오류는 세션을 삭제하지 않고 10초 후 또는 네트워크 재연결 시 복구를 재시도합니다. 인증 요청에는 15초 제한을 두며 연결 실패 화면에서 수동 재연결할 수 있습니다. 로그인·갱신·로그아웃은 순차 처리하고 Web Locks를 지원하는 브라우저는 탭 간에도 직렬화합니다. 기본 로그아웃은 현재 기기만 종료하며 내 계정에서 다른 기기·모든 기기를 종료할 수 있습니다. 명시적인 세션 만료 응답은 기존대로 로그아웃 처리합니다.

대시보드는 모바일·데스크톱 모두 전체 표로 표시합니다. 모바일의 알림값 확인은 필터에서 접근합니다.

로그인 화면의 비밀번호 찾기에서 재설정 메일을 요청할 수 있습니다. 가입 여부·계정 상태·요청 제한 여부와 관계없이 동일한 응답을 반환하며, 이메일별 요청은 1분 간격 및 시간당 3회로 제한합니다. 토큰은 1시간 유효하고 비밀번호 재설정 시 다른 미사용 재설정 링크와 로그인 세션을 폐기합니다. 메일 전송에는 기존 계정 메일 설정이 필요합니다.

사용자 관리의 측정항목 탭에서 회사 최고관리자가 회사별 표시 이름·단위·순서·표시 여부를 설정합니다. 대시보드와 상세 차트에 적용되며, 단위 표시는 수치 변환을 수행하지 않습니다. 측정항목 숨김은 화면 표시 설정이며 사업장 숨김과 달리 알림을 중지하지 않습니다.

알림 이력은 미발송 사유와 수신처별 결과를 표시합니다. 일부 실패 시 성공한 수신처는 재전송 대상에서 제외하며, 응답을 확인할 수 없는 결과는 관리자가 수신 여부를 확인한 후 처리합니다. 전역 Slack 수신처 대체는 펜타웍스 소유 사업장에만 적용됩니다. 새 알림은 발생 당시 기준 범위를 보존하며, 이전 이력에 저장되지 않은 과거 기준은 알 수 없는 값으로 표시합니다.

최고관리자와 관리자는 관리자 화면에서 사용자를 초대하고 계정 상태 및 사업장 접근 범위를 관리합니다. 초대 링크는 7일, 비밀번호 초기화 링크는 1시간 동안 유효하며 사용자가 직접 비밀번호를 설정합니다. 일반 사용자는 배정된 사업장의 대시보드, 상세 데이터, 기준값 및 Office 자산만 조회할 수 있고 계정·권한·비밀번호 변경은 감사 로그에 기록됩니다.

사용자 관리에서는 이름·이메일·전화번호 수정, 권한·상태·사업장 배정, 검색·필터·페이지 이동, 초대 재발송과 계정 삭제를 지원합니다. 최고관리자는 초대로 추가하고 다른 최고관리자가 삭제할 수 있지만, 권한 이전·기존 계정의 최고관리자 승격·본인 삭제·마지막 최고관리자 삭제는 허용하지 않습니다. 삭제 계정은 로그인과 세션을 즉시 차단하고 감사 이력을 보존하도록 익명화합니다.

대시보드는 진행 중인 기준 이탈과 데이터 수신 중단을 우선 표시합니다. 알림 관리에서는 사업장별 전체 사용 여부, 이상 지속 시간, 반복 주기, 야간·주말·지정 휴일 발송 제외를 설정할 수 있으며, 알림 이력 검색·필터·일괄 확인과 실패 건 수동 재전송을 지원합니다. 알림 전송 채널 구현은 현재 Slack Webhook을 유지합니다.

운영 백엔드는 1분마다 활성 알림을 평가합니다(`MONITOR_INTERVAL_MS`, 기본 60000). 개발 백엔드는 같은 DB의 중복 알림을 막기 위해 이 내부 평가가 기본 비활성화됩니다. 평균 기준은 웹 DB의 최근 24시간 측정값에서 미측정 값 `0`, `0.001`, `0.01`을 제외해 매 정시와 백엔드 시작 시 저장합니다. 사업장·항목별로 평균 사용과 허용편차(기본 ±50%)를 선택할 수 있습니다. 유효 표본 12개 미만, 마지막 유효값 2시간 초과, 계산 지연 시 기존 고정 범위로 돌아갑니다. 미측정 값은 화면에 "측정 안됨"으로 표시하고 범위 이탈 알림 평가에서도 제외합니다. 원본 `mrtb` 값은 그대로 보존합니다.

### 개인 보기와 업데이트

모바일 알림 관리 진입은 대시보드 ‘필터’에 있습니다. 표시할 열은 이 브라우저에 계정별로 저장되며 회사 공통 설정을 변경하지 않습니다. 알림 이력은 `/alerts/events/search`에서 사용자·허용 병원 범위를 검사하고 검색·기간·종류·발송 상태별로 페이지 조회합니다. ‘현재 페이지 모두 확인’은 화면에 보이는 알림만 처리합니다.

PWA 업데이트는 새 파일 준비가 끝나면 자동 적용하고 저장된 로그인 상태로 화면을 다시 엽니다. 모바일 및 폴드 화면(1024px 미만)의 필터는 화면 오른쪽 작은 탭으로만 열 수 있습니다. 이전 버전의 정적 캐시 1개를 남겨 열린 탭의 파일 요청을 지원합니다.

실제 DB 회귀 검증은 기본 실행에서 제외됩니다. 운영 DB에는 연결하지 않으며, 별도의 `mreyes_auth_qa` MariaDB를 `127.0.0.1:13316`으로 연결한 뒤 `MREYES_QA_DATABASE=true ./gradlew test`로 실행합니다. 해당 검증은 고정된 QA 스키마의 테스트 테이블을 재생성합니다.

2026-10-12 V32에서 기존 병원·개인 설정과 아직 적용하지 않은 공유 패턴의 허용편차를 모두 50%로 일괄 변경합니다. 평균 사용 여부·수동 범위·활성화·알림 시간 등 나머지 설정은 유지합니다. 적용된 공유 패턴의 과거 스냅샷은 기록으로 보존합니다.

헬륨 압력(hepres) 항목 누락은 기본 켜짐·연속 5회입니다. 실제 데이터가 수신되면서 해당 수치만 누락된 기록을 세며, 전체 수집 중단·중복 수신·수집 간격의 공백은 항목 누락 횟수로 누적하지 않습니다. V33에서 기존 기본3회/미설정 헬륨 압력도 켜짐·5회로 전환하며 별도로 지정한 횟수와 다른 알림 설정은 유지합니다.

## Development employee workspace (dev branch)

The dev branch has the employee workspace: Today `/`, existing monitoring `/monitoring`, hospitals `/hospitals`, work records `/work`, and schedules `/schedule`. Work type is chosen inside `/work/new`. Workshop repairs, manuals, accounting, and HR remain in Intranet. V38 adds company-scoped work records and schedules; authors and company admins can change their own company's records, subject to hospital access.

Development uses the separate `pentaworks_mreyes_dev` schema and `mreyes_dev` database user. Set `DEV_DB_URL`, `DEV_DB_USERNAME`, `DEV_DB_PASSWORD` in the development env before deployment. Development deployment refuses a non-isolated DB and replaces only frontend/backend containers. The database infrastructure container and production application are left running. Development snapshots do not receive live measurement synchronization.

Development frontend API URL is `/api/v1` (same-origin proxy), so both `http://192.168.0.210:3000` and `http://100.111.148.7:3000` work. Mail and Kakao senders, monitoring scheduler, cron evaluation and MRTB sync are explicitly disabled in development Compose. Monitoring can display the copied data and settings, but external messages are not sent. Development JWT secret and sessions are separate from production. Existing Office assets integration remains read-only.

The development work editor now includes PM/ACR/repair/Cold Head/Call/general-work sections, radio choices and authenticated photo attachments (20 MiB/file, 40 photos, 200 MiB/record). Monitoring is `/`; 업무 현황 is `/overview`. Existing historical hospital records and photos remain available through the read-only Office integration. See `docs/handovers/2026-10-16-service-workspace-update.md`.
