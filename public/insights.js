// Insights view: a district choropleth and ranked charts built from the loaded archive.
// Every mark is a button that opens the archive filtered to that value.
import {districts,riverNames,yearOf} from './core.js';

const text={
 en:{title:'Where and what the archive covers',eyebrow:'INSIGHTS',intro:'Counts of archived records, not of extraction events. Coverage reflects where searches looked and what sources reported, so a blank district is not evidence of no extraction.',
  districtsCovered:'districts with records',ofDistricts:'of 64',rivers:'rivers and sites',publishers:'publishers',banglaShare:'from Bangla-language sources',
  mapTitle:'Records by district',mapNote:'records cover several districts or the whole country and are not mapped.',records:'records',record:'record',none:'No records',
  yearTitle:'Records by source year',yearNote:'Undated records are counted under Unknown. * marks a year known only as an act or issue year.',riverTitle:'Most-reported rivers and sites',sourceTitle:'Most frequent publishers',
  showTable:'Show as table',district:'District',year:'Year',count:'Records',open:'Open in archive'},
 bn:{title:'আর্কাইভ কোথায় ও কী নিয়ে',eyebrow:'বিশ্লেষণ',intro:'এখানে আর্কাইভ করা নথির সংখ্যা দেখানো হয়েছে, উত্তোলনের ঘটনার সংখ্যা নয়। কোথায় অনুসন্ধান হয়েছে ও কোন উৎস খবর প্রকাশ করেছে তার ওপর এটি নির্ভর করে; তাই ফাঁকা জেলা মানে উত্তোলন নেই, এমন নয়।',
  districtsCovered:'জেলায় নথি আছে',ofDistricts:'৬৪টির মধ্যে',rivers:'নদী ও স্থান',publishers:'প্রকাশক',banglaShare:'বাংলা ভাষার উৎস থেকে',
  mapTitle:'জেলাভিত্তিক নথি',mapNote:'টি নথি একাধিক জেলা বা সারা দেশ নিয়ে, তাই মানচিত্রে দেখানো হয়নি।',records:'টি নথি',record:'টি নথি',none:'কোনো নথি নেই',
  yearTitle:'উৎসের বছর অনুযায়ী নথি',yearNote:'তারিখবিহীন নথি "অজানা" হিসেবে গণনা করা হয়েছে। * চিহ্ন দিয়ে শুধু আইন বা সংখ্যার বছর জানা নথি বোঝানো হয়েছে।',riverTitle:'সবচেয়ে বেশি আলোচিত নদী ও স্থান',sourceTitle:'সবচেয়ে বেশি প্রকাশকারী উৎস',
  showTable:'সারণি হিসেবে দেখুন',district:'জেলা',year:'বছর',count:'নথি',open:'আর্কাইভে খুলুন'}
};
// Single-hue sequential steps (light → dark on light surfaces, dark → bright on dark ones).
const bins=[1,2,4,7,15];
const broad=new Set(['National / multiple','Multiple districts','Regional study','Regional / transboundary','Global']);
const groups=new Set(['Other / unspecified','Multiple rivers','National jurisdiction','National / multiple','Canals, streams & chharas','Coast & estuaries','Sand mahal / lease areas','Stone quarries']);

let shapes=null;
async function loadShapes(){if(!shapes)shapes=fetch('assets/bd-districts.json').then(r=>r.json());return shapes;}
const countBy=(records,fn)=>{const m=new Map();for(const r of records)for(const k of new Set(fn(r)))m.set(k,(m.get(k)??0)+1);return m;};
const binOf=n=>n?bins.filter(b=>n>=b).length:0;
const el=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;};

