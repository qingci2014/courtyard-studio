import {useState} from 'react';
import {fieldArchives} from './moon-field-archives';
import type {AdventureState} from './moon-adventure';
export function FieldArchives({state,initialId}:{state:AdventureState;initialId?:string}){
 const records=fieldArchives(state),[selected,setSelected]=useState(initialId??'');const record=records.find(r=>r.id===selected);
 if(record)return <article className="moon-archive-reader"><button onClick={()=>setSelected('')}>← 全部档案（{records.length}）</button><small>{record.category}</small><h3>{record.title}</h3><p className="moon-archive-source">{record.source}</p><p>{record.summary}</p>{record.sections.map(section=><section key={section.heading}><h4>{section.heading}</h4><p>{section.text}</p></section>)}<p className="moon-archive-source">已归档 · 随探索存档保留，可重复阅读</p></article>;
 return <div className="moon-archive-list"><p>已归档 {records.length} 份。完成解码或岩样研究后，报告会自动保存在这里。</p>{records.length===0&&<p>暂无已解锁档案。回收信号芯片后在工作室解码，可获得「远方的回声」。</p>}{records.map(r=><button key={r.id} onClick={()=>setSelected(r.id)}><small>{r.category}</small><strong>{r.title}</strong><span>{r.summary}</span><b>打开档案 →</b></button>)}</div>;
}
