"use client";
import Image from "next/image";
import { ChoiceGroup } from "./choice-group";
import {
  acrSections,
  pulseRows,
  pulseCols,
  computedDetails,
  type WorkDetails,
} from "./service-form-model";
export default function ServiceFields({
  type,
  details: d,
  onChange,
}: {
  type: string;
  details: WorkDetails;
  onChange: (details: WorkDetails) => void;
}) {
  const set = (key: keyof WorkDetails, value: string | boolean) =>
    onChange({ ...d, [key]: value });
  const field = (key: keyof WorkDetails, label: string, inputType = "text") => (
    <label key={key}>
      {label}
      <input
        className="work-input"
        type={inputType}
        value={String(d[key] ?? "")}
        onChange={(e) => set(key, e.target.value)}
        {...(inputType === "number" ? { min: 0, max: 100, step: "0.01" } : {})}
      />
    </label>
  );
  return (
    <>
      {type === "PM" && (
        <>
          <ChoiceGroup
            legend="계약 구분"
            value={d.contractType}
            onChange={(v) => set("contractType", v)}
            options={["C", "W", "On-call", "기타"].map((v) => [v, v])}
          />
          <section className="work-pm">
            <div className="work-section">
              <h2>PM 점검표</h2>
              <button
                type="button"
                className="work-secondary"
                onClick={() =>
                  onChange({
                    ...d,
                    pm: d.pm.map((item) => ({
                      ...item,
                      result: item.noCheck ? "" : item.options[0].v,
                    })),
                  })
                }
              >
                점검 항목 모두 적합
              </button>
            </div>
            <p className="work-hint">
              각 항목의 실제 점검 결과와 측정값을 입력하세요.
            </p>
            {d.pm.map((item, i) => (
              <div
                className="work-pm-item"
                key={item.name}
              >
                {i === 0 || d.pm[i - 1].section !== item.section ? (
                  <h3>{item.section}</h3>
                ) : null}
                <strong>{item.name}</strong>
                <span className="work-hint">{item.purpose}</span>
                {!item.noCheck && (
                  <ChoiceGroup
                    compact
                    legend={`${item.name} 결과`}
                    value={item.result}
                    onChange={(v) =>
                      onChange({
                        ...d,
                        pm: d.pm.map((x, j) =>
                          j === i ? { ...x, result: v } : x,
                        ),
                      })
                    }
                    options={item.options.map((o) => [o.v, o.l])}
                  />
                )}
                <div className="work-form-row">
                  {item.fields.map((f, fi) => (
                    <label
                      key={f.label}
                      className={f.type === "check" ? "work-check" : ""}
                    >
                      {f.type === "check" ? (
                        <>
                          <input
                            type="checkbox"
                            checked={f.value === "Y"}
                            onChange={(e) =>
                              onChange({
                                ...d,
                                pm: d.pm.map((x, j) =>
                                  j === i
                                    ? {
                                        ...x,
                                        fields: x.fields.map((ff, k) =>
                                          k === fi
                                            ? {
                                                ...ff,
                                                value: e.target.checked
                                                  ? "Y"
                                                  : "",
                                              }
                                            : ff,
                                        ),
                                      }
                                    : x,
                                ),
                              })
                            }
                          />
                          {f.label}
                        </>
                      ) : (
                        <>
                          {f.label}
                          {f.suffix ? " (" + f.suffix + ")" : ""}
                          <input
                            className="work-input"
                            value={f.value}
                            onChange={(e) =>
                              onChange({
                                ...d,
                                pm: d.pm.map((x, j) =>
                                  j === i
                                    ? {
                                        ...x,
                                        fields: x.fields.map((ff, k) =>
                                          k === fi
                                            ? { ...ff, value: e.target.value }
                                            : ff,
                                        ),
                                      }
                                    : x,
                                ),
                              })
                            }
                          />
                        </>
                      )}
                    </label>
                  ))}
                </div>
                {!item.noCheck && (
                  <label>
                    비고
                    <input
                      className="work-input"
                      value={item.comment}
                      onChange={(e) =>
                        onChange({
                          ...d,
                          pm: d.pm.map((x, j) =>
                            j === i ? { ...x, comment: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  </label>
                )}
              </div>
            ))}
          </section>
        </>
      )}
      {type === "COLDHEAD" && (
        <>
          <ChoiceGroup
            legend="Cold Head 위치"
            value={d.coldheadPosition}
            onChange={(v) => set("coldheadPosition", v)}
            options={[
              ["A2", "A2"],
              ["A3", "A3"],
            ]}
          />
          <div className="work-form-row">
            {field("coldheadSerial", "시리얼 번호")}
            {field("coldheadInDate", "입고일", "date")}
          </div>
        </>
      )}
      {type === "REPAIR" && (
        <label>
          증상 / 요청사항
          <textarea
            className="work-input"
            rows={4}
            value={d.symptom}
            onChange={(e) => set("symptom", e.target.value)}
            placeholder="에러코드, 접수 내용, 발생 상황"
          />
        </label>
      )}
      {type === "ACR" && (
        <>
          <ChoiceGroup
            legend="ACR 종류"
            value={d.acrKind}
            onChange={(v) => set("acrKind", v)}
            options={[
              ["doc", "서류"],
              ["full", "정밀"],
              ["pretest", "사전 TEST"],
            ]}
          />
          <p className="work-hint">
            서류·정밀·사전 TEST 양식을 구분해 보존합니다. 사전 TEST는 다음 ACR
            주기에 포함하지 않습니다.
          </p>
          <ChoiceGroup
            legend="자장 세기"
            value={d.magneticFieldTesla}
            onChange={(v) => set("magneticFieldTesla", v)}
            options={[
              ["1.5", "1.5T"],
              ["3", "3.0T"],
            ]}
          />
          <details
            className="work-acr-section"
            open
          >
            <summary>촬영 조건 · Pulse Sequence</summary>
            <div className="work-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>영상</th>
                    {pulseCols.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pulseRows.map((row) => (
                    <tr key={row}>
                      <th>{row}</th>
                      {pulseCols.map((col, i) => (
                        <td key={col}>
                          <input
                            aria-label={`${row} ${col}`}
                            className="work-input"
                            value={d.acrPulse[row]?.[i] || ""}
                            onChange={(e) => {
                              const values = [
                                ...(d.acrPulse[row] ||
                                  Array(pulseCols.length).fill("")),
                              ];
                              values[i] = e.target.value;
                              onChange({
                                ...d,
                                acrPulse: { ...d.acrPulse, [row]: values },
                              });
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          {acrSections.map((section) => {
            const values = computedDetails(d).acr[section.k];
            return (
              <details
                className="work-acr-section"
                key={section.k}
              >
                <summary>
                  {section.t}
                  <span>
                    {(
                      {
                        pass: "합격",
                        fail: "불합격",
                        na: "해당없음",
                      } as Record<string, string>
                    )[d.acrVerdicts[section.k]] || "미입력"}
                  </span>
                </summary>
                <div className="work-acr-body">
                  <details>
                    <summary>검사 방법 · 참고 그림</summary>
                    <ol>
                      {section.method.map((method) => (
                        <li key={method}>{method}</li>
                      ))}
                    </ol>
                    <p className="work-hint">{section.crit}</p>
                    {section.figs?.map((fig) => (
                      <Image
                        key={fig}
                        src={`/service-guide/acr/${fig}.jpg`}
                        alt={`${section.t} 참고 그림`}
                        width={800}
                        height={600}
                        unoptimized
                        className="work-guide-image"
                      />
                    ))}
                  </details>
                  <div className="work-form-row">
                    {section.inputs.map(([key, label, kind]) =>
                      kind === "check" ? (
                        <label
                          className="work-check"
                          key={key}
                        >
                          <input
                            type="checkbox"
                            checked={values[key] === "Y"}
                            onChange={(e) =>
                              onChange({
                                ...d,
                                acr: {
                                  ...d.acr,
                                  [section.k]: {
                                    ...d.acr[section.k],
                                    [key]: e.target.checked ? "Y" : "",
                                  },
                                },
                              })
                            }
                          />
                          {label}
                        </label>
                      ) : (
                        <label key={key}>
                          {label}
                          <input
                            className="work-input"
                            inputMode="decimal"
                            readOnly={kind === "calc"}
                            value={values[key] || ""}
                            placeholder={kind === "calc" ? "자동 계산" : ""}
                            onChange={(e) =>
                              onChange({
                                ...d,
                                acr: {
                                  ...d.acr,
                                  [section.k]: {
                                    ...d.acr[section.k],
                                    [key]: e.target.value,
                                  },
                                },
                              })
                            }
                          />
                        </label>
                      ),
                    )}
                  </div>
                  <ChoiceGroup
                    legend={`${section.t} 판정`}
                    value={d.acrVerdicts[section.k] || ""}
                    onChange={(v) =>
                      onChange({
                        ...d,
                        acrVerdicts: { ...d.acrVerdicts, [section.k]: v },
                      })
                    }
                    options={[
                      ["pass", "합격"],
                      ["fail", "불합격"],
                      ["na", "해당없음"],
                    ]}
                  />
                </div>
              </details>
            );
          })}
          <p className="work-hint">
            계산은 기존 펜타서비스 양식을 따릅니다. 최종 판정은 입력자 확인 후
            직접 선택합니다.
          </p>
        </>
      )}
      {["PM", "REPAIR", "COLDHEAD", "ETC", "INSTALL"].includes(type) && (
        <label>
          교체 부품
          <textarea
            className="work-input"
            value={d.parts}
            onChange={(e) => set("parts", e.target.value)}
            placeholder="부품번호 · 부품명 · 수량 (한 줄에 하나)"
          />
        </label>
      )}
      {type !== "CALL" && (
        <div className="work-form-row">
          {field("startTime", "작업 시작", "time")}
          {field("endTime", "작업 종료", "time")}
        </div>
      )}
      {["REPAIR", "COLDHEAD"].includes(type) &&
        field("heLevel", "헬륨 레벨 (%)", "number")}
    </>
  );
}
