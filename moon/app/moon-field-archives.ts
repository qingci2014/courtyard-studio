import {rockSamples,type AdventureState} from './moon-adventure';
export type FieldArchive={id:string;title:string;category:string;source:string;summary:string;sections:{heading:string;text:string}[]};
export function fieldArchives(state:AdventureState):FieldArchive[]{const records:FieldArchive[]=[];
 if(state.signal==='decoded')records.push({id:'distant-echo',title:'远方的回声',category:'信号回收档案 / SIG-001',source:'西北失联探测器 · 142.4 MHz · 工作室解码',summary:'一段始终没有等到确认的采样指令。',sections:[
 {heading:'回收结论',text:'你回收的并非一支队伍的新求救信号，而是首批勘探队留在月面的自动探测器。主通信模块损坏后，备用发射器一直循环发送最后一条尚未确认的采样任务。'},
 {heading:'芯片记录 · 任务下达',text:'“平原、喷出物、高地，各取一份。不要只带回最漂亮的石头。我们需要知道，它们为什么不同。”'},
 {heading:'芯片记录 · 通信中断',text:'“上行链路无回应。切换备用载波。保留地质坐标，等待下一次接收确认。”'},
 {heading:'芯片记录 · 循环广播',text:'剩余记录由重复的数据包组成：三组坐标、同一段采样指令，以及空白的确认字段。直到你取回芯片，这项旧任务才重新出现在基地终端上。'},
 {heading:'恢复的采样清单',text:rockSamples.map(r=>`${r.name}：X ${r.x} / Z ${r.z}`).join('\n')},
 {heading:'后续行动',text:'三处岩样可分别采集，带回工作室鉴定。每完成一份研究，档案室会保留对应报告；这份信号档案可随时重新阅读。'}]});
 for(const r of rockSamples)if(state.studied.includes(r.id))records.push({id:r.id,title:r.name+'研究报告',category:'月岩研究 / '+r.type,source:`采样点 X ${r.x} / Z ${r.z} · 工作室鉴定`,summary:r.clue,sections:[{heading:'样本观察',text:r.clue},{heading:'鉴定结果',text:r.type+'。'+r.report},{heading:'设备应用',text:'研究结果已用于校准矿物背景噪声，信号接收范围由 150 m 提升到 220 m。该提升只生效一次，不会因重复阅读叠加。'}]});
 if(state.studied.length===3)records.push({id:'lunar-geologist',title:'月面地质员',category:'研究合集 / GEO-001',source:'三处岩样研究完成',summary:'从三块石头，建立基地的第一组地质对照。',sections:[{heading:'研究清单',text:rockSamples.map(r=>`${r.name} → ${r.type}\n${r.report}`).join('\n\n')},{heading:'归档说明',text:'三份样本的观察与鉴定结果均已归档。你可以在档案室分别打开报告，查看各自的采样坐标、特征与结论。'}]});
 return records;
}
