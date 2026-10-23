import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "서비스 소개",
  description:
    "병원 장비 모니터링부터 업무기록, 점검과 팀 일정까지. MReyes로 현장 업무를 한곳에서 관리하세요.",
  alternates: { canonical: "/about" },
};
const features = [
  [
    "01",
    "장비 모니터링",
    "병원별 측정값과 수집 상태를 한 화면에서 확인하고, 변화는 그래프로 살펴보세요.",
  ],
  [
    "02",
    "알림 관리",
    "병원과 항목별 알림 기준을 설정하고, 도착한 알림과 처리 기록을 확인하세요.",
  ],
  [
    "03",
    "업무기록",
    "현장의 증상과 조치 내용, 교체 부품과 사진을 기록해 다음 방문에 활용하세요.",
  ],
  [
    "04",
    "점검 관리",
    "병원별 점검 주기와 지정일을 관리하고, 다가오는 점검 기한을 확인하세요.",
  ],
  [
    "05",
    "팀 일정",
    "방문과 점검, 휴가 일정을 업무기록과 함께 달력에서 확인하세요.",
  ],
  [
    "06",
    "구글캘린더 연동",
    "원하는 계정에 업무 일정을 반영해, 평소 사용하는 캘린더에서도 확인하세요.",
  ],
];
export default function AboutPage() {
  return (
    <div className="service-about">
      <main>
        <section className="service-hero service-container">
          <p className="service-eyebrow">MReyes · 엠알아이즈</p>
          <h1>
            장비를 살피고,
            <br />
            현장의 업무를 잇다.
          </h1>
          <p className="service-lead">
            병원 장비의 상태부터 업무기록과 팀 일정까지.
            <br />
            흩어져 있던 현장 업무를 한곳에서 관리하세요.
          </p>
          <a
            className="service-button"
            href="#service-screens"
          >
            실제 화면 살펴보기 <span aria-hidden="true">↓</span>
          </a>
          <div className="service-hero-image">
            <div
              className="service-window-bar"
              aria-hidden="true"
            >
              <i />
              <i />
              <i />
              <span>MReyes · 모니터링</span>
            </div>
            <picture>
              <source
                media="(max-width: 767px)"
                srcSet="/images/about/monitoring-mobile.jpg"
                width={390}
                height={844}
              />
              <Image
                src="/images/about/monitoring.jpg"
                alt="MReyes 모니터링 실제 화면: 병원별 장비 측정값과 수집 상태를 표로 확인하는 모습. 표시된 값은 예시입니다."
                width={1200}
                height={820}
                priority
                sizes="(max-width: 1100px) 94vw, 1100px"
              />
            </picture>
          </div>
          <p className="service-image-note">
            실제 서비스 화면입니다. 병원명·주소·측정값·일정 내용은 예시로
            변경했습니다.
          </p>
        </section>
        <section
          id="service-screens"
          className="service-band"
        >
          <div className="service-container">
            <div className="service-section-heading">
              <p className="service-eyebrow">
                현장과 사무실을 연결하는 업무 공간
              </p>
              <h2>
                확인하고, 기록하고,
                <br />
                다음 업무를 준비하세요.
              </h2>
              <p>
                매일 확인하는 정보와 현장에 필요한 기록을
                <br className="service-desktop-break" /> 하나의 흐름으로
                연결합니다.
              </p>
            </div>
            <div className="service-feature-grid">
              {features.map(([n, title, text]) => (
                <article key={n}>
                  <span className="service-feature-number">{n}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="service-container service-showcase">
          <div className="service-showcase-copy">
            <p className="service-eyebrow">업무 현황</p>
            <h2>
              오늘의 방문부터
              <br />
              다음 점검까지, 한눈에.
            </h2>
            <p>
              작성된 업무기록, 등록한 일정과 점검 기한을 달력에서 함께
              확인하세요. 날짜를 선택하면 그날의 업무를 살펴보고 바로 기록할 수
              있습니다.
            </p>
            <ul>
              <li>업무 유형별 색상으로 구분하는 달력</li>
              <li>날짜별 업무기록과 일정 확인</li>
              <li>선택해서 사용하는 구글캘린더 연동</li>
            </ul>
          </div>
          <figure className="service-calendar-shot">
            <Image
              src="/images/about/calendar.jpg"
              alt="MReyes 업무 달력 실제 화면: 업무기록, PM과 휴가 일정을 유형별 색상으로 구분한 모습. 일정은 예시입니다."
              width={816}
              height={942}
              sizes="(max-width: 767px) 92vw, 580px"
            />
            <figcaption>업무 달력 · 예시 일정</figcaption>
          </figure>
        </section>
        <section className="service-band">
          <div className="service-container service-showcase service-showcase-reverse">
            <div className="service-showcase-copy">
              <p className="service-eyebrow">병원 · 장비</p>
              <h2>
                현장에서 필요한 정보,
                <br />
                휴대폰에서도 간편하게.
              </h2>
              <p>
                병원을 검색하고 장비 정보와 주소를 확인하세요. 병원 상세에서는
                측정값, 장비·부품과 정비이력을 이어서 살펴볼 수 있습니다.
              </p>
              <ul>
                <li>병원명·장비·주소로 빠르게 검색</li>
                <li>병원별 업무기록과 정비이력 관리</li>
                <li>작은 화면에서도 사용할 수 있는 구성</li>
              </ul>
            </div>
            <figure className="service-phone-shot">
              <Image
                src="/images/about/hospitals.jpg"
                alt="MReyes 모바일 병원 목록 실제 화면: 검색창과 병원별 장비, 주소, 모니터링 여부. 병원 정보는 예시입니다."
                width={390}
                height={844}
                sizes="(max-width: 767px) 78vw, 320px"
              />
              <figcaption>모바일 병원 목록 · 예시 정보</figcaption>
            </figure>
          </div>
        </section>
        <section className="service-container service-steps">
          <div className="service-section-heading">
            <p className="service-eyebrow">이용 안내</p>
            <h2>팀의 초대에서 시작하세요.</h2>
            <p>
              MReyes는 회사 관리자의 초대를 받아 이용하는 업무 서비스입니다.
            </p>
          </div>
          <ol>
            {[
              ["초대받기", "관리자가 보낸 초대 이메일을 확인합니다."],
              ["계정 만들기", "초대 링크에서 가입하고 로그인합니다."],
              ["업무 시작하기", "접근 권한이 있는 병원과 일정을 확인합니다."],
            ].map(([title, text], i) => (
              <li key={title}>
                <span>STEP 0{i + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className="service-container service-faq">
          <div className="service-section-heading">
            <p className="service-eyebrow">FAQ</p>
            <h2>자주 묻는 질문</h2>
          </div>
          <div>
            {[
              [
                "휴대폰에서도 사용할 수 있나요?",
                "네. 휴대폰과 태블릿, PC의 웹 브라우저에서 이용할 수 있습니다.",
              ],
              [
                "모든 병원의 정보를 볼 수 있나요?",
                "회사와 사용자에게 부여된 권한에 따라 접근할 수 있는 병원과 정보가 달라집니다.",
              ],
              [
                "구글캘린더는 꼭 연결해야 하나요?",
                "선택 사항입니다. 연결하면 접근 권한이 있는 업무기록·일정·점검 기한을 MReyes 전용 캘린더에 반영합니다. 기존 개인 캘린더의 일정을 가져오지는 않으며, 설정에서 해제할 수 있습니다.",
              ],
              [
                "서비스 문의는 어디로 하나요?",
                "ihcho@pentaworks.net으로 문의해 주세요.",
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <span aria-hidden="true">⌄</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="service-closing">
          <div className="service-container">
            <p className="service-eyebrow">MReyes</p>
            <h2>
              장비 관리와 현장 업무를
              <br />더 자연스럽게 연결하세요.
            </h2>
            <a
              className="service-button"
              href="mailto:ihcho@pentaworks.net"
            >
              서비스 문의 <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
