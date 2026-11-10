(function(){
'use strict';
const sources=[
 {id:'nfl-latest',league:'nfl',type:'Latest highlights',title:'NFL Video & Highlights',desc:'Latest NFL clips, top plays, game recaps, catches, runs, touchdowns, and defensive highlights from the league’s official video hub.',url:'https://www.nfl.com/videos/',tags:'nfl pro football latest clips catches runs touchdowns sacks interceptions recaps'},
 {id:'nfl-games',league:'nfl',type:'Game recaps',title:'NFL Game Highlights',desc:'Official game-by-game highlight collections, including individual player plays and full matchup recaps.',url:'https://www.nfl.com/videos/channel/game-highlights-vc',tags:'nfl games recap matchup highlights touchdowns players'},
 {id:'ncaa-video',league:'college',type:'College football',title:'NCAA Official Video',desc:'Browse NCAA video coverage and choose Football in the sport selector for college football features and highlights.',url:'https://www.ncaa.com/video',tags:'college ncaa football fbs fcs highlights videos'},
 {id:'acc-video',league:'college',type:'Conference highlights',title:'ACC Digital Network',desc:'Official ACC conference video hub featuring football highlights, must-see moments, and original programming.',url:'https://theaccdn.com/',tags:'college acc football conference highlights must see moments'},
 {id:'big12-video',league:'college',type:'Conference highlights',title:'Big 12 Studios',desc:'Official Big 12 video hub with football highlights and conference programming.',url:'https://big12studios.com/',tags:'college big 12 football conference highlights'},
 {id:'ncaa-football',league:'college',type:'College football',title:'NCAA Football Video Search',desc:'Open the NCAA video library and explore its football coverage and latest official uploads.',url:'https://www.ncaa.com/video/football',tags:'college ncaa football video highlights'}
];
let league='all';
const feed=document.getElementById('clips-feed');
const search=document.getElementById('clips-search');
if(!feed)return;
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'')??fallback}catch(_){return fallback}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch(_){return false}};
let likes=read('gridironClipsLikes',{}),comments=read('gridironClipsComments',{});
const make=(tag,cls,txt)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(txt!==undefined)el.textContent=txt;return el};
function render(){const q=(search?.value||'').trim().toLowerCase();const list=sources.filter(s=>(league==='all'||s.league===league)&&(!q||(s.title+' '+s.desc+' '+s.type+' '+s.tags).toLowerCase().includes(q)));
 feed.innerHTML='';
 if(!list.length){feed.appendChild(make('div','clips-empty','No official highlight sources match that search. Try another team, league, or play type.'));return;}
 list.forEach(s=>{
  const card=make('article','clips-card');card.setAttribute('aria-label',s.title+' highlight channel');
  const watch=make('div','clips-watch');watch.setAttribute('aria-label','Highlight preview area. Double tap to like.');
  const top=make('div','clips-card-top');top.append(make('span','clips-league-tag',s.league==='nfl'?'NFL':'COLLEGE'),make('span','clips-type-tag',s.type.toUpperCase()));
  const middle=make('div','');middle.append(make('div','clips-play','▶'),make('h3','',s.title),make('p','',s.desc));
  const bottom=make('div','clips-card-bottom');bottom.append(make('span','','DOUBLE TAP TO LIKE'),make('span','','♥'));
  watch.append(top,middle,bottom);
  const watchLink=make('a','clips-watch-link','▶ Watch official source ↗');watchLink.href=s.url;watchLink.target='_blank';watchLink.rel='noopener noreferrer';watchLink.setAttribute('aria-label','Open '+s.title+' at official source');
  const social=make('div','clips-social');
  const liked=!!likes[s.id];
  const like=make('button',liked?'liked':'',(liked?'♥ Liked':'♡ Like'));like.type='button';like.setAttribute('aria-pressed',String(liked));
  const share=make('button','','↗ Share');share.type='button';
  const commentBtn=make('button','','▤ Comment ('+(comments[s.id]||[]).length+')');commentBtn.type='button';
  social.append(like,share,commentBtn);
  const toggleLike=()=>{likes[s.id]=!likes[s.id];if(!likes[s.id])delete likes[s.id];write('gridironClipsLikes',likes);like.classList.toggle('liked',!!likes[s.id]);like.textContent=likes[s.id]?'♥ Liked':'♡ Like';like.setAttribute('aria-pressed',String(!!likes[s.id]));};
  let lastTap=0;
  watch.addEventListener('pointerup',e=>{if(e.pointerType==='mouse')return;const now=Date.now();if(now-lastTap<330){e.preventDefault();toggleLike();watch.classList.add('clips-double-liked');setTimeout(()=>watch.classList.remove('clips-double-liked'),650);lastTap=0;}else lastTap=now;});
  watch.addEventListener('dblclick',e=>{e.preventDefault();toggleLike();watch.classList.add('clips-double-liked');setTimeout(()=>watch.classList.remove('clips-double-liked'),650);});
  const commentPanel=make('div','clips-comments');
  const commentList=make('div','clips-comment-list');
  const renderComments=()=>{commentList.innerHTML='';const rows=comments[s.id]||[];if(!rows.length)commentList.append(make('div','clips-comment-empty','No comments yet. Add the first note on this device.'));rows.forEach(c=>commentList.append(make('div','clips-comment',c)));commentBtn.textContent='▤ Comment ('+rows.length+')';};
  const form=make('form','clips-comment-form');const input=make('input','');input.type='text';input.maxLength=240;input.placeholder='Write a comment…';input.setAttribute('aria-label','Write a comment');const send=make('button','','Post');send.type='submit';form.append(input,send);commentPanel.append(commentList,form);renderComments();
  like.addEventListener('click',toggleLike);
  share.addEventListener('click',async()=>{const data={title:s.title,text:'Check out this official football highlight source on GRIDIRON IQ.',url:s.url};try{if(navigator.share)await navigator.share(data);else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(s.url);share.textContent='✓ Copied';setTimeout(()=>share.textContent='↗ Share',1800);}else{window.prompt('Copy this official highlight link:',s.url);}}catch(err){if(err?.name!=='AbortError'){try{window.prompt('Copy this official highlight link:',s.url);}catch(_){}}}});
  commentBtn.addEventListener('click',()=>{commentPanel.classList.toggle('open');if(commentPanel.classList.contains('open'))input.focus();});
  form.addEventListener('submit',e=>{e.preventDefault();const value=input.value.trim();if(!value)return;comments[s.id]=comments[s.id]||[];comments[s.id].push(value);if(!write('gridironClipsComments',comments)){comments[s.id].pop();return;}input.value='';renderComments();});
  card.append(watch,watchLink,social,commentPanel);feed.append(card);
 });
}
document.querySelectorAll('.clips-filter').forEach(b=>b.addEventListener('click',()=>{league=b.dataset.league;document.querySelectorAll('.clips-filter').forEach(x=>x.classList.toggle('active',x===b));render();}));
search?.addEventListener('input',render);render();
})();
