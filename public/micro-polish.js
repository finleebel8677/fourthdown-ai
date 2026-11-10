/* GRIDIRON IQ small finishing touches: status, team identity, headshots, recent players, tooltips, refresh and resilient empty states. */
(() => {
"use strict";
const $=id=>document.getElementById(id);
const TEAM_IDS={ARI:22,ATL:1,BAL:33,BUF:2,CAR:29,CHI:3,CIN:4,CLE:5,DAL:6,DEN:7,DET:8,GB:9,HOU:34,IND:11,JAX:30,KC:12,LV:13,LAC:24,LAR:14,MIA:15,MIN:16,NE:17,NO:18,NYG:19,NYJ:20,PHI:21,PIT:23,SF:25,SEA:26,TB:27,TEN:10,WAS:28};
const TEAM_COLORS={ARI:"#97233f",ATL:"#a71930",BAL:"#241773",BUF:"#00338d",CAR:"#0085ca",CHI:"#c83803",CIN:"#fb4f14",CLE:"#ff3c00",DAL:"#003594",DEN:"#fb4f14",DET:"#0076b8",GB:"#203731",HOU:"#03202f",IND:"#002c5f",JAX:"#006778",KC:"#e31837",LV:"#a5acaf",LAC:"#0080c6",LAR:"#003594",MIA:"#008e97",MIN:"#4f2683",NE:"#002244",NO:"#d3bc8d",NYG:"#0b2265",NYJ:"#125740",PHI:"#004c54",PIT:"#ffb612",SF:"#aa0000",SEA:"#002244",TB:"#d50a0a",TEN:"#0c2340",WAS:"#5a1414"};
const NAME_TO_ABBR={};
const NAMES={ARI:"Arizona Cardinals",ATL:"Atlanta Falcons",BAL:"Baltimore Ravens",BUF:"Buffalo Bills",CAR:"Carolina Panthers",CHI:"Chicago Bears",CIN:"Cincinnati Bengals",CLE:"Cleveland Browns",DAL:"Dallas Cowboys",DEN:"Denver Broncos",DET:"Detroit Lions",GB:"Green Bay Packers",HOU:"Houston Texans",IND:"Indianapolis Colts",JAX:"Jacksonville Jaguars",KC:"Kansas City Chiefs",LV:"Las Vegas Raiders",LAC:"Los Angeles Chargers",LAR:"Los Angeles Rams",MIA:"Miami Dolphins",MIN:"Minnesota Vikings",NE:"New England Patriots",NO:"New Orleans Saints",NYG:"New York Giants",NYJ:"New York Jets",PHI:"Philadelphia Eagles",PIT:"Pittsburgh Steelers",SF:"San Francisco 49ers",SEA:"Seattle Seahawks",TB:"Tampa Bay Buccaneers",TEN:"Tennessee Titans",WAS:"Washington Commanders"};
Object.entries(NAMES).forEach(([a,n])=>NAME_TO_ABBR[n]=a);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function injectStyle(){if($("iq-micro-style"))return;const st=document.createElement("style");st.id="iq-micro-style";st.textContent=`
.iq-live-status{display:inline-flex;align-items:center;gap:7px;margin-left:12px;color:#9fb0c5;font-size:10px;letter-spacing:.5px;white-space:nowrap}
.iq-live-status .dot{width:8px;height:8px;border-radius:50%;background:#fbbf24;box-shadow:0 0 10px currentColor}
.iq-live-status.ok .dot{background:#39ff88}.iq-live-status.warn .dot{background:#ffb547}.iq-live-status.bad .dot{background:#fb7185}
.iq-header-team{display:none;align-items:center;gap:7px;margin-left:auto;margin-right:12px;padding:5px 8px;border:1px solid #34445c;background:#111c2d;color:#eaf3ff;font-size:10px}
.iq-header-team img{width:22px;height:22px;object-fit:contain}.iq-refresh{padding:7px 9px!important;font-size:10px!important;white-space:nowrap}
.iq-headshot{width:76px;height:76px;object-fit:cover;border-radius:50%;border:2px solid var(--iq-team-color,#00e5ff);background:#0b1421;display:block;margin:0 0 12px}
.iq-recent{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.iq-recent button{background:#101c2c;border:1px solid #2a3b51;color:#dce8f7;padding:7px 9px;border-radius:3px;font-size:10px}
.iq-retry{margin-top:10px}.iq-recent-wrap{margin-top:14px}
.card,.btn,.team-tile,.nav-btn,.iq-recent button{transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease,opacity .18s ease}
.card{animation:iqFadeUp .32s ease both}
@keyframes iqFadeUp{from{opacity:.72;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
.iq-chart-tooltip{position:fixed;z-index:1000;pointer-events:none;background:#07111f;border:1px solid #00e5ff;color:#eefaff;padding:7px 9px;font-size:11px;box-shadow:0 6px 20px #0009;display:none;max-width:220px}
@media(max-width:650px){.iq-live-status{margin-left:7px;font-size:9px}.iq-header-team{margin-left:auto;margin-right:5px;padding:4px}.iq-header-team span{display:none}.iq-refresh{padding:6px!important}.iq-headshot{width:64px;height:64px}}
`;document.head.appendChild(st)}
function headerControls(){
 const h=document.querySelector("header"),right=h?.querySelector(".header-right");if(!h||!right||$("iq-live-status"))return;
 const status=document.createElement("span");status.id="iq-live-status";status.className="iq-live-status warn";status.innerHTML='<i class="dot"></i><span>CHECKING DATA</span>';
 const team=document.createElement("div");team.id="iq-header-team";team.className="iq-header-team";
 const refresh=document.createElement("button");refresh.id="iq-manual-refresh";refresh.className="btn secondary iq-refresh";refresh.textContent="↻ REFRESH";
 right.insertAdjacentElement("afterend",status);status.insertAdjacentElement("afterend",team);team.insertAdjacentElement("afterend",refresh);
 refresh.addEventListener("click",manualRefresh);
}
function setStatus(kind,label){const el=$("iq-live-status");if(!el)return;el.className="iq-live-status "+kind;el.querySelector("span").textContent=label}
async function updateStatus(){
 try{const [st,p]=await Promise.all([fetch("/data/nfl-status.json?ts="+Date.now(),{cache:"no-store"}),fetch("/data/nfl-players.json?ts="+Date.now(),{cache:"no-store"})]);if(!st.ok||!p.ok)throw Error("Data feed unavailable");const d=await st.json(),players=await p.json();const t=new Date(d.retrievedAt),age=(Date.now()-t.getTime())/36e5;if(!Number.isFinite(age))throw Error("Timestamp missing");setStatus(age<=36?"ok":age<=48?"warn":"bad",age<=36?"DATA LIVE · "+Math.max(1,Math.round(age))+"H":age<=48?"DATA AGING":"DATA STALE");const detail=$("data-detail");if(detail)detail.textContent="Connected to "+(d.source||"verified data source")+" · refreshed "+t.toLocaleString()+" · "+(players.totalPlayers||players.players?.length||0).toLocaleString()+" player records.";return true}catch(e){setStatus("bad","DATA OFFLINE");return false}
}
async function manualRefresh(){
 const b=$("iq-manual-refresh");if(b){b.disabled=true;b.textContent="REFRESHING…"}
 setStatus("warn","REFRESHING DATA");
 try{
  if(typeof loadPlayers==="function")await loadPlayers();
  const ok=await updateStatus();
  document.dispatchEvent(new CustomEvent("gridiron:manual-refresh",{detail:{ok}}));
  if(b)b.textContent=ok?"✓ UPDATED":"RETRY";
 }catch(e){setStatus("bad","REFRESH FAILED");if(b)b.textContent="RETRY"}
 finally{if(b)setTimeout(()=>{b.disabled=false;b.textContent="↻ REFRESH"},1800)}
}
function favoriteTeamBadge(){
 const sel=$("favorite-team"),host=$("iq-header-team");if(!sel||!host)return;
 const apply=()=>{const ab=sel.value;if(!ab){host.style.display="none";document.documentElement.style.removeProperty("--iq-team-color");return}
 const color=TEAM_COLORS[ab]||"#00e5ff";document.documentElement.style.setProperty("--iq-team-color",color);host.style.borderColor=color+"99";host.style.display="inline-flex";host.innerHTML='<img src="https://a.espncdn.com/i/teamlogos/nfl/500/'+ab.toLowerCase()+'.png" alt="" onerror="this.style.display=\'none\'"><span>'+esc(NAMES[ab]||ab)+'</span>';
 document.querySelectorAll(".card.iq-feature").forEach(c=>c.style.borderLeft="2px solid "+color);
 };sel.addEventListener("change",apply);apply();
}
const rosterCache=new Map();
async function getHeadshot(player){
 const abbr=(player.teams||[]).find(t=>TEAM_IDS[t]);if(!abbr)return null;
 if(!rosterCache.has(abbr)){rosterCache.set(abbr,fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/"+TEAM_IDS[abbr]+"/roster",{cache:"force-cache"}).then(r=>r.ok?r.json():null).catch(()=>null))}
 const data=await rosterCache.get(abbr);const groups=data?.athletes||[];
 const athletes=groups.flatMap(g=>g.items||[g]).filter(x=>x&&x.fullName);
 const norm=s=>String(s||"").toLowerCase().replace(/[^a-z]/g,"");
 const match=athletes.find(a=>norm(a.fullName)===norm(player.name))||athletes.find(a=>norm(a.displayName)===norm(player.name));
 return match?.headshot?.href||match?.headshot||null;
}
function recentStore(){try{return JSON.parse(localStorage.getItem("gridironIQRecentPlayers")||"[]")}catch{return []}}
function saveRecent(p){
 if(!p?.name)return;let list=recentStore().filter(x=>x.id!==p.id);list.unshift({id:p.id,name:p.name,position:p.position,team:(p.teams||[])[0]||""});localStorage.setItem("gridironIQRecentPlayers",JSON.stringify(list.slice(0,6)));renderRecent();
}
function renderRecent(){
 let host=$("iq-recent-players");if(!host){const anchor=$("player-table")?.closest(".card");if(!anchor)return;host=document.createElement("div");host.id="iq-recent-players";host.className="iq-recent-wrap";host.innerHTML='<div class="panel-title">Recently Viewed Players</div><div class="iq-recent"></div>';anchor.appendChild(host)}
 const wrap=host.querySelector(".iq-recent");const list=recentStore();wrap.innerHTML=list.length?list.map(p=>'<button type="button" data-player-id="'+esc(p.id)+'">'+esc(p.name)+' · '+esc(p.position)+'</button>').join(""):'<span class="muted small">Player profiles you open will appear here on this device.</span>';
 wrap.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{const p=(window.loadedPlayerRows||[]).find(x=>String(x.id)===b.dataset.playerId);if(p){showPlayerHeadshot(p);saveRecent(p);$("player-search").value=p.name;if(typeof filterPlayers==="function")filterPlayers()}}));
}
async function showPlayerHeadshot(p){
 const host=$("scout-player-result");if(!host)return;saveRecent(p);
 const old=host.querySelector(".iq-headshot");if(old)old.remove();
 const url=await getHeadshot(p);if(!url||!host.isConnected)return;
 const img=document.createElement("img");img.className="iq-headshot";img.alt=esc(p.name)+" headshot";img.src=url;img.onerror=()=>img.remove();host.prepend(img);
}
function setupScoutingHeadshots(){
 const sel=$("scout-player-select");if(!sel)return;
 sel.addEventListener("change",()=>{const p=(window.iqPlayers||[]).find(x=>String(x.id)===sel.value)||(window.loadedPlayerRows||[]).find(x=>String(x.id)===sel.value);if(p)showPlayerHeadshot(p)});
 const table=$("player-table");if(table&&!table.dataset.iqRecent){table.dataset.iqRecent="1";table.addEventListener("click",e=>{const row=e.target.closest("tr");if(!row)return;const name=row.cells?.[0]?.textContent;const p=(window.loadedPlayerRows||[]).find(x=>x.name===name);if(p){saveRecent(p);const search=$("scout-player-search"),select=$("scout-player-select");if(search)search.value=p.name;if(select){const opt=[...select.options].find(o=>o.textContent.startsWith(p.name+" ·"));if(opt){select.value=opt.value;select.dispatchEvent(new Event("change"))}}}})}
 renderRecent();
}
function chartTooltips(){
 let tip=$("iq-chart-tooltip");if(!tip){tip=document.createElement("div");tip.id="iq-chart-tooltip";tip.className="iq-chart-tooltip";document.body.appendChild(tip)}
 document.querySelectorAll("svg").forEach(svg=>svg.querySelectorAll("rect,path,circle,line,polyline").forEach(el=>{
  const label=el.getAttribute("data-tooltip")||el.getAttribute("aria-label")||el.getAttribute("data-label")||el.querySelector("title")?.textContent;
  if(!label)return;el.setAttribute("tabindex","0");el.setAttribute("aria-label",label);if(!el.querySelector("title")){const title=document.createElementNS("http://www.w3.org/2000/svg","title");title.textContent=label;el.appendChild(title)}
  if(el.dataset.iqTip)return;el.dataset.iqTip="1";
  const show=e=>{tip.textContent=label;tip.style.display="block";const x=e.clientX||el.getBoundingClientRect().left,y=e.clientY||el.getBoundingClientRect().top;tip.style.left=Math.min(innerWidth-235,Math.max(8,x+10))+"px";tip.style.top=Math.min(innerHeight-55,Math.max(8,y+10))+"px"};
  el.addEventListener("pointerenter",show);el.addEventListener("pointermove",show);el.addEventListener("pointerleave",()=>tip.style.display="none");el.addEventListener("focus",show);el.addEventListener("blur",()=>tip.style.display="none");
 }));
}
function emptyStateRetries(){
 const targets=[["favorite-team-content",()=>{$("favorite-team")?.dispatchEvent(new Event("change"))}],["season-trends-content",()=>window.dispatchEvent(new Event("gridiron:players-loaded"))],["matchup-advantage-meter",()=>{$("prediction-game")?.dispatchEvent(new Event("change"))}],["scout-player-result",()=>{$("scout-player-select")?.dispatchEvent(new Event("change"))}]];
 targets.forEach(([id,fn])=>{const el=$(id);if(!el||el.dataset.iqRetry)return;const observer=new MutationObserver(()=>{const txt=el.textContent.toLowerCase();if((txt.includes("unavailable")||txt.includes("not available")||txt.includes("no weekly")||txt.includes("temporarily")||txt.includes("no model"))&&!el.querySelector(".iq-retry")){const b=document.createElement("button");b.className="btn secondary iq-retry";b.textContent="TRY AGAIN";b.addEventListener("click",fn);el.appendChild(b)}});observer.observe(el,{childList:true,subtree:true,characterData:true});el.dataset.iqRetry="1"});
}
function init(){injectStyle();headerControls();favoriteTeamBadge();setupScoutingHeadshots();emptyStateRetries();updateStatus();chartTooltips();const mo=new MutationObserver(()=>chartTooltips());mo.observe(document.body,{childList:true,subtree:true});document.addEventListener("gridiron:players-loaded",()=>{favoriteTeamBadge();renderRecent();chartTooltips()});document.addEventListener("gridiron:manual-refresh",()=>{favoriteTeamBadge();chartTooltips()})}
document.addEventListener("DOMContentLoaded",init);
})();
