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
