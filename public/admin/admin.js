let data={campaigns:[],layout:[]},editing=null,history=[],dirty=false,drag=null;
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
  history=[];setDirty(false);reset();renderCards();renderLayout();
}
function pack(codes,n){const a=[];for(let i=0;i<codes.length;i+=n)a.push({id:uid(),type:'cards',columns:n,codes:codes.slice(i,i+n)});return a}
function tab(name){const card=name==='card';$('cardPanel').classList.toggle('hidden',!card);$('layoutPanel').classList.toggle('hidden',card);$('cardTab').classList.toggle('primary',card);$('layoutTab').classList.toggle('primary',!card)}
$('cardTab').onclick=()=>tab('card');$('layoutTab').onclick=()=>tab('layout');

function reset(){editing=null;$('code').value=next();$('name').value=$('endDate').value=$('url').value='';$('active').checked=true;$('cardNotice').textContent=''}
function next(){const n=data.campaigns.reduce((m,x)=>Math.max(m,Number(x.code.replace(/\D/g,''))||0),0);return`CAMP-${String(n+1).padStart(2,'0')}`}
$('clear').onclick=reset;
$('saveCard').onclick=async()=>{
  const x={code:$('code').value,name:$('name').value.trim(),endDate:$('endDate').value,url:$('url').value.trim(),active:$('active').checked};
  if(!x.name||!x.endDate||!x.url){$('cardNotice').textContent='すべて入力してください';return}
  const r=await req('/card/'+(editing||''),{method:editing?'PUT':'POST',body:JSON.stringify(x)});
  if(r.ok){await load();$('cardNotice').textContent='保存しました'}else $('cardNotice').textContent='保存できませんでした';
};
function renderCards(){
  const today=new Date().toISOString().slice(0,10);
  $('cardList').innerHTML=data.campaigns.map(x=>`<article class="admin-item ${x.active?'':'is-private'}"><div><p><span class="status-badge ${x.active?'':'private'}">${x.active?(x.endDate<today?'終了':'公開'):'非公開'}</span> ${esc(x.code)}　<strong>${esc(x.name)}</strong></p><small>${esc(x.endDate)}</small></div><div class="item-actions"><button class="button" data-edit="${esc(x.code)}">編集</button><button class="button danger" data-delete="${esc(x.code)}">削除</button></div></article>`).join('');
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>edit(b.dataset.edit));
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>removeCard(b.dataset.delete));
}
function edit(c){const x=data.campaigns.find(x=>x.code===c);editing=c;$('code').value=x.code;$('name').value=x.name;$('endDate').value=x.endDate;$('url').value=x.url;$('active').checked=x.active;scrollTo({top:0,behavior:'smooth'})}
async function removeCard(code){
  const x=data.campaigns.find(x=>x.code===code);
  if(!confirm(`${code}「${x?.name||''}」を完全に削除しますか？\nこの操作は取り消せません。`))return;
  const r=await req('/card/'+encodeURIComponent(code),{method:'DELETE'});
  if(r.ok)await load();else $('cardNotice').textContent='削除できませんでした';
}

function mutate(fn){history.push(snapshot());if(history.length>30)history.shift();fn();compact();setDirty(true);renderLayout()}
function setDirty(v){dirty=v;$('dirtyState').textContent=v?'未保存':'保存済み';$('dirtyState').classList.toggle('dirty',v);$('undoLayout').disabled=!history.length}
document.querySelectorAll('[data-add-row]').forEach(b=>b.onclick=()=>mutate(()=>data.layout.push({id:uid(),type:'cards',columns:+b.dataset.addRow,codes:[]})));
$('addSeparator').onclick=()=>mutate(()=>data.layout.push({id:uid(),type:'separator'}));
$('undoLayout').onclick=()=>{if(!history.length)return;data.layout=JSON.parse(history.pop());setDirty(true);renderLayout()};
function compact(){data.layout.forEach(r=>{if(r.codes)r.codes=r.codes.filter(Boolean).slice(0,r.columns)})}
function available(){const used=new Set(data.layout.flatMap(r=>r.codes||[]));return data.campaigns.filter(x=>!used.has(x.code))}
function cardHtml(x,where){return`<div class="layout-card ${x.active?'':'muted'}" data-drag-code="${esc(x.code)}" data-source="${where}"><strong>${esc(x.code)}</strong><span>${esc(x.name)}</span><small>${esc(x.endDate.slice(5).replace('-','/'))}まで${x.active?'':'・非公開'}</small></div>`}
function renderLayout(){
  const loose=available();$('unplacedCount').textContent=`${loose.length}枚`;
  $('unplacedCards').innerHTML=loose.length?loose.map(x=>cardHtml(x,'unplaced')).join(''):'<p class="empty-message">未配置のカードはありません</p>';
  $('layoutEditor').innerHTML=data.layout.map((r,i)=>r.type==='separator'
    ?`<div class="layout-separator-admin" data-row="${i}"><div class="period-line"></div><div class="row-tools"><button data-row-up="${i}" aria-label="区切り線を上へ">↑</button><button data-row-down="${i}" aria-label="区切り線を下へ">↓</button><button data-row-delete="${i}">削除</button></div></div>`
    :`<section class="layout-row-admin" data-row="${i}"><header><strong>${r.columns}枠の段</strong><div class="row-tools"><button data-row-up="${i}" aria-label="段を上へ">↑</button><button data-row-down="${i}" aria-label="段を下へ">↓</button><button data-row-delete="${i}">段を削除</button></div></header><div class="layout-slots" style="--columns:${r.columns}">${Array.from({length:r.columns},(_,s)=>slotHtml(r,i,s)).join('')}</div></section>`).join('')||'<p class="empty-message">上のボタンから段を追加してください</p>';
  bindLayout();bindDrag();setDirty(dirty);
}
function slotHtml(r,ri,si){const code=r.codes[si],x=data.campaigns.find(c=>c.code===code);return`<div class="layout-drop ${x?'':'empty'}" data-target="${ri},${si}">${x?cardHtml(x,`${ri},${si}`):'<span>空き</span>'}${x?`<button class="unplace" data-unplace="${esc(code)}" aria-label="${esc(code)}の配置を解除">×</button>`:''}</div>`}
function bindLayout(){
  document.querySelectorAll('[data-row-up]').forEach(b=>b.onclick=()=>moveRow(+b.dataset.rowUp,-1));
  document.querySelectorAll('[data-row-down]').forEach(b=>b.onclick=()=>moveRow(+b.dataset.rowDown,1));
  document.querySelectorAll('[data-row-delete]').forEach(b=>b.onclick=()=>mutate(()=>data.layout.splice(+b.dataset.rowDelete,1)));
  document.querySelectorAll('[data-unplace]').forEach(b=>b.onclick=e=>{e.stopPropagation();mutate(()=>removeFromLayout(b.dataset.unplace))});
}
function moveRow(i,d){const j=i+d;if(j<0||j>=data.layout.length)return;mutate(()=>[data.layout[i],data.layout[j]]=[data.layout[j],data.layout[i]])}
function removeFromLayout(code){for(const r of data.layout)if(r.codes){const i=r.codes.indexOf(code);if(i>=0)r.codes.splice(i,1)}}

