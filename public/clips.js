(function(){
'use strict';
const sources=[
 {league:'nfl',type:'Latest highlights',title:'NFL Video & Highlights',desc:'Latest NFL clips, top plays, game recaps, catches, runs, touchdowns, and defensive highlights from the league’s official video hub.',url:'https://www.nfl.com/videos/',tags:'nfl pro football latest clips catches runs touchdowns sacks interceptions recaps'},
 {league:'nfl',type:'Game recaps',title:'NFL Game Highlights',desc:'Official game-by-game highlight collections, including individual player plays and full matchup recaps.',url:'https://www.nfl.com/videos/channel/game-highlights-vc',tags:'nfl games recap matchup highlights touchdowns players'},
 {league:'college',type:'College football',title:'NCAA Official Video',desc:'Browse NCAA video coverage and choose Football in the sport selector for college football features and highlights.',url:'https://www.ncaa.com/video',tags:'college ncaa football fbs fcs highlights videos'},
 {league:'college',type:'Conference highlights',title:'ACC Digital Network',desc:'Official ACC conference video hub featuring football highlights, must-see moments, and original programming.',url:'https://theaccdn.com/',tags:'college acc football conference highlights must see moments'},
 {league:'college',type:'Conference highlights',title:'Big 12 Studios',desc:'Official Big 12 video hub with football highlights and conference programming.',url:'https://big12studios.com/',tags:'college big 12 football conference highlights'},
 {league:'college',type:'College football',title:'NCAA Football Video Search',desc:'Open the NCAA video library and explore its football coverage and latest official uploads.',url:'https://www.ncaa.com/video/football',tags:'college ncaa football video highlights'}
];
let league='all';
const feed=document.getElementById('clips-feed');
const search=document.getElementById('clips-search');
if(!feed)return;
function render(){const q=(search?.value||'').trim().toLowerCase();const list=sources.filter(s=>(league==='all'||s.league===league)&&(!q||(s.title+' '+s.desc+' '+s.type+' '+s.tags).toLowerCase().includes(q)));
 feed.innerHTML='';
 if(!list.length){feed.innerHTML='<div class="clips-empty">No official highlight sources match that search. Try another team, league, or play type.</div>';return;}
 list.forEach(s=>{const a=document.createElement('a');a.className='clips-card';a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';
 const top=document.createElement('div');top.className='clips-card-top';
 const l=document.createElement('span');l.className='clips-league-tag';l.textContent=s.league==='nfl'?'NFL':'COLLEGE';
 const ty=document.createElement('span');ty.className='clips-type-tag';ty.textContent=s.type.toUpperCase();top.append(l,ty);
 const middle=document.createElement('div');const play=document.createElement('div');play.className='clips-play';play.textContent='▶';const h=document.createElement('h3');h.textContent=s.title;const p=document.createElement('p');p.textContent=s.desc;middle.append(play,h,p);
 const bottom=document.createElement('div');bottom.className='clips-card-bottom';const label=document.createElement('span');label.textContent='WATCH AT OFFICIAL SOURCE';const arrow=document.createElement('span');arrow.textContent='↗';bottom.append(label,arrow);a.append(top,middle,bottom);feed.appendChild(a);
 });
}
document.querySelectorAll('.clips-filter').forEach(b=>b.addEventListener('click',()=>{league=b.dataset.league;document.querySelectorAll('.clips-filter').forEach(x=>x.classList.toggle('active',x===b));render();}));
search?.addEventListener('input',render);render();
})();
