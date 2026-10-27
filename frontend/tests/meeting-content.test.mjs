import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
const exports={},require=createRequire(import.meta.url);
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/meeting-content.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports,require});
test('weekly content preserves all original HTML when its visible sections are unchanged',()=>{
 const source='<p>참고</p><h2>지난주 진행 내용</h2><ul><li><strong>PM 완료</strong></li></ul><h2>진행 중인 일·이슈</h2><p>부품 수리 중</p><h2>이번 주·예정 작업</h2><p>다음 방문</p>';
 const original=exports.splitMeeting(source),edited=original.map(exports.meetingText),joined=exports.joinMeeting(edited,original);
 assert.ok(joined.includes('<p>참고</p>'));assert.ok(joined.includes('<strong>PM 완료</strong>'));assert.ok(joined.includes('<p>부품 수리 중</p>'));assert.ok(joined.includes('<p>다음 방문</p>'));
 edited[1]='교체 완료';const updated=exports.joinMeeting(edited,original);
 assert.ok(updated.includes('<p>교체 완료</p>'));assert.ok(updated.includes('<strong>PM 완료</strong>'));
});
test('legacy single-body minutes are retained in full, not truncated to a list preview',()=>{
 const legacy='<p>기존 회의록 &amp; 참석 내용</p>'+ '<p>추가 내용</p>'.repeat(100);
 const original=exports.splitMeeting(legacy);assert.equal(original[0],legacy);assert.equal(original[1],'');
 assert.ok(exports.joinMeeting(original.map(exports.meetingText),original).includes(legacy));
 assert.ok(exports.meetingText(legacy).length>320);
});
test('imported HTML and markdown render readable content without executable HTML or unsafe URLs',()=>{
 const html=exports.meetingHtml('<script>alert(1)</script><p onclick="bad()">확인</p><img src=x onerror=bad()><a href="javascript:bad()">link</a>');
 assert.ok(!html.includes('script'));assert.ok(!html.includes('onclick'));assert.ok(!html.includes('onerror'));assert.ok(!html.includes('javascript:'));assert.ok(html.includes('확인'));
 assert.ok(exports.meetingHtml('**PM 완료**').includes('<strong>PM 완료</strong>'));
 assert.equal(exports.meetingText('<p>A &amp; B<br>둘째 줄</p>'),'A & B\n둘째 줄');
});
test('last-week reporting follows Monday to Sunday across month and year boundaries',()=>{
 assert.equal(exports.meetingReportPeriod('2026-10-06T10:00'),'2026.09.28 ~ 2026.10.04');
 assert.equal(exports.meetingReportPeriod('2026-01-01T10:00'),'2025.12.22 ~ 2025.12.28');
 assert.equal(exports.meetingReportPeriod('invalid'),'');
});
