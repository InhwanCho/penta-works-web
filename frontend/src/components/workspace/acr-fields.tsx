"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useId, useState, type ReactNode } from "react";
import { ChoiceGroup } from "./choice-group";
import WorkspaceDrawer from "./workspace-drawer";
import {
  acrSections, acrPreparation, pulseCols, pulseRows, computedDetails,
  acrFieldVerdict, acrAutoVerdict, acrEffectiveVerdicts, acrOverallVerdict,
  type WorkDetails, type AcrSection,
} from "./service-form-model";

const verdictOptions: [string, string][] = [["pass", "합격"], ["fail", "불합격"], ["na", "해당없음"]];
const verdictLabels: Record<string, string> = { pass: "합격", fail: "불합격", na: "해당없음", invalid: "숫자 확인" };

export function GuideFigures({ figures, title }: { figures?: string[]; title: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return <>
    <div className="service-guide-figures">
      {figures?.map((figure, index) => <figure key={figure}>
        <a href={`/service-guide/acr/${figure}.jpg`} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); setExpanded(figure); }} aria-label={`${title} 참고 그림 ${index + 1} 크게 보기`}>
          <Image src={`/service-guide/acr/${figure}.jpg`} alt={`${title} 참고 그림 ${index + 1}`} width={800} height={600} unoptimized className="work-guide-image" />
        </a>
        <figcaption>참고 그림 {index + 1} · 눌러서 확대</figcaption>
      </figure>)}
    </div>
    {expanded && createPortal(<WorkspaceDrawer title={`${title} 참고 그림`} onClose={() => setExpanded(null)} className="service-guide-viewer">
      <Image src={`/service-guide/acr/${expanded}.jpg`} alt={`${title} 확대 그림`} width={1200} height={900} unoptimized className="service-guide-expanded" />
    </WorkspaceDrawer>, document.querySelector(".workspace-frame") || document.body)}
  </>;
}
function MeasurementFields({ section, details, onChange }: { section: AcrSection; details: WorkDetails; onChange: (next: WorkDetails) => void }) {
  const id = useId();
  const values = computedDetails(details).acr[section.k];
  const update = (key: string, value: string) => onChange({ ...details, acr: { ...details.acr, [section.k]: { ...details.acr[section.k], [key]: value } } });
  const check = ([key, label]: string[]) => <label className="work-check acr-image-check" key={key}>
    <input type="checkbox" checked={values[key] === "Y"} onChange={event => update(key, event.target.checked ? "Y" : "")} /><span>{label}</span>
  </label>;
  const nodes: ReactNode[] = [];
  for (let index = 0; index < section.inputs.length; index++) {
    const [key, label, kind, hint] = section.inputs[index];
    if (kind === "check") {
      nodes.push(<div key={key} className={hint === "full" ? "acr-full-row" : ""}>{check(section.inputs[index])}</div>);
      continue;
    }
    const verdict = acrFieldVerdict(section.k, key, values, details.magneticFieldTesla);
    const invalid = verdict === "fail" || verdict === "invalid";
    const setting = ["geoww", "geowl", "t1wl", "t2wl", "t1peakhalf", "t2peakhalf", "sighalf"].includes(key) && !!values[key];
    const input = <label className="acr-measurement" htmlFor={`${id}-${key}`}>
      <span>{label}</span>
      <input id={`${id}-${key}`} className={`work-input ${verdict ? `measurement-${verdict}` : setting ? "measurement-setting" : ""}`} type="text" inputMode="decimal" readOnly={kind === "calc"} value={values[key] || ""}
        aria-invalid={invalid || undefined} aria-describedby={verdict ? `${id}-${key}-result` : undefined}
        placeholder={kind === "calc" ? "자동 계산" : hint || "측정값 입력"} onChange={event => update(key, event.target.value)} />
      {verdict && <small id={`${id}-${key}-result`} className={`measurement-result measurement-result-${verdict}`}>{verdict === "pass" ? "✓ 기준 이내" : verdict === "fail" ? "! 기준 범위 밖" : "! 숫자를 확인하세요"}</small>}
    </label>;
    const next = section.inputs[index + 1];
    const paired = next?.[2] === "check" && next?.[3] === "pair";
    nodes.push(<div key={key} className={paired ? "acr-measurement-pair" : ""}>{input}{paired && check(next)}</div>);
    if (paired) index++;
  }
  return <div className={`acr-measurement-grid acr-grid-${section.grid || 2}`}>{nodes}</div>;
}
export default function AcrFields({ details: d, onChange }: { details: WorkDetails; onChange: (details: WorkDetails) => void }) {
  const computed = computedDetails(d);
  const effective = acrEffectiveVerdicts(d);
  const overall = acrOverallVerdict(d);
  const evaluated = Object.values(effective).filter(Boolean).length;
  return <div className="acr-form">
    <ChoiceGroup legend="ACR 종류" value={d.acrKind} onChange={value => onChange({ ...d, acrKind: value })} options={[["doc", "서류"], ["full", "정밀"], ["pretest", "사전 TEST"]]} />
    <p className="work-hint">서류: 매년 제출 · 정밀: 3년마다 팬텀 정도관리 · 사전 TEST: 서류·정밀 주기 계산에서 제외됩니다.</p>
    <ChoiceGroup legend="자장 세기" value={d.magneticFieldTesla} onChange={value => onChange({ ...d, magneticFieldTesla: value })} options={[["1.5", "1.5T"], ["3", "3.0T"]]} />
    <section className="work-acr-section acr-preparation">
      <h3>촬영 준비 · Pulse Sequence</h3>
      <ol className="service-method">{acrPreparation.method.map(text => <li key={text}>{text}</li>)}</ol>
      <GuideFigures figures={acrPreparation.figs} title="촬영 준비" />
      <div className="work-table-scroll"><table><thead><tr><th>영상</th>{pulseCols.map(column => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>{pulseRows.map(row => <tr key={row}><th>{row}</th>{pulseCols.map((column, index) => <td key={column}><input aria-label={`${row} ${column}`} className="work-input" value={d.acrPulse[row]?.[index] || ""} onChange={event => {
          const next = [...(d.acrPulse[row] || Array(pulseCols.length).fill(""))]; next[index] = event.target.value;
          onChange({ ...d, acrPulse: { ...d.acrPulse, [row]: next } });
        }} /></td>)}</tr>)}</tbody></table></div>
    </section>
    {acrSections.map(section => {
      const verdict = effective[section.k];
      const automatic = acrAutoVerdict(section.k, computed.acr[section.k], d.magneticFieldTesla);
      const hasOutOfRange = section.inputs.some(([key]) => ["fail", "invalid"].includes(acrFieldVerdict(section.k, key, computed.acr[section.k], d.magneticFieldTesla)));
      return <details className={`work-acr-section ${hasOutOfRange || verdict === "fail" ? "service-section-fail" : ""}`} key={section.k} open>
        <summary><span className="acr-section-title">{section.t}</span><span className={`service-verdict verdict-${verdict || "empty"}`}>{verdictLabels[verdict] || "미입력"}{verdict ? d.acrVerdicts[section.k] ? " · 수동" : " · 자동" : ""}</span></summary>
        <div className="work-acr-body">
          <ol className="service-method">{section.method.map(text => <li key={text}>{text}</li>)}</ol>
          <GuideFigures figures={section.figs} title={section.t} />
          <p className="acr-criteria">{section.crit}</p>
          <MeasurementFields section={section} details={d} onChange={onChange} />
          {hasOutOfRange && d.acrVerdicts[section.k] === "pass" && <p className="measurement-result-fail" role="status">범위 밖인 측정값이 있습니다. 수동 합격 판정을 확인하세요.</p>}
          <div className="acr-verdict-controls"><ChoiceGroup legend={`${section.t} 판정`} value={verdict} onChange={value => onChange({ ...d, acrVerdicts: { ...d.acrVerdicts, [section.k]: value } })} options={verdictOptions} />
            {d.acrVerdicts[section.k] && <button type="button" className="work-text-button" onClick={() => onChange({ ...d, acrVerdicts: { ...d.acrVerdicts, [section.k]: "" } })}>자동 판정으로{automatic ? ` (${verdictLabels[automatic]})` : ""}</button>}
          </div>
        </div>
      </details>;
    })}
    <section className={`acr-overall ${overall === "fail" ? "service-section-fail" : ""}`}>
      <div><h3>입력된 항목 종합 판정</h3><p className="work-hint">{evaluated} / {acrSections.length}개 항목 판정 · {d.acrOverall ? "수동" : "자동"}</p></div>
      <ChoiceGroup legend="ACR 종합 판정" value={overall} options={verdictOptions} onChange={value => onChange({ ...d, acrOverall: value })} />
      {d.acrOverall && <button type="button" className="work-text-button" onClick={() => onChange({ ...d, acrOverall: "" })}>자동 판정으로</button>}
    </section>
  </div>;
}
