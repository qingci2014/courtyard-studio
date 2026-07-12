"use client";
import "./thumbs.css";
import "./gallery.css";
import "./materials.css";
import {useState} from "react";import HouseScene from "./HouseScene";
const spaces=[
 {id:"overview",name:"全屋概览",sub:"整体空间",area:"9 × 16 m",text:"一座由庭院串联起日常生活的当代东方居所。"},
 {id:"courtyard",name:"中央庭院",sub:"院落核心",area:"46 m²",text:"两株主景树围合出安静核心，浅砖、水景与室内光线彼此渗透。"},
 {id:"living",name:"客厅",sub:"起居空间",area:"24 m²",text:"低矮家具与整面落地窗，让视线自然延伸至庭院。"},
 {id:"dining",name:"餐厨空间",sub:"餐饮与烹饪",area:"20 m²",text:"石材岛台、烟熏木柜体与柔和灯光构成家庭聚会中心。"},
 {id:"primary",name:"主卧",sub:"私享套房",area:"22 m²",text:"温润木作、亚麻织物和隐藏灯光营造克制而舒展的休息空间。"},
 {id:"guest",name:"客卧",sub:"客居空间",area:"14 m²",text:"面向绿意的小型套房，安静简洁，兼顾长期居住。"}
];
export default function Home(){const[active,setActive]=useState("overview"),[view,setView]=useState("iso"),[cut,setCut]=useState(false),[time,setTime]=useState(12),[lightbox,setLightbox]=useState(false);const current=spaces.find(s=>s.id===active)!;const renderMap:Record<string,string>={overview:"/renders/overview.png",courtyard:"/renders/courtyard.png",living:"/renders/living-room.png",dining:"/renders/dining-kitchen.png",primary:"/renders/primary-bedroom.png",guest:"/renders/guest-bedroom.png"};const render=renderMap[active];return <main>
 <header><div className="mark">⌂</div><div><h1>庭院生活设计馆</h1><p>探索空间、光影与日常</p></div><nav>项目概览　设计说明　材质库</nav></header>
 <section className="workspace"><aside className="panel spaces"><h2>空间导览</h2>{spaces.map(s=><button key={s.id} className={active===s.id?"selected":""} onClick={()=>setActive(s.id)}><span className="thumb"><img src={`/plans/${s.id}.jpg`} alt={`${s.name}平面图`}/></span><b>{s.name}</b><small>{s.sub}</small></button>)}</aside>
 <div className="stage panel"><div className="viewTabs">{[["iso","3D轴测"],["section","剖切视图"]].map(v=><button key={v[0]} className={view===v[0]?"on":""} onClick={()=>setView(v[0])}>{v[1]}</button>)}<label>墙体剖切 <input type="checkbox" checked={cut} onChange={e=>setCut(e.target.checked)}/></label></div><div className="threeStage"><HouseScene section={view==="section"} active={active} cutaway={cut} time={time}/></div><div className="controls"><button>↻ 按住拖拽旋转</button><button>滚轮缩放</button><button>右键平移</button></div></div>
 <aside className="side"><article className="panel detail"><h2>{current.name}详情</h2><strong>{current.area}</strong><div className="swatches"><i></i><i></i><i></i><i></i></div><h3>设计理念</h3><p>{current.text}</p></article><article className="panel resultCard"><h2>{current.name}效果图</h2><button className="resultImage" onClick={()=>setLightbox(true)} aria-label={`放大查看${current.name}效果图`}><img src={render} alt={`${current.name}效果图`}/></button></article></aside></section>
 <section className="bottom"><article className="panel materials"><h2>材质方案</h2><div className="materialGrid"><div><i className="material wood"></i><b>烟熏橡木</b><small>定制木作 · 哑光</small></div><div><i className="material stone"></i><b>浅色洞石</b><small>台面与地面</small></div><div><i className="material brick"></i><b>暖灰院砖</b><small>庭院防滑铺装</small></div><div><i className="material fabric"></i><b>天然亚麻</b><small>沙发与软装</small></div></div></article><article className="panel projectFacts"><h2>项目概况</h2><div><p><b>9 × 16 m</b><small>建筑尺度</small></p><p><b>两室两卫</b><small>居住配置</small></p><p><b>三重庭院</b><small>空间结构</small></p><p><b>现代东方</b><small>设计风格</small></p></div></article><article className="panel daylight"><h2>日照模拟 <b>{time}:00</b></h2><div className="sun" style={{left:`${8+(time-6)/12*84}%`}}>☀</div><div className="arc"></div><input aria-label="日照时间" type="range" min="6" max="18" value={time} onChange={e=>setTime(+e.target.value)}/><p><span>清晨</span><span>上午</span><span>正午</span><span>下午</span><span>傍晚</span></p></article></section>
 {lightbox&&<div className="lightbox" role="dialog" aria-modal="true" aria-label={`${current.name}效果图大图`} onClick={()=>setLightbox(false)}><button className="lightboxClose" onClick={()=>setLightbox(false)}>×</button><img src={render} alt={`${current.name}效果图大图`} onClick={e=>e.stopPropagation()}/><div>{current.name}效果图</div></div>}
 </main>}
