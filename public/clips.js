(function(){
'use strict';
const feed=document.getElementById('clips-feed'),search=document.getElementById('clips-search');
if(!feed)return;
let league='all',videos=[],observer=null,activeVideo='',socialEnabled=false,likeCounts={},commentsByVideo={},socialBusy=false,soundEnabled=true;
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'')??fallback}catch(_){return fallback}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch(_){return false}};
let likes=read('gridironClipsLikes',{});
let userId=read('gridironClipsUserId','');
if(!userId){userId='fan_'+(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now());write('gridironClipsUserId',userId);}
const make=(tag,cls,txt)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(txt!==undefined)el.textContent=txt;return el};
const dateLabel=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})};
function pauseCard(card){const frame=card.querySelector('iframe');if(frame)frame.remove();const play=card.querySelector('.clips-tap-play');if(play)play.hidden=false;}
function playCard(card){
 const id=card.dataset.videoId;if(!id||activeVideo===id&&card.querySelector('iframe'))return;
 document.querySelectorAll('.clip-card').forEach(other=>{if(other!==card)pauseCard(other)});
 activeVideo=id;const frame=document.createElement('iframe');
 frame.src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)+'?autoplay=1&mute='+(soundEnabled?'0':'1')+'&playsinline=1&controls=1&rel=0&modestbranding=1';
 frame.title=card.dataset.title||'Official football highlight';frame.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
 card.querySelector('.clips-player').append(frame);const play=card.querySelector('.clips-tap-play');if(play)play.hidden=true;
}
async function loadSocial(){
 if(!videos.length)return;
 try{
  const ids=videos.map(v=>v.videoId).filter(Boolean);
  const response=await fetch('/api/clips-social?videoIds='+encodeURIComponent(ids.join(',')),{cache:'no-store'});
  if(!response.ok)throw new Error('Shared activity is not configured');
  const data=await response.json();socialEnabled=!!data.enabled;likeCounts={};commentsByVideo={};
  const rows=data.likes||[];
  rows.forEach(row=>{likeCounts[row.video_id]=(likeCounts[row.video_id]||0)+1;});
  if(socialEnabled){
   const mine=new Set(rows.filter(row=>row.user_id===userId).map(row=>row.video_id));
   for(const videoId of Object.keys(likes).filter(id=>likes[id]&&!mine.has(id)&&videos.some(v=>v.videoId===id))){
    try{await postSocial({action:'like',videoId,liked:true});rows.push({video_id:videoId,user_id:userId});likeCounts[videoId]=(likeCounts[videoId]||0)+1;}catch(_){}
   }
  }
  (data.comments||[]).forEach(row=>{(commentsByVideo[row.video_id]??=[]).push(row);});
 }catch(_){socialEnabled=false;}
}
async function postSocial(payload){
 const response=await fetch('/api/clips-social',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,userId})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||'Shared social features are not connected yet.');
 return data;
}
function render(){
 if(observer){observer.disconnect();observer=null}
 const q=(search?.value||'').trim().toLowerCase();
 let list=videos.filter(v=>(league==='my-likes'?!!likes[v.videoId]:(league==='all'||v.league===league))&&(!q||(v.title+' '+v.channel+' '+v.league).toLowerCase().includes(q)));
 feed.innerHTML='';activeVideo='';
 if(!list.length){feed.append(make('div','clips-empty',league==='my-likes'?'You have not liked any clips yet. Tap the heart on a clip and it will appear here.':videos.length?'No official videos match that search. Try another league or search term.':'No official videos are available right now. Tap Refresh to try again.'));return}
 list.forEach((v,index)=>{
  const card=make('article','clips-card clip-card');card.dataset.videoId=v.videoId;card.dataset.title=v.title;
  const player=make('div','clips-player'),poster=make('img','clips-poster');poster.src=v.thumbnail;poster.alt='Thumbnail for '+v.title;poster.loading=index<2?'eager':'lazy';
  const tap=make('button','clips-tap-play',soundEnabled?'▶ Tap to play with sound':'▶ Tap to play');tap.type='button';tap.addEventListener('click',()=>{soundEnabled=true;playCard(card)});player.append(poster,tap);
  const sound=make('button','clips-sound-toggle','🔊 Sound on');sound.type='button';sound.title='Toggle clip sound';sound.addEventListener('click',()=>{soundEnabled=!soundEnabled;sound.textContent=soundEnabled?'🔊 Sound on':'🔇 Sound off';const frame=card.querySelector('iframe');if(frame){const id=v.videoId;frame.src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)+'?autoplay=1&mute='+(soundEnabled?'0':'1')+'&playsinline=1&controls=1&rel=0&modestbranding=1';}document.querySelectorAll('.clips-sound-toggle').forEach(btn=>btn.textContent=soundEnabled?'🔊 Sound on':'🔇 Sound off');});
  const top=make('div','clips-video-top');top.append(make('span','clips-league-tag',v.league==='nfl'?'NFL':'COLLEGE'),make('span','clips-channel',v.channel),sound);
  const meta=make('div','clips-video-meta');meta.append(make('h3','',v.title),make('p','',v.channel+' · '+dateLabel(v.published)));
  const sourceLink=make('a','clips-open-source','Open in YouTube ↗');sourceLink.href=v.url;sourceLink.target='_blank';sourceLink.rel='noopener noreferrer';
  const actions=make('div','clips-social clips-video-social'),like=make('button',likes[v.videoId]?'liked':'',likes[v.videoId]?'♥':'♡');
  like.type='button';like.title='Like';like.setAttribute('aria-label','Like video');like.setAttribute('aria-pressed',String(!!likes[v.videoId]));
  const count=make('span','clips-like-count',String(likeCounts[v.videoId]||0)+' likes');
  const share=make('button','','↗');share.type='button';share.title='Share';share.setAttribute('aria-label','Share video');
  const commentBtn=make('button','','▤ Comments ('+((commentsByVideo[v.videoId]||[]).length)+')');commentBtn.type='button';
  actions.append(like,count,share,commentBtn);
  const panel=make('div','clips-comments clips-video-comments'),listEl=make('div','clips-comment-list'),form=make('form','clips-comment-form');
  const input=make('input','');input.type='text';input.maxLength=240;input.placeholder=socialEnabled?'Add a public comment…':'Comments require shared database setup';input.disabled=!socialEnabled;input.setAttribute('aria-label','Add comment');
  const send=make('button','','Post');send.type='submit';send.disabled=!socialEnabled;form.append(input,send);panel.append(listEl,form);
  const refreshComments=()=>{listEl.innerHTML='';const rows=commentsByVideo[v.videoId]||[];if(!rows.length)listEl.append(make('div','clips-comment-empty',socialEnabled?'No comments yet. Be the first!':'Shared comments are waiting for database setup.'));rows.forEach(c=>{const row=make('div','clips-comment');row.append(make('span','clips-comment-body',c.body),make('small','clips-comment-date',dateLabel(c.created_at)));listEl.append(row);});};
  refreshComments();
  like.addEventListener('click',async()=>{
   if(socialBusy)return;
   const next=!likes[v.videoId],previous=!!likes[v.videoId];likes[v.videoId]=next;if(!next)delete likes[v.videoId];write('gridironClipsLikes',likes);
   like.classList.toggle('liked',next);like.textContent=next?'♥':'♡';like.setAttribute('aria-pressed',String(next));count.textContent=Math.max(0,(likeCounts[v.videoId]||0)+(next?1:-1))+' likes';
   if(!socialEnabled){likeCounts[v.videoId]=Math.max(0,(likeCounts[v.videoId]||0)+(next?1:-1));return;}
   socialBusy=true;try{await postSocial({action:'like',videoId:v.videoId,liked:next});likeCounts[v.videoId]=Math.max(0,(likeCounts[v.videoId]||0)+(next?1:-1));}
   catch(error){if(previous)likes[v.videoId]=true;else delete likes[v.videoId];write('gridironClipsLikes',likes);like.classList.toggle('liked',previous);like.textContent=previous?'♥':'♡';like.setAttribute('aria-pressed',String(previous));count.textContent=(likeCounts[v.videoId]||0)+' likes';if(status)status.textContent=error.message;}
   finally{socialBusy=false;}
  });
  share.addEventListener('click',async()=>{const data={title:v.title,text:'Official football video from '+v.channel,url:v.url};try{if(navigator.share)await navigator.share(data);else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(v.url);share.textContent='✓';setTimeout(()=>share.textContent='↗',1500)}else window.prompt('Copy video link:',v.url)}catch(e){if(e?.name!=='AbortError')window.prompt('Copy video link:',v.url)}});
  commentBtn.addEventListener('click',()=>{panel.classList.toggle('open');if(panel.classList.contains('open'))input.focus()});
  form.addEventListener('submit',async e=>{e.preventDefault();const value=input.value.trim();if(!value||!socialEnabled)return;send.disabled=true;try{const data=await postSocial({action:'comment',videoId:v.videoId,body:value});(commentsByVideo[v.videoId]??=[]).unshift(data.comment);input.value='';refreshComments();commentBtn.textContent='▤ Comments ('+commentsByVideo[v.videoId].length+')';}catch(error){if(status)status.textContent=error.message;}finally{send.disabled=false;}});
  const doubleTap=(()=>{let last=0;return()=>{const now=Date.now();if(now-last<330){like.click();card.classList.add('clips-liked-pop');setTimeout(()=>card.classList.remove('clips-liked-pop'),550);last=0}else last=now}})();
  card.addEventListener('pointerup',e=>{if(e.pointerType!=='mouse'&&!e.target.closest('button'))doubleTap()});
  card.append(player,top,meta,sourceLink,actions,panel);feed.append(card);
 });
 if('IntersectionObserver'in window){observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting&&entry.intersectionRatio>=.72)playCard(entry.target);else if(entry.target.dataset.videoId===activeVideo)pauseCard(entry.target)})},{root:feed,threshold:[0,.25,.72,1]});feed.querySelectorAll('.clip-card').forEach(card=>observer.observe(card));}
}
const status=document.getElementById('clips-status');
async function loadVideos(){
 if(status)status.textContent='Checking official NFL and college uploads…';
 const refresh=document.getElementById('clips-refresh');if(refresh){refresh.disabled=true;refresh.textContent='Loading…'}
 try{
  const response=await fetch('/api/clips',{headers:{'Accept':'application/json'},cache:'no-store'});if(!response.ok)throw new Error('Video feed returned HTTP '+response.status);
  const data=await response.json();videos=Array.isArray(data.videos)?data.videos:[];
  await loadSocial();
  const when=new Date(data.updatedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  if(status)status.textContent=videos.length+' saved official clips · Checked '+when+(data.archiveEnabled?' · archive on':' · archive setup needed')+(socialEnabled?' · shared likes/comments on':' · shared likes/comments setup needed');
  render();
 }catch(error){if(status)status.textContent='Could not load official videos. '+(error?.message||'Try again.');feed.innerHTML='';feed.append(make('div','clips-empty','The official video feeds could not be reached. Check your connection and tap Refresh.'));}
 finally{if(refresh){refresh.disabled=false;refresh.textContent='↻ Refresh'}}
}
document.querySelectorAll('.clips-filter').forEach(button=>button.addEventListener('click',()=>{league=button.dataset.league;document.querySelectorAll('.clips-filter').forEach(x=>x.classList.toggle('active',x===button));render()}));
search?.addEventListener('input',render);
document.getElementById('clips-refresh')?.addEventListener('click',loadVideos);
let lastRefresh=Date.now();setInterval(()=>{if(Date.now()-lastRefresh>=2*60*60*1000){lastRefresh=Date.now();loadVideos();}},60*1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastRefresh>=2*60*60*1000){lastRefresh=Date.now();loadVideos();}});
const originalLoad=loadVideos;loadVideos=async function(){lastRefresh=Date.now();return originalLoad();};
loadVideos();
})();
