let data={campaigns:[],layout:[]},editing=null,history=[],dirty=false,drag=null,selected=null,suppressClickUntil=0;
const $=id=>document.getElementById(id);
const req=(path='',o={})=>fetch('/api/campaigns'+path,{...o,headers:{'content-type':'application/json',...o.headers}});
const uid=()=>`row-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const snapshot=()=>JSON.stringify(data.layout);

async function load(){
  const r=await req('?admin=1');
  if(!r.ok){$('cardNotice').textContent='データを読み込めませんでした';return}
  data=await r.json();
  if(!data.layout?.length)data.layout=pack(data.campaigns.map(x=>x.code),data.columns===4?4:3);
  history=[];selected=null;setDirty(false);reset();renderCards();renderLayout();
}
function pack(codes,n){const a=[];for(let i=0;i<codes.length;i+=n)a.push({id:uid(),type:'cards',columns:n,codes:codes.slice(i,i+n)});return a}
function tab(name){const card=name==='card';$('cardPanel').classList.toggle('hidden',!card);$('layoutPanel').classList.toggle('hidden',card);$('cardTab').classList.toggle('primary',card);$('layoutTab').classList.toggle('primary',!card);if(!card)renderLayout()}
$('cardTab').onclick=()=>tab('card');$('layoutTab').onclick=()=>tab('layout');

function reset(){editing=null;$('code').value=next();$('name').value=$('endDate').value=$('url').value='';$('active').checked=true;$('cardNotice').textContent='';$('saveCard').textContent='保存する'}
function next(){const n=data.campaigns.reduce((m,x)=>Math.max(m,Number(x.code.replace(/\D/g,''))||0),0);return`CAMP-${String(n+1).padStart(2,'0')}`}
$('clear').onclick=reset;
$('cardSearch').oninput=renderCards;
$('saveCard').onclick=async()=>{
  const x={code:$('code').value,name:$('name').value.trim(),endDate:$('endDate').value,url:$('url').value.trim(),active:$('active').checked};
  if(!x.name||!x.endDate||!x.url){$('cardNotice').textContent='すべて入力してください';return}
  const r=await req('/card/'+(editing||''),{method:editing?'PUT':'POST',body:JSON.stringify(x)});
  if(r.ok){await load();$('cardNotice').textContent='保存しました'}else $('cardNotice').textContent='保存できませんでした';
};
function renderCards(){
  const today=new Date().toISOString().slice(0,10),q=$('cardSearch').value.trim().toLowerCase();
  const shown=data.campaigns.filter(x=>!q||`${x.code} ${x.name}`.toLowerCase().includes(q));
  $('cardList').innerHTML=shown.length?shown.map(x=>`<article class="admin-item ${x.active?'':'is-private'}"><div><p><span class="status-badge ${x.active?'':'private'}">${x.active?(x.endDate<today?'終了':'公開'):'非公開'}</span> ${esc(x.code)}　<strong>${esc(x.name)}</strong></p><small>${esc(x.endDate)}</small></div><div class="item-actions"><button class="button" data-edit="${esc(x.code)}">編集</button><button class="button" data-copy="${esc(x.code)}">複製</button><button class="button" data-toggle="${esc(x.code)}">${x.active?'非公開':'公開'}</button><button class="button danger" data-delete="${esc(x.code)}">削除</button></div></article>`).join(''):'<p class="empty-message">該当するカードはありません</p>';
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>edit(b.dataset.edit));
  document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>copyCard(b.dataset.copy));
  document.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>toggleCard(b.dataset.toggle));
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>removeCard(b.dataset.delete));
}
function fillForm(x){$('name').value=x.name;$('endDate').value=x.endDate;$('url').value=x.url;$('active').checked=x.active;scrollTo({top:0,behavior:'smooth'})}
function edit(code){const x=data.campaigns.find(x=>x.code===code);editing=code;$('code').value=x.code;$('saveCard').textContent='変更を保存';fillForm(x)}
function copyCard(code){const x=data.campaigns.find(x=>x.code===code);editing=null;$('code').value=next();$('saveCard').textContent='複製して保存';fillForm(x);$('cardNotice').textContent='内容をコピーしました。必要な所を直して保存してください'}
async function toggleCard(code){const x=data.campaigns.find(x=>x.code===code);if(!x)return;const r=await req('/card/'+encodeURIComponent(code),{method:'PUT',body:JSON.stringify({...x,active:!x.active})});if(r.ok){await load();$('cardNotice').textContent=x.active?'非公開にしました':'公開しました'}else $('cardNotice').textContent='公開状態を変更できませんでした'}
async function removeCard(code){
  const x=data.campaigns.find(x=>x.code===code);
  if(!confirm(`${code}「${x?.name||''}」を完全に削除しますか？\nこの操作は取り消せません。`))return;
  const r=await req('/card/'+encodeURIComponent(code),{method:'DELETE'});
  if(r.ok)await load();else $('cardNotice').textContent='削除できませんでした';
}

function mutate(fn,message=''){history.push(snapshot());if(history.length>30)history.shift();fn();compactRows();selected=null;setDirty(true);renderLayout();if(message)$('layoutNotice').textContent=message}
function setDirty(v){dirty=v;$('dirtyState').textContent=v?'未保存':'保存済み';$('dirtyState').classList.toggle('dirty',v);$('undoLayout').disabled=!history.length}
document.querySelectorAll('[data-add-row]').forEach(b=>b.onclick=()=>addRow(data.layout.length,+b.dataset.addRow));
$('addSeparator').onclick=()=>addRow(data.layout.length,'separator');
$('compactLayout').onclick=()=>mutate(packGaps,'空きを前から詰めました（まだ未保存です）');
$('undoLayout').onclick=()=>{if(!history.length)return;data.layout=JSON.parse(history.pop());selected=null;setDirty(true);renderLayout();$('layoutNotice').textContent='1つ前の配置に戻しました'};
$('cancelMove').onclick=()=>{selected=null;renderLayout()};
function addRow(index,type){mutate(()=>data.layout.splice(index,0,type==='separator'?{id:uid(),type:'separator'}:{id:uid(),type:'cards',columns:type,codes:[]}),type==='separator'?'区切り線を追加しました':'新しい段を追加しました')}
function compactRows(){data.layout.forEach(r=>{if(r.codes)r.codes=r.codes.filter(Boolean).slice(0,r.columns)})}
function packGaps(){
  let start=0;
  for(let i=0;i<=data.layout.length;i++)if(i===data.layout.length||data.layout[i].type==='separator'){
    const rows=data.layout.slice(start,i).filter(r=>r.type==='cards'),codes=rows.flatMap(r=>r.codes||[]);let p=0;
    rows.forEach(r=>{r.codes=codes.slice(p,p+r.columns);p+=r.columns});start=i+1;
  }
}
function available(){const used=new Set(data.layout.flatMap(r=>r.codes||[]));return data.campaigns.filter(x=>!used.has(x.code))}
function cardHtml(x,where){return`<div class="layout-card ${x.active?'':'muted'} ${selected?.code===x.code?'selected':''}" data-drag-code="${esc(x.code)}" data-source="${where}" tabindex="0" role="button" aria-label="${esc(x.name)}を移動"><i class="drag-handle" aria-hidden="true">⠿</i><strong>${esc(x.code)}</strong><span>${esc(x.name)}</span><small>${esc(x.endDate.slice(5).replace('-','/'))}まで${x.active?'':'・非公開'}</small></div>`}
function renderLayout(){
  const loose=available();$('unplacedCount').textContent=`${loose.length}枚`;
  $('unplacedCards').innerHTML=loose.length?loose.map(x=>cardHtml(x,'unplaced')).join(''):'<p class="empty-message">未配置のカードはありません</p>';
  $('layoutEditor').innerHTML=data.layout.map((r,i)=>r.type==='separator'
    ?`${separatorHtml(i)}${insertHtml(i+1)}`
    :`${rowHtml(r,i)}${insertHtml(i+1)}`).join('')||'<p class="empty-message">上のボタンから段を追加してください</p>';
  const x=data.campaigns.find(c=>c.code===selected?.code);$('moveMode').classList.toggle('hidden',!x);$('moveCardName').textContent=x?`${x.code} ${x.name}`:'';
  bindLayout();bindDrag();setDirty(dirty);
}
function separatorHtml(i){return`<div class="layout-separator-admin" data-row="${i}"><div class="period-line"></div><div class="row-tools"><button data-row-up="${i}" aria-label="区切り線を上へ">↑</button><button data-row-down="${i}" aria-label="区切り線を下へ">↓</button><button data-row-delete="${i}">削除</button></div></div>`}
function rowHtml(r,i){return`<section class="layout-row-admin" data-row="${i}"><header><strong>${r.columns}枠の段</strong><div class="row-tools"><button data-columns="${i}" aria-label="枠数を変更">${r.columns===3?'4枠へ':'3枠へ'}</button><button data-row-up="${i}" aria-label="段を上へ">↑</button><button data-row-down="${i}" aria-label="段を下へ">↓</button><button data-row-delete="${i}">削除</button></div></header><div class="layout-slots" style="--columns:${r.columns}">${Array.from({length:r.columns},(_,s)=>slotHtml(r,i,s)).join('')}</div></section>`}
function insertHtml(index){return`<details class="insert-row"><summary>＋ この下に追加</summary><div><button data-insert="${index},3">3枠</button><button data-insert="${index},4">4枠</button><button data-insert="${index},separator">区切り線</button></div></details>`}
function slotHtml(r,ri,si){const code=r.codes[si],x=data.campaigns.find(c=>c.code===code);return`<div class="layout-drop ${x?'':'empty'} ${selected?'is-target':''}" data-target="${ri},${si}">${x?cardHtml(x,`${ri},${si}`):'<span>空き</span>'}${x?`<button class="unplace" data-unplace="${esc(code)}" aria-label="${esc(code)}の配置を解除">×</button>`:''}</div>`}
function bindLayout(){
  document.querySelectorAll('[data-row-up]').forEach(b=>b.onclick=()=>moveRow(+b.dataset.rowUp,-1));
  document.querySelectorAll('[data-row-down]').forEach(b=>b.onclick=()=>moveRow(+b.dataset.rowDown,1));
  document.querySelectorAll('[data-row-delete]').forEach(b=>b.onclick=()=>mutate(()=>data.layout.splice(+b.dataset.rowDelete,1),'段を削除しました'));
  document.querySelectorAll('[data-columns]').forEach(b=>b.onclick=()=>changeColumns(+b.dataset.columns));
  document.querySelectorAll('[data-insert]').forEach(b=>b.onclick=()=>{const [i,t]=b.dataset.insert.split(',');addRow(+i,t==='separator'?t:+t)});
  document.querySelectorAll('[data-unplace]').forEach(b=>b.onclick=e=>{e.stopPropagation();mutate(()=>removeFromLayout(b.dataset.unplace),'未配置カードへ移動しました')});
  document.querySelectorAll('.layout-card').forEach(el=>{
    el.onclick=e=>{if(e.target.closest('.unplace')||Date.now()<suppressClickUntil)return;chooseOrMove(el.dataset.dragCode,el.dataset.source)};
    el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseOrMove(el.dataset.dragCode,el.dataset.source)}};
  });
  document.querySelectorAll('.layout-drop.empty').forEach(el=>el.onclick=()=>{if(selected)moveSelected(el.dataset.target)});
}
function chooseOrMove(code,source){
  if(selected&&selected.code!==code){const el=document.querySelector(`[data-drag-code="${CSS.escape(code)}"]`);if(el?.closest('.layout-drop'))moveSelected(el.closest('.layout-drop').dataset.target);else{selected={code,source};renderLayout()}return}
  selected=selected?.code===code?null:{code,source};renderLayout();
}
function moveSelected(target){const [ri,si]=target.split(',').map(Number),d=selected;mutate(()=>moveCard(d.code,sourceParts(d.source),ri,si),'配置を変更しました（まだ未保存です）')}
function sourceParts(source){return source==='unplaced'?null:source.split(',').map(Number)}
function moveRow(i,d){const j=i+d;if(j<0||j>=data.layout.length)return;mutate(()=>[data.layout[i],data.layout[j]]=[data.layout[j],data.layout[i]],'段の位置を変更しました')}
function changeColumns(i){mutate(()=>{const r=data.layout[i];r.columns=r.columns===3?4:3;if(r.codes.length>r.columns)r.codes=r.codes.slice(0,r.columns)},'枠数を変更しました。あふれたカードは未配置へ移動しました')}
function removeFromLayout(code){for(const r of data.layout)if(r.codes){const i=r.codes.indexOf(code);if(i>=0)r.codes.splice(i,1)}}

function bindDrag(){document.querySelectorAll('.drag-handle').forEach(handle=>{
  const el=handle.closest('.layout-card');let timer,start,moved=false;
  handle.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();start={x:e.clientX,y:e.clientY};moved=false;timer=setTimeout(()=>beginDrag(el,e.clientX,e.clientY),360);handle.setPointerCapture?.(e.pointerId)};
  handle.onpointermove=e=>{if(!start)return;e.preventDefault();const distance=Math.hypot(e.clientX-start.x,e.clientY-start.y);if(timer&&distance>11){clearTimeout(timer);timer=null}if(drag){moved=true;updateDrag(e.clientX,e.clientY)}};
  handle.onpointerup=e=>{if(timer)clearTimeout(timer);timer=null;if(drag){moved=true;finishDrag(e.clientX,e.clientY)}start=null;if(moved)suppressClickUntil=Date.now()+450};
  handle.onpointercancel=()=>{if(timer)clearTimeout(timer);start=null;cancelDrag()};
})}
document.addEventListener('selectstart',e=>{if(e.target.closest?.('.layout-card'))e.preventDefault()});
document.addEventListener('contextmenu',e=>{if(e.target.closest?.('.layout-card'))e.preventDefault()});
function beginDrag(el,x,y){
  const box=el.getBoundingClientRect(),ghost=el.cloneNode(true);ghost.className='layout-card drag-ghost';ghost.removeAttribute('tabindex');ghost.style.width=`${box.width}px`;document.body.appendChild(ghost);
  drag={code:el.dataset.dragCode,source:el.dataset.source,ghost,x,y,scrollFrame:0};el.classList.add('dragging');document.body.classList.add('drag-mode');navigator.vibrate?.(30);updateDrag(x,y);autoScroll();
}
function updateDrag(x,y){if(!drag)return;drag.x=x;drag.y=y;drag.ghost.style.transform=`translate3d(${Math.min(innerWidth-drag.ghost.offsetWidth-6,Math.max(6,x-drag.ghost.offsetWidth/2))}px,${Math.max(6,y-52)}px,0)`;markTarget(x,y)}
function autoScroll(){if(!drag)return;const edge=86,max=12;let amount=0;if(drag.y<edge)amount=-max*(1-drag.y/edge);else if(drag.y>innerHeight-edge)amount=max*(1-(innerHeight-drag.y)/edge);if(amount)scrollBy(0,amount);drag.scrollFrame=requestAnimationFrame(autoScroll)}
function markTarget(x,y){document.querySelectorAll('.layout-drop').forEach(el=>el.classList.remove('drop-ready'));const el=document.elementFromPoint(x,y)?.closest('.layout-drop');if(el)el.classList.add('drop-ready')}
function finishDrag(x,y){const target=document.elementFromPoint(x,y)?.closest('.layout-drop'),d=drag;cancelDrag();if(!target)return;const [ri,si]=target.dataset.target.split(',').map(Number);mutate(()=>moveCard(d.code,sourceParts(d.source),ri,si),'配置を変更しました（まだ未保存です）')}
function cancelDrag(){if(!drag)return;cancelAnimationFrame(drag.scrollFrame);drag.ghost?.remove();document.querySelectorAll('.dragging,.drop-ready').forEach(el=>el.classList.remove('dragging','drop-ready'));document.body.classList.remove('drag-mode');drag=null}
function moveCard(code,source,ri,si){
  const to=data.layout[ri];if(!to||to.type!=='cards')return;
  if(source&&source[0]===ri){const row=to,from=source[1];if(from===si)return;const [item]=row.codes.splice(from,1);row.codes.splice(Math.min(si,row.codes.length),0,item);return}
  const target=to.codes[si];
  if(source){const from=data.layout[source[0]];from?.codes?.splice(source[1],1);if(target&&from)from.codes.splice(Math.min(source[1],from.codes.length),0,target)}
  if(target)to.codes[si]=code;else to.codes.splice(Math.min(si,to.codes.length),0,code);
}

$('saveLayout').onclick=async()=>{compactRows();const r=await req('/layout',{method:'PUT',body:JSON.stringify({layout:data.layout})});if(r.ok){history=[];setDirty(false);$('layoutNotice').textContent='配置を保存しました'}else $('layoutNotice').textContent='配置を保存できませんでした'};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
load();
