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

MREyes→Office 읽기 전용 연동은 Jenkins Secret Text 자격증 `mreyes-office-api-key`를 사용합니다. dev·prod 배포 시 같은 값을 각 환경파일의 `OFFICE_API_KEY`로 저장하고, 해당 키는 브라우저에 전달하지 않습니다.
MREyes 브라우저는 로그인 JWT로 `GET /api/v1/sites/{siteId}/office-assets`를 호출하고, MREyes 백엔드가 서버 내부에서만 Office API 키를 첨부합니다.
로그인은 이메일을 ID로 사용합니다. Access Token은 기본 30일, HttpOnly Refresh Token은 기본 365일이며 앱을 다시 열거나 Access Token이 만료될 때 Refresh Token을 회전하면서 로그인 상태를 연장합니다. 비밀번호는 BCrypt(12 rounds)로 저장합니다.
정비 사진은 Office API 키가 브라우저에 노출되지 않도록 MREyes 백엔드가 중계하며, 사이트 상세 화면에서 기기 폭에 맞춘 반응형 썸네일로 표시합니다.

| Jenkins job | Branch | Compose project | Access |
| --- | --- | --- | --- |
| `pentaworks-dev` | `dev` | `pentaworks` | `http://192.168.0.210:3000` |
| `pentaworks-prod` | `main` | `pentaworks-prod` | `https://app.pentaworks.net` |

개발 환경은 `docker-compose.yml`과 `/home/inhwan/pentaworks-secrets/.env`를 사용합니다. 운영 환경은 `docker-compose.prod.yml`과 `/home/inhwan/pentaworks-secrets/prod.env`를 사용하며, 프로토타입 기간에는 개발 환경의 `pentaworks_default` Docker 네트워크를 통해 같은 MariaDB를 공유합니다.

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

최고관리자와 관리자는 관리자 화면에서 사용자를 초대하고 계정 상태 및 사업장 접근 범위를 관리합니다. 초대 링크는 7일, 비밀번호 초기화 링크는 1시간 동안 유효하며 사용자가 직접 비밀번호를 설정합니다. 일반 사용자는 배정된 사업장의 대시보드, 상세 데이터, 기준값 및 Office 자산만 조회할 수 있고 계정·권한·비밀번호 변경은 감사 로그에 기록됩니다.
