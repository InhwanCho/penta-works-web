import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function initialTheme(saved) {
 const classes=new Map();let change;
 const exports={};const effects=[];
 const source=ts.transpileModule(fs.readFileSync(new URL('../src/components/provider/theme-provider.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(source,{exports,localStorage:{getItem:key=>key==='theme'?saved:null},window:{matchMedia:()=>({matches:true,addEventListener:(_,listener)=>change=listener,removeEventListener(){}})},document:{documentElement:{classList:{toggle:(key,value)=>classes.set(key,value)}}},require:name=>name==='react'?{createContext:()=>({Provider:'Provider'}),useState:value=>[value,()=>{}],useEffect:effect=>effects.push(effect)}:{jsx:()=>null}});
 exports.ThemeProvider({children:null});effects.forEach(effect=>effect());return {classes,change};
}
test('first visit stays light even when the OS prefers dark',()=>{
 const theme=initialTheme(null);assert.equal(theme.classes.get('dark'),false);theme.change({matches:true});assert.equal(theme.classes.get('dark'),false);
});
test('explicit dark and system preferences remain supported',()=>{
 assert.equal(initialTheme('dark').classes.get('dark'),true);assert.equal(initialTheme('system').classes.get('dark'),true);assert.equal(initialTheme('light').classes.get('dark'),false);
});
