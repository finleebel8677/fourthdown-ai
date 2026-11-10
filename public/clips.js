(function(){
'use strict';
const feed=document.getElementById('clips-feed');
const search=document.getElementById('clips-search');
if(!feed)return;
let league='all',videos=[],observer=null,activeVideo='';
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'')??fallback}catch(_){return fallback}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch(_){return false}};
let likes=read('gridironClipsLikes',{}),comments=read('gridironClipsComments',{});
const make=(tag,cls,txt)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(txt!==undefined)el.textContent=txt;return el};
const dateLabel=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})};
function pauseCard(card){const frame=card.querySelector('iframe');if(frame)frame.remove();const play=card.querySelector('.clips-tap-play');if(play)play.hidden=false;}
function playCard(card){
 const id=card.dataset.videoId;if(!id||activeVideo===id&&card.querySelector('iframe'))return;
 document.querySelectorAll('.clip-card').forEach(other=>{if(other!==card)pauseCard(other)});
 activeVideo=id;
 const frame=document.createElement('iframe');
 frame.src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)+'?autoplay=1&mute=1&playsinline=1&controls=1&rel=0&modestbranding=1';
 frame.title=card.dataset.title||'Official football highlight';
 frame.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
 frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
 card.querySelector('.clips-player').append(frame);
 const play=card.querySelector('.clips-tap-play');if(play)play.hidden=true;
}
function render(){
 if(observer){observer.disconnect();observer=null}
 const q=(search?.value||'').trim().toLowerCase();
 const list=videos.filter(v=>(league==='all'||v.league===league)&&(!q||(v.title+' '+v.channel+' '+v.league).toLowerCase().includes(q)));
 feed.innerHTML='';activeVideo='';
 if(!list.length){feed.append(make('div','clips-empty',videos.length?'No official videos match that search. Try another league or search term.':'No official videos are available right now. Tap Refresh to try again.'));return}
 list.forEach((v,index)=>{
  const card=make('article','clips-card clip-card');card.dataset.videoId=v.videoId;card.dataset.title=v.title;
  const player=make('div','clips-player');
  const poster=make('img','clips-poster');poster.src=v.thumbnail;poster.alt='Thumbnail for '+v.title;poster.loading=index<2?'eager':'lazy';
  const tap=make('button','clips-tap-play','▶ Tap to play');tap.type='button';tap.addEventListener('click',()=>playCard(card));
  player.append(poster,tap);
  const top=make('div','clips-video-top');top.append(make('span','clips-league-tag',v.league==='nfl'?'NFL':'COLLEGE'),make('span','clips-channel',v.channel));
  const meta=make('div','clips-video-meta');meta.append(make('h3','',v.title),make('p','',v.channel+' · '+dateLabel(v.published)));
  const actions=make('div','clips-social clips-video-social');
  const liked=!!likes[v.id];
  const like=make('button',liked?'liked':'',liked?'♥':'♡');like.type='button';like.title='Like';like.setAttribute('aria-label','Like video');like.setAttribute('aria-pressed',String(liked));
  const share=make('button','','↗');share.type='button';share.title='Share';share.setAttribute('aria-label','Share video');
  const commentBtn=make('button','','▤');commentBtn.type='button';commentBtn.title='Comments';commentBtn.setAttribute('aria-label','Comments');
  actions.append(like,share,commentBtn);
  const panel=make('div','clips-comments clips-video-comments');const listEl=make('div','clips-comment-list');
  const form=make('form','clips-comment-form');const input=make('input','');input.type='text';input.maxLength=240;input.placeholder='Add a comment on this device…';input.setAttribute('aria-label','Add comment');const send=make('button','','Post');send.type='submit';form.append(input,send);panel.append(listEl,form);
  const refreshComments=()=>{listEl.innerHTML='';const rows=comments[v.id]||[];if(!rows.length)listEl.append(make('div','clips-comment-empty','No comments yet on this device.'));rows.forEach(c=>listEl.append(make('div','clips-comment',c)));};
  refreshComments();
  like.addEventListener('click',()=>{likes[v.id]=!likes[v.id];if(!likes[v.id])delete likes[v.id];write('gridironClipsLikes',likes);like.classList.toggle('liked',!!likes[v.id]);like.textContent=likes[v.id]?'♥':'♡';like.setAttribute('aria-pressed',String(!!likes[v.id]));});
  share.addEventListener('click',async()=>{const data={title:v.title,text:'Official football video from '+v.channel,url:v.url};try{if(navigator.share)await navigator.share(data);else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(v.url);share.textContent='✓';setTimeout(()=>share.textContent='↗',1500)}else window.prompt('Copy video link:',v.url)}catch(e){if(e?.name!=='AbortError')window.prompt('Copy video link:',v.url)}});
  commentBtn.addEventListener('click',()=>{panel.classList.toggle('open');if(panel.classList.contains('open'))input.focus()});
  form.addEventListener('submit',e=>{e.preventDefault();const value=input.value.trim();if(!value)return;comments[v.id]=comments[v.id]||[];comments[v.id].push(value);if(write('gridironClipsComments',comments)){input.value='';refreshComments()}else comments[v.id].pop()});
  const doubleTap=(()=>{let last=0;return()=>{const now=Date.now();if(now-last<330){like.click();card.classList.add('clips-liked-pop');setTimeout(()=>card.classList.remove('clips-liked-pop'),550);last=0}else last=now}})();
  card.addEventListener('pointerup',e=>{if(e.pointerType!=='mouse'&&!e.target.closest('button'))doubleTap()});
  card.append(player,top,meta,actions,panel);feed.append(card);
 });
 if('IntersectionObserver'in window){
  observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting&&entry.intersectionRatio>=.72)playCard(entry.target);else if(entry.target.dataset.videoId===activeVideo)pauseCard(entry.target)})},{root:feed,threshold:[0,.25,.72,1]});
  feed.querySelectorAll('.clip-card').forEach(card=>observer.observe(card));
 }else{
  feed.querySelectorAll('.clip-card').forEach(card=>card.querySelector('.clips-tap-play').hidden=false);
 }
}
async function loadVideos(){
 const status=document.getElementById('clips-status');if(status)status.textContent='Loading official NFL and college videos…';
 const refresh=document.getElementById('clips-refresh');if(refresh){refresh.disabled=true;refresh.textContent='Loading…'}
 try{
  const response=await fetch('/api/clips',{headers:{'Accept':'application/json'},cache:'no-store'});
  if(!response.ok)throw new Error('Video feed returned HTTP '+response.status);
  const data=await response.json();videos=Array.isArray(data.videos)?data.videos:[];
  if(status)status.textContent=videos.length+' official videos · Updated '+new Date(data.updatedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
  render();
 }catch(error){
  if(status)status.textContent='Could not load official videos. '+(error?.message||'Try again.');
  feed.innerHTML='';feed.append(make('div','clips-empty','The official video feeds could not be reached. Check your connection and tap Refresh.'));
 }finally{if(refresh){refresh.disabled=false;refresh.textContent='↻ Refresh'}}
}
document.querySelectorAll('.clips-filter').forEach(button=>button.addEventListener('click',()=>{league=button.dataset.league;document.querySelectorAll('.clips-filter').forEach(x=>x.classList.toggle('active',x===button));render()}));
search?.addEventListener('input',render);
document.getElementById('clips-refresh')?.addEventListener('click',loadVideos);
loadVideos();
})();