function bindDrag(){document.querySelectorAll('[data-drag-code]').forEach(el=>{
  let timer,start;
  el.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();start={x:e.clientX,y:e.clientY};timer=setTimeout(()=>beginDrag(el,e),420);el.setPointerCapture?.(e.pointerId)};
  el.onpointermove=e=>{e.preventDefault();if(timer&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>9){clearTimeout(timer);timer=null}if(drag)markTarget(e.clientX,e.clientY)};
  el.onpointerup=e=>{if(timer)clearTimeout(timer);timer=null;if(drag)finishDrag(e.clientX,e.clientY)};
  el.onpointercancel=()=>{if(timer)clearTimeout(timer);cancelDrag()};
})}
document.addEventListener('selectstart',e=>{if(e.target.closest?.('.layout-card'))e.preventDefault()});
document.addEventListener('contextmenu',e=>{if(e.target.closest?.('.layout-card'))e.preventDefault()});
function beginDrag(el,e){drag={code:el.dataset.dragCode,source:el.dataset.source};el.classList.add('dragging');document.body.classList.add('drag-mode');navigator.vibrate?.(30);markTarget(e.clientX,e.clientY)}
function markTarget(x,y){document.querySelectorAll('.layout-drop').forEach(el=>el.classList.remove('drop-ready'));const el=document.elementFromPoint(x,y)?.closest('.layout-drop');if(el)el.classList.add('drop-ready')}
function finishDrag(x,y){const target=document.elementFromPoint(x,y)?.closest('.layout-drop');const d=drag;cancelDrag();if(!target)return;const [ri,si]=target.dataset.target.split(',').map(Number),to=data.layout[ri];const source=d.source==='unplaced'?null:d.source.split(',').map(Number);if(source&&data.layout[source[0]]?.columns!==to.columns){$('layoutNotice').textContent='3枠は3枠へ、4枠は4枠へ移動してください';return}mutate(()=>moveCard(d.code,source,ri,si));$('layoutNotice').textContent='配置を変更しました（まだ未保存です）'}
function cancelDrag(){document.querySelectorAll('.dragging,.drop-ready').forEach(el=>el.classList.remove('dragging','drop-ready'));document.body.classList.remove('drag-mode');drag=null}
function moveCard(code,source,ri,si){
  const to=data.layout[ri],target=to.codes[si];
  if(source&&source[0]===ri){const row=to,from=source[1];if(from===si)return;[row.codes[from],row.codes[si]]=[row.codes[si],row.codes[from]];return}
  removeFromLayout(code);
  if(source&&target){const from=data.layout[source[0]];from.codes.splice(source[1],0,target);from.codes=from.codes.slice(0,from.columns)}
  else if(target)to.codes.splice(si,1);
  to.codes.splice(si,0,code);to.codes=to.codes.slice(0,to.columns);
}

$('saveLayout').onclick=async()=>{compact();const r=await req('/layout',{method:'PUT',body:JSON.stringify({layout:data.layout})});if(r.ok){history=[];setDirty(false);$('layoutNotice').textContent='配置を保存しました'}else $('layoutNotice').textContent='配置を保存できませんでした'};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
load();
