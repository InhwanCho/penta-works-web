# 대시보드 컬럼 및 콜드칠러 정지 의심

## 구현
- 관리자 > 측정항목에서 병원명 외 모든 컬럼 이름·순서·표시 설정. 회사 전체 적용.
- 최신 시각/1시간 건수/24시간 건수를 설정 대상으로 확장.
- 기본 순서: hepres, heleve, gctemp, cctemp(IN), ccflow(OUT), actemp, achumi, lastAt, count1h, count24h, recosi, recoru, coldtp. gcflow는 기본 숨김.
- AC = 항온항습기. ccflow는 유량이 아닌 OUT 온도(°C). 상세 온도 차트에도 포함.
- 640~1023px 표 간격·병원명 너비·상단 헤더를 컴팩트하게 조정.
- 알림 상세 항목 필터의 sticky를 제거.
- 병원별 `coldChillerActive` 토글 추가. 기본 FALSE, 명시적으로 켜야 발송.
- 유효한 IN/OUT 값의 정확한 숫자 동등성(반올림 없음)을 감지. 0/0.001/0.01/null/비유한 값 제외.
- 별도 사건 키 `__cold_chiller__`. 기존 감지 지연·반복·제외 시간·수신자·개별 확인완료·SMS 대체·도착결과 흐름 재사용. 불일치하면 정상 종료, 이후 일치 시 새 사건.

## 검증
- Java 17 전체 테스트, 프론트 lint/typecheck/build.
- 로컬 전용 API(외부 발송 없음) + Chrome 390/820/1280px 화면 확인.
- 컬럼 이름·순서 저장 및 대시보드 반영 확인.
- 모바일 알림 상세 필터 position=static, 스크롤 시 화면 위로 벗어남 확인.
- MariaDB 검증용 테이블에 V22 적용 성공. 레거시 순서 변환 및 커스텀 sort_order=42 보존 확인. 검증 DB 삭제.

## 운영 상태와 배포
- 이 변경은 미커밋·미배포 상태. 운영은 직전 d90901e / V21.
- V22 마이그레이션을 백엔드·프론트 변경과 함께 배포해야 함.
- 운영 병원에 콜드칠러 토글을 일괄 활성화하지 않음. 실제 발송 테스트 없음.
- intranet 운영 컨테이너와 office 공개 HTTP 200 확인. MrEyes의 OFFICE_INTEGRATION_ENABLED=true, MRTB_SYNC_ENABLED=true, 동기화 설정 10000ms.
- 측정값은 별도 원본 DB에서 mrtb index 커서로 증분 동기화. intranet 정비 데이터와 별개.
- MrEyes 병원 상세 -> JWT 병원 접근권한 확인 -> 서버 전용 API 키 -> intranet `mreyes_site_id` 연결 병원/장비/부품/정비이력/사진 GET.
- 경보에서 intranet 정비요청을 자동 생성하는 연결은 없음. POS 서버 접근/변경 없음.
