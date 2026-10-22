import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {}; let resets = 0;
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/components/common/app-link.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
 exports, URL, window:{location:{href:'https://app.pentaworks.net/about',pathname:'/about',search:''}},
 require:name=>name==='react'?{forwardRef:fn=>fn}:name==='react/jsx-runtime'?{jsx:(_,props)=>props}:name==='next/link'?{default:()=>null}:{scrollPageToTop:()=>resets++},
});
const link=(props)=>exports.default(props,null);
test('policy and other internal page links reset before navigation',()=>{for(const href of ['/terms','/privacy','/hospitals','/work/42','/settings']){resets=0;const l=link({href});assert.equal(l.scroll,false);l.onNavigate({preventDefault(){}});assert.equal(resets,1);}});
test('explicit section links keep framework target scrolling',()=>{for(const href of ['/sites/11#inspection-plan','/?scrollTo=011']){resets=0;const l=link({href});assert.equal(l.scroll,true);l.onNavigate({preventDefault(){}});assert.equal(resets,0);}});
test('same-page query changes preserve scroll and cancelled navigation stays put',()=>{resets=0;link({href:'/about?view=details'}).onNavigate({preventDefault(){}});assert.equal(resets,0);let prevented=false;link({href:'/terms',onNavigate:e=>e.preventDefault()}).onNavigate({preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(resets,0);});
