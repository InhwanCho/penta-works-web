"use client";
import AcrFields from "./acr-fields";
import { ChoiceGroup } from "./choice-group";
import {
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
                className={`work-pm-item ${item.result === "fail" ? "service-section-fail" : item.result === "cant" ? "service-section-warn" : ""}`}
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
                <div className={`work-form-row pm-measurements ${["DQA Tool", "DAQA", "LV Shim"].includes(item.name) ? "pm-measurements-grid" : ""}`}>
                  {item.fields.map((f, fi) => {
                    const update = (value: string) => onChange({ ...d, pm: d.pm.map((entry, index) => index === i ? { ...entry, fields: entry.fields.map((field, fieldIndex) => fieldIndex === fi ? { ...field, value } : field) } : entry) });
                    if (f.type === "check") return <label className="work-check" key={f.label}><input type="checkbox" checked={f.value === "Y"} onChange={event => update(event.target.checked ? "Y" : "")} />{f.label}</label>;
                    if (f.type === "range") {
                      const [low = "", high = ""] = f.value.split("~");
                      return <fieldset className="pm-range-field" key={f.label}><legend>{f.label} {f.suffix && `(${f.suffix})`}</legend><div>
                        <input className="work-input" inputMode="decimal" aria-label={`${f.label} 범위 시작`} value={low} placeholder="시작값" onChange={event => update(`${event.target.value}~${high}`)} />
                        <span aria-hidden="true">~</span>
                        <input className="work-input" inputMode="decimal" aria-label={`${f.label} 범위 끝`} value={high} placeholder="끝값" onChange={event => update(`${low}~${event.target.value}`)} />
                      </div></fieldset>;
                    }
                    return <label key={f.label}>{f.label}{f.suffix && ` (${f.suffix})`}<input className="work-input" value={f.value} onChange={event => update(event.target.value)} /></label>;
                  })}
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
      {type === "ACR" && <AcrFields details={d} onChange={onChange} />}
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
