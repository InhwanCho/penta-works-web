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

로그인 DB가 확정되기 전까지 대시보드, 사이트 목록·상세, 알림 기준값 조회 API는 인증 없이 읽을 수 있습니다. 쓰기·관리자 API는 계속 JWT 권한을 검사하고 모니터 호출은 CRON_SECRET 검증을 유지합니다. 로그인 연결 시 공개된 읽기 경로도 다시 인증 대상으로 전환해야 합니다. JWT_SECRET은 최소 32바이트의 무작위 값으로 설정해야 하며 예시 값은 사용할 수 없습니다. 변경 후 프론트와 백엔드를 함께 배포하세요.

검증: Java 17 이상에서 `cd backend && ./gradlew test`, 프론트에서 `pnpm lint`, `pnpm build`, `pnpm audit --prod`.

남은 보안 개선: 기존 users.password의 단순 SHA-256 해시는 DB 컬럼 길이 및 공유 인증 시스템을 확인한 뒤 bcrypt/Argon2로 마이그레이션해야 합니다. 현재 브라우저 토큰은 localStorage에 저장되므로 HttpOnly 쿠키로 전환하려면 CSRF 방어와 교차 출처 배포 설정을 함께 설계해야 합니다. 로그인 시도 제한도 운영 프록시 또는 공유 저장소 기반으로 추가해야 합니다.