export async function renderInsights(root,records,{lang,label,onPick}){
 const L=text[lang],num=n=>n.toLocaleString(lang==='bn'?'bn-BD':'en-US');
 const byDistrict=countBy(records,r=>districts(r).filter(d=>!broad.has(d)));
 const unmapped=records.filter(r=>districts(r).every(d=>broad.has(d))).length;
 const byRiver=countBy(records,r=>riverNames(r).filter(x=>!groups.has(x)));
 const bySource=countBy(records,r=>[r.source]);
 const byYear=countBy(records,r=>[yearOf(r)]);
 const bangla=records.filter(r=>r.language==='Bangla').length;
 const {viewBox,districts:paths}=await loadShapes();
 const mapped=[...byDistrict.keys()].filter(d=>paths[d]).length;

 root.replaceChildren();
 const head=el('div','section-heading insights-heading');const hw=el('div');hw.append(el('p','eyebrow',L.eyebrow),el('h2',null,L.title));head.append(hw);
 root.append(head,el('p','insights-intro',L.intro));

 const tiles=el('div','insight-tiles');
 for(const [value,labelText] of [[`${num(mapped)}`,`${L.districtsCovered} · ${L.ofDistricts}`],[num(byRiver.size),L.rivers],[num(bySource.size),L.publishers],[`${num(Math.round(bangla/records.length*100))}%`,L.banglaShare]]){
  const t=el('div','insight-tile');t.append(el('strong',null,value),el('span',null,labelText));tiles.append(t);
 }
 root.append(tiles);

 const grid=el('div','insights-grid');root.append(grid);
 const tip=el('div','chart-tip');tip.hidden=true;root.append(tip);
 const showTip=(e,value,name)=>{tip.replaceChildren(el('strong',null,value),el('span',null,name));tip.hidden=false;const box=root.getBoundingClientRect(),x=(e.clientX??e.target.getBoundingClientRect().left)-box.left,y=(e.clientY??e.target.getBoundingClientRect().top)-box.top;tip.style.left=Math.min(x+14,box.width-tip.offsetWidth-8)+'px';tip.style.top=(y+14)+'px';};
 const hideTip=()=>{tip.hidden=true;};
 const countText=n=>n?`${num(n)} ${n===1?L.record:L.records}`:L.none;

 // District map
 const mapCard=el('section','chart-card map-card');mapCard.append(el('h3',null,L.mapTitle));
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',viewBox);svg.setAttribute('class','district-map');svg.setAttribute('role','group');svg.setAttribute('aria-label',L.mapTitle);
 const g=document.createElementNS('http://www.w3.org/2000/svg','g');svg.append(g);
 for(const [name,d] of Object.entries(paths)){
  const n=byDistrict.get(name)??0,p=document.createElementNS('http://www.w3.org/2000/svg','path');
  p.setAttribute('d',d);p.setAttribute('class',`district bin-${binOf(n)}`);
  const name2=label(name);p.setAttribute('aria-label',`${name2}: ${countText(n)}`);
  if(n){p.setAttribute('tabindex','0');p.setAttribute('role','button');p.addEventListener('click',()=>onPick({district:name}));p.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onPick({district:name});}});}
  p.addEventListener('pointermove',e=>showTip(e,countText(n),name2));p.addEventListener('focus',e=>showTip(e,countText(n),name2));p.addEventListener('pointerleave',hideTip);p.addEventListener('blur',hideTip);
  g.append(p);
 }
 mapCard.append(svg);
 const legend=el('div','map-legend');
 for(const [i,range] of [[0,'0'],[1,'1'],[2,'2–3'],[3,'4–6'],[4,'7–14'],[5,'15+']]){const k=el('span','legend-key');const sw=el('i',`swatch bin-${i}`);k.append(sw,document.createTextNode(lang==='bn'?range.replace(/\d/g,d=>'০১২৩৪৫৬৭৮৯'[d]):range));legend.append(k);}
 mapCard.append(legend,el('p','chart-note',`${num(unmapped)} ${L.mapNote}`));
 mapCard.append(tableOf(L.showTable,[L.district,L.count],[...byDistrict].filter(([d])=>paths[d]).sort((a,b)=>b[1]-a[1]).map(([d,n])=>[label(d),num(n)])));
 grid.append(mapCard);

 const side=el('div','insights-side');grid.append(side);

 // Years: columns, chronological, Unknown last
 const years=[...byYear].sort((a,b)=>a[0]==='Unknown'?1:b[0]==='Unknown'?-1:a[0].localeCompare(b[0]));
 const yearCard=el('section','chart-card');yearCard.append(el('h3',null,L.yearTitle));
 const cols=el('div','columns');const maxY=Math.max(...years.map(y=>y[1]));const top=years.reduce((a,b)=>b[1]>a[1]?b:a);
 for(const [y,n] of years){
  const b=el('button','column');b.type='button';b.setAttribute('aria-label',`${label(y)}: ${countText(n)}`);
  const bar=el('span','column-bar');bar.style.height=`${Math.max(3,n/maxY*100)}%`;
  if(y===top[0])bar.append(el('span','column-value',num(n)));
  b.append(bar,el('span','column-label',y==='Unknown'?(lang==='bn'?'অজানা':'Unk.'):/^\d{4}$/.test(y)?`’${y.slice(2)}`:'*'));
  b.addEventListener('pointermove',e=>showTip(e,countText(n),label(y)));b.addEventListener('focus',e=>showTip(e,countText(n),label(y)));b.addEventListener('pointerleave',hideTip);b.addEventListener('blur',hideTip);
  b.addEventListener('click',()=>onPick({year:y}));cols.append(b);
 }
 yearCard.append(cols,el('p','chart-note',L.yearNote),tableOf(L.showTable,[L.year,L.count],years.map(([y,n])=>[label(y),num(n)])));
 side.append(yearCard);

 side.append(barCard(L.riverTitle,[...byRiver].sort((a,b)=>b[1]-a[1]).slice(0,10),label,num,countText,x=>onPick({river:x}),showTip,hideTip));
 side.append(barCard(L.sourceTitle,[...bySource].sort((a,b)=>b[1]-a[1]).slice(0,8),s=>s,num,countText,x=>onPick({source:x}),showTip,hideTip));
}

function barCard(title,rows,label,num,countText,pick,showTip,hideTip){
 const card=el('section','chart-card');card.append(el('h3',null,title));
 const list=el('div','bars');const max=Math.max(...rows.map(r=>r[1]));
 for(const [name,n] of rows){
  const b=el('button','bar-row');b.type='button';b.setAttribute('aria-label',`${label(name)}: ${countText(n)}`);
  const track=el('span','bar-track'),fill=el('span','bar-fill');fill.style.width=`${n/max*100}%`;track.append(fill);
  b.append(el('span','bar-label',label(name)),track,el('span','bar-value',num(n)));
  b.addEventListener('click',()=>pick(name));b.addEventListener('pointerleave',hideTip);
  list.append(b);
 }
 card.append(list);return card;
}

function tableOf(summary,headers,rows){
 const d=el('details','chart-table');d.append(el('summary',null,summary));
 const table=el('table'),thead=el('thead'),tr=el('tr');headers.forEach(h=>tr.append(el('th',null,h)));thead.append(tr);
 const tbody=el('tbody');for(const row of rows){const r=el('tr');row.forEach(c=>r.append(el('td',null,c)));tbody.append(r);}
 table.append(thead,tbody);const wrap=el('div','audit-scroll');wrap.append(table);d.append(wrap);return d;
}
