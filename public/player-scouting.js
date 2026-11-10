/* GRIDIRON IQ — NFL-only Player Scouting
   Uses only fields present in the verified nflverse player feed and published NGS file.
   Watchlist is private to this browser/device. No college prospects or invented grades. */
(() => {
"use strict";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const TEAM_NAMES={ARI:"Arizona Cardinals",ATL:"Atlanta Falcons",BAL:"Baltimore Ravens",BUF:"Buffalo Bills",CAR:"Carolina Panthers",CHI:"Chicago Bears",CIN:"Cincinnati Bengals",CLE:"Cleveland Browns",DAL:"Dallas Cowboys",DEN:"Denver Broncos",DET:"Detroit Lions",GB:"Green Bay Packers",HOU:"Houston Texans",IND:"Indianapolis Colts",JAX:"Jacksonville Jaguars",KC:"Kansas City Chiefs",LV:"Las Vegas Raiders",LAC:"Los Angeles Chargers",LAR:"Los Angeles Rams",MIA:"Miami Dolphins",MIN:"Minnesota Vikings",NE:"New England Patriots",NO:"New Orleans Saints",NYG:"New York Giants",NYJ:"New York Jets",PHI:"Philadelphia Eagles",PIT:"Pittsburgh Steelers",SF:"San Francisco 49ers",SEA:"Seattle Seahawks",TB:"Tampa Bay Buccaneers",TEN:"Tennessee Titans",WAS:"Washington Commanders"};
const TEAM_IDS={ARI:22,ATL:1,BAL:33,BUF:2,CAR:29,CHI:3,CIN:4,CLE:5,DAL:6,DEN:7,DET:8,GB:9,HOU:34,IND:11,JAX:30,KC:12,LV:13,LAC:24,LAR:14,MIA:15,MIN:16,NE:17,NO:18,NYG:19,NYJ:20,PHI:21,PIT:23,SF:25,SEA:26,TB:27,TEN:10,WAS:28};
const WATCH_KEY="gridironIQPlayerWatchlistV1";
let players=[],ngs=[],season="—",selected=null,availableFields=[],injuryRecords=[],snapRecords=[];
const num=(p,k)=>{const n=Number(p?.[k]);return Number.isFinite(n)?n:0};
const per=(p,k)=>num(p,k)/Math.max(1,num(p,"games"));
const fmt=n=>Number(n).toLocaleString(undefined,{maximumFractionDigits:1});
const getWatch=()=>{try{return JSON.parse(localStorage.getItem(WATCH_KEY)||"[]")}catch{return[]}};
const saveWatch=a=>{try{localStorage.setItem(WATCH_KEY,JSON.stringify(a))}catch{}};
function inject(){if($("iq-scout-style"))return;const s=document.createElement("style");s.id="iq-scout-style";s.textContent=`
.iq-scout-shell{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.35fr);gap:14px}
.iq-scout-controls{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:12px}
.iq-scout-list{max-height:520px;overflow:auto;border:1px solid #263247;background:#080f1b}
.iq-scout-player{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;padding:11px 12px;background:transparent;color:#eaf2fc;border:0;border-bottom:1px solid #1e2b40;font-size:12px}
.iq-scout-player:hover,.iq-scout-player.active{background:#00e5ff12}
.iq-scout-player small{display:block;color:#8491a5;margin-top:4px}
.iq-scout-profile-head{display:flex;align-items:center;gap:14px;margin-bottom:14px}
.iq-scout-photo{width:76px;height:76px;object-fit:cover;border-radius:50%;border:2px solid #00e5ff;background:#0b1421}
.iq-scout-photo-placeholder{width:76px;height:76px;border-radius:50%;display:grid;place-items:center;background:#14243a;border:1px solid #38506c;font-size:25px}
.iq-scout-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:12px 0}
.iq-scout-metric{padding:12px;background:#0b1626;border:1px solid #263247;min-width:0}
.iq-scout-metric strong{display:block;font-size:21px;margin-top:6px;overflow-wrap:anywhere}
.iq-scout-grade{font-size:28px;font-weight:900;color:#6ee7f9}
.iq-scout-row{display:grid;grid-template-columns:minmax(90px,1fr) 2fr 48px;gap:8px;align-items:center;margin:10px 0;font-size:11px}
.iq-scout-bar{height:8px;background:#22334a;overflow:hidden}.iq-scout-bar span{display:block;height:100%;background:linear-gradient(90deg,#0891b2,#38bdf8)}
.iq-scout-chip{display:inline-block;border:1px solid #30435c;background:#14243a;padding:5px 8px;margin:3px 4px 3px 0;font-size:10px;color:#c8d7e8}
.iq-scout-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
.iq-scout-report{line-height:1.6;font-size:12px;color:#c5d2e1}
.iq-scout-watch-item{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid #263247;font-size:12px}
.iq-scout-empty{padding:20px;text-align:center;color:#8491a5;font-size:12px}
@media(max-width:760px){.iq-scout-shell{grid-template-columns:1fr}.iq-scout-list{max-height:270px}.iq-scout-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:420px){.iq-scout-controls{grid-template-columns:1fr}.iq-scout-row{grid-template-columns:90px 1fr 38px}}
`;document.head.appendChild(s)}
function metricsFor(p){
 const pos=p.position, g=Math.max(1,num(p,"games"));
 if(pos==="QB")return [
  {label:"Pass yards / game",value:per(p,"passing_yards"),format:v=>fmt(v),higher:true},
  {label:"Pass TD / game",value:per(p,"passing_tds"),format:v=>fmt(v),higher:true},
  {label:"INT / game",value:per(p,"interceptions"),format:v=>fmt(v),higher:false},
  {label:"Rush yards / game",value:per(p,"rushing_yards"),format:v=>fmt(v),higher:true}
 ];
 if(pos==="RB")return [
  {label:"Rush yards / game",value:per(p,"rushing_yards"),format:v=>fmt(v),higher:true},
  {label:"Yards / carry",value:num(p,"carries")?num(p,"rushing_yards")/num(p,"carries"):null,format:v=>fmt(v),higher:true},
  {label:"Rush TD / game",value:per(p,"rushing_tds"),format:v=>fmt(v),higher:true},
  {label:"Rec yards / game",value:per(p,"receiving_yards"),format:v=>fmt(v),higher:true}
 ];
 if(["DE","DT","DL","NT","EDGE","LB","OLB","ILB","CB","DB","S","SAF","FS","SS"].includes(pos)){
  const defs=[["def_tackles","Tackles / game"],["def_sacks","Sacks / game"],["def_qb_hits","QB hits / game"],["def_interceptions","Interceptions / game"],["def_pass_defended","Passes defended / game"],["def_tackles_for_loss","Tackles for loss / game"]].filter(([k])=>availableFields.includes(k));
  return defs.map(([k,label])=>({label,value:per(p,k),format:v=>fmt(v),higher:true}));
 }
 if(pos==="WR"||pos==="TE")return [
  {label:"Rec yards / game",value:per(p,"receiving_yards"),format:v=>fmt(v),higher:true},
  {label:"Receptions / game",value:per(p,"receptions"),format:v=>fmt(v),higher:true},
  {label:"Catch rate",value:num(p,"targets")?num(p,"receptions")/num(p,"targets")*100:null,format:v=>fmt(v)+"%",higher:true},
  {label:"Rec TD / game",value:per(p,"receiving_tds"),format:v=>fmt(v),higher:true}
 ];
 return [];
}
function gradeFor(p){
 const metrics=metricsFor(p),eligible=players.filter(x=>x.position===p.position&&num(x,"games")>0);
 const parts=metrics.map(m=>{if(m.value===null||!Number.isFinite(m.value))return null;const values=eligible.map(x=>{const mm=metricsFor(x).find(z=>z.label===m.label);return mm?.value}).filter(Number.isFinite);if(values.length<2)return null;const rank=values.filter(v=>m.higher?v<=m.value:v>=m.value).length;return rank/values.length*100}).filter(Number.isFinite);
 if(!parts.length)return null;
 const pct=Math.round(parts.reduce((a,b)=>a+b,0)/parts.length);
 return {pct,letter:pct>=90?"A":pct>=80?"B":pct>=65?"C":pct>=45?"D":"F",metrics};
}
function metricHtml(p){
 const grade=gradeFor(p),metrics=metricsFor(p);
 if(!grade)return '<p class="muted small">A comparable statistical grade is not available for this position in the current feed. The player profile and any supplied raw statistics are still shown.</p>';
 return '<div class="iq-scout-metrics"><div class="iq-scout-metric"><span class="stat-label">Position grade</span><strong class="iq-scout-grade">'+grade.letter+'</strong><small class="muted">'+grade.pct+'th percentile composite</small></div><div class="iq-scout-metric"><span class="stat-label">Games</span><strong>'+fmt(num(p,"games"))+'</strong><small class="muted">Recorded in feed</small></div><div class="iq-scout-metric"><span class="stat-label">Weeks listed</span><strong>'+fmt((p.weeks||[]).length)+'</strong><small class="muted">Participation entries</small></div></div><div class="panel-title">Position-relative metrics</div>'+metrics.map(m=>{if(m.value===null)return "";const peers=players.filter(x=>x.position===p.position&&num(x,"games")>0).map(x=>metricsFor(x).find(z=>z.label===m.label)?.value).filter(Number.isFinite);const pct=peers.length?Math.round(peers.filter(v=>m.higher?v<=m.value:v>=m.value).length/peers.length*100):0;return '<div class="iq-scout-row"><span>'+esc(m.label)+'</span><div class="iq-scout-bar"><span style="width:'+pct+'%"></span></div><strong>'+esc(m.format(m.value))+'</strong></div>'}).join("")+'<p class="muted small">Composite grade averages available position-relative percentiles for this position. It measures this season’s supplied statistical production only—not overall talent, film technique, or future ability.</p>';
}
function strengths(p){
 const ms=metricsFor(p).filter(m=>m.value!==null),eligible=players.filter(x=>x.position===p.position&&num(x,"games")>0);
 const out=ms.map(m=>{const vals=eligible.map(x=>metricsFor(x).find(z=>z.label===m.label)?.value).filter(Number.isFinite);if(vals.length<2)return null;const pct=vals.filter(v=>m.higher?v<=m.value:v>=m.value).length/vals.length*100;return {label:m.label,pct}}).filter(Boolean);
 const good=out.filter(x=>x.pct>=75).sort((a,b)=>b.pct-a.pct).slice(0,2),low=out.filter(x=>x.pct<=35).sort((a,b)=>a.pct-b.pct).slice(0,2);
 return {good,low};
}
async function photo(p,host){
 const ab=(p.teams||[]).find(x=>TEAM_IDS[x]);if(!ab)return;
 try{const r=await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/"+TEAM_IDS[ab]+"/roster");if(!r.ok)return;const d=await r.json(),all=(d.athletes||[]).flatMap(g=>g.items||[g]),norm=s=>String(s||"").toLowerCase().replace(/[^a-z]/g,""),a=all.find(x=>norm(x.fullName||x.displayName)===norm(p.name));const url=a?.headshot?.href;if(url&&host.isConnected){const img=document.createElement("img");img.className="iq-scout-photo";img.src=url;img.alt=p.name+" headshot";img.onerror=()=>img.remove();host.prepend(img)}}catch{}
}
function report(p){
 const g=gradeFor(p),sw=strengths(p),team=(p.teams||[]).map(t=>TEAM_NAMES[t]||t).join(", ")||"Team unavailable";
 let s='<div class="iq-scout-report"><strong>'+esc(p.name)+'</strong> · '+esc(p.position||"Position unavailable")+' · '+esc(team)+'. ';
 if(g)s+='Current-feed statistical composite: '+g.letter+' ('+g.pct+'th percentile among same-position players with recorded games). ';
 else s+='A position-relative composite grade cannot be calculated from the available fields. ';
 if(sw.good.length)s+='<br><br><strong>Statistical strengths</strong><br>'+sw.good.map(x=>esc(x.label)+' ranks at or above the '+Math.round(x.pct)+'th percentile').join("<br>")+'.';
 if(sw.low.length)s+='<br><br><strong>Areas below the position comparison group</strong><br>'+sw.low.map(x=>esc(x.label)+' ranks around the '+Math.round(x.pct)+'th percentile').join("<br>")+'.';
 if(!sw.good.length&&!sw.low.length)s+='<br><br>There are not enough comparable supported metrics to identify statistical strengths or lower-ranked areas.';
 s+='<br><br><strong>Coverage note:</strong> The current player feed supplies season passing, rushing, and receiving totals plus games/weeks. It does not provide complete defensive, offensive-line, blocking, coverage, pressure, or weekly situational statistics. Those evaluations are not invented. This report is a data summary, not a film-based professional scouting opinion.</div>';
 return s;
}
function ngsHtml(p){
 const team=(p.teams||[])[0];
 const rows=ngs.filter(x=>String(x.player_display_name||"").toLowerCase()===String(p.name||"").toLowerCase()&&(!team||String(x.team_abbr||"")===team)&&Number(x.season)===Number(season));
 const chosen=["passing","receiving","rushing"].map(type=>rows.filter(x=>x.metric_type===type).sort((a,b)=>(Number(b.week)||0)-(Number(a.week)||0)).find(x=>Number(x.week)===0)||rows.filter(x=>x.metric_type===type).sort((a,b)=>(Number(b.week)||0)-(Number(a.week)||0))[0]).filter(Boolean);
 const labels={completion_percentage_above_expectation:"Completion % above expected",avg_time_to_throw:"Average time to throw",avg_completed_air_yards:"Completed air yards",avg_separation:"Average separation",avg_yac_above_expectation:"YAC above expected",avg_cushion:"Average cushion",rush_yards_over_expected:"Rush yards over expected",rush_yards_over_expected_per_att:"Rush yards over expected / attempt",efficiency:"Rushing efficiency",percent_attempts_gte_eight_defenders:"Runs vs. 8+ defenders"};
 const fields=Object.keys(labels);
 const html=chosen.map(x=>{const vals=fields.filter(k=>x[k]!==undefined&&x[k]!==null&&Number.isFinite(Number(x[k])));return vals.length?'<div class="iq-scout-chip"><strong>'+esc(x.metric_type.toUpperCase())+'</strong> · '+vals.map(k=>esc(labels[k])+': '+fmt(Number(x[k]))).join(' · ')+'</div>':''}).join("");
 return html?'<div class="section-title">Next Gen Stats · Published tracking metrics</div><div>'+html+'</div><p class="muted small">NFL Next Gen Stats player-level metrics are published summaries derived from tracking. These are not raw player coordinates or route maps.</p>':'<div class="section-title">Next Gen Stats</div><p class="muted small">No matching published NGS summary is available for this player in the current season.</p>';
}
function rawStats(p){
 const rows=[["Games",p.games??(p.weeks||[]).length],["Passing yards",p.passing_yards],["Passing TD",p.passing_tds],["Interceptions",p.interceptions],["Rushing yards",p.rushing_yards],["Carries",p.carries],["Rushing TD",p.rushing_tds],["Receiving yards",p.receiving_yards],["Receptions",p.receptions],["Targets",p.targets],["Receiving TD",p.receiving_tds],["Defensive tackles",p.def_tackles],["Defensive sacks",p.def_sacks],["QB hits",p.def_qb_hits],["Interceptions",p.def_interceptions],["Passes defended",p.def_pass_defended],["Tackles for loss",p.def_tackles_for_loss]];
 return rows.filter(([,v])=>v!==undefined&&v!==null).map(([k,v])=>'<span class="iq-scout-chip">'+esc(k)+': <strong>'+fmt(Number(v)||0)+'</strong></span>').join("");
}
function selectPlayer(id){
 selected=players.find(p=>String(p.id)===String(id));const host=$("iq-scout-profile");if(!host)return;
 if(!selected){host.innerHTML='<div class="iq-scout-empty">Select an NFL player to open their scouting profile.</div>';return}
 const p=selected,watch=getWatch(),saved=watch.some(x=>String(x.id)===String(p.id));
 const injury=injuryRecords.filter(x=>String(x.gsis_id)===String(p.id)||String(x.full_name||"").toLowerCase()===String(p.name||"").toLowerCase()).sort((a,b)=>(Number(b.week)||0)-(Number(a.week)||0))[0];
 const snap=snapRecords.filter(x=>String(x.player||"").toLowerCase()===String(p.name||"").toLowerCase()).sort((a,b)=>(Number(b.week)||0)-(Number(a.week)||0))[0];
 host.innerHTML='<div class="iq-scout-profile-head" id="iq-scout-photo-host"><div class="iq-scout-photo-placeholder">🏈</div><div><div class="eyebrow">NFL PLAYER SCOUTING PROFILE</div><h2 style="font-size:21px;margin:0 0 5px">'+esc(p.name)+'</h2><div class="muted small">'+esc(p.position)+' · '+esc((p.teams||[]).map(t=>TEAM_NAMES[t]||t).join(" / ")||"Team unavailable")+' · '+esc(season)+' season</div></div></div><div class="iq-scout-actions"><button class="btn" id="iq-watch-toggle">'+(saved?"★ SAVED TO WATCHLIST":"☆ ADD TO WATCHLIST")+'</button><button class="btn secondary" id="iq-report-copy">COPY SCOUTING REPORT</button></div>'+metricHtml(p)+ngsHtml(p)+'<div class="section-title">Season statistics</div><div>'+rawStats(p)+'</div><div class="section-title">Statistical strengths & areas to monitor</div>'+report(p)+'<div class="section-title">Workload & availability</div><div>'+ (snap?'<span class="iq-scout-chip">Offense snaps: '+fmt(Number(snap.offense_snaps)||0)+'</span><span class="iq-scout-chip">Defense snaps: '+fmt(Number(snap.defense_snaps)||0)+'</span><span class="iq-scout-chip">Special teams snaps: '+fmt(Number(snap.st_snaps)||0)+'</span>':'<p class="muted small">No matching snap-count row is available for this player yet.</p>') + (injury?'<p class="muted small">Latest published injury report · Week '+esc(injury.week)+' · '+esc(injury.report_status||"No game designation")+' · '+esc(injury.report_primary_injury||"Injury not specified")+' · Practice: '+esc(injury.practice_status||"Not listed")+'</p>':'<p class="muted small">No matching injury report entry was found. This does not confirm the player is injury-free.</p>') + '</div><div class="section-title">Situational & weekly evaluation</div><p class="muted small">Detailed third-down, red-zone, coverage, route, and game-by-game performance splits appear only where a verified feed supplies them. Pressure and charting fields may vary by player and week.</p>';
 const ph=$("iq-scout-photo-host");ph.querySelector(".iq-scout-photo-placeholder")?.remove();photo(p,ph);
 $("iq-watch-toggle").addEventListener("click",()=>toggleWatch(p));
 $("iq-report-copy").addEventListener("click",()=>{const txt=host.querySelector(".iq-scout-report")?.innerText||"";if(navigator.clipboard?.writeText)navigator.clipboard.writeText(txt).then(()=>{$("iq-report-copy").textContent="COPIED"}).catch(()=>{$("iq-report-copy").textContent="COPY UNAVAILABLE"});});
 document.querySelectorAll(".iq-scout-player").forEach(b=>b.classList.toggle("active",b.dataset.id===String(p.id)));
}
function toggleWatch(p){let a=getWatch();const exists=a.some(x=>String(x.id)===String(p.id));a=exists?a.filter(x=>String(x.id)!==String(p.id)):[{id:p.id,name:p.name,position:p.position,team:(p.teams||[]).join("/")},...a];saveWatch(a);renderWatch();if(selected)selectPlayer(selected.id)}
function renderWatch(){const h=$("iq-scout-watchlist");if(!h)return;const a=getWatch();h.innerHTML=a.length?a.map(x=>'<div class="iq-scout-watch-item"><button class="btn secondary" data-watch-id="'+esc(x.id)+'">'+esc(x.name)+' · '+esc(x.position)+'</button><button class="btn secondary" data-remove-id="'+esc(x.id)+'">REMOVE</button></div>').join(""):'<p class="muted small">Your watchlist is empty. Add players from their scouting profiles. It is saved on this device.</p>';h.querySelectorAll("[data-watch-id]").forEach(b=>b.addEventListener("click",()=>{selectPlayer(b.dataset.watchId);$("iq-scout-search").value=players.find(p=>String(p.id)===b.dataset.watchId)?.name||""}));h.querySelectorAll("[data-remove-id]").forEach(b=>b.addEventListener("click",()=>{saveWatch(getWatch().filter(x=>String(x.id)!==b.dataset.removeId));renderWatch();if(selected)selectPlayer(selected.id)}))}
function renderList(){
 const q=($("iq-scout-search")?.value||"").trim().toLowerCase(),pos=$("iq-scout-position")?.value||"",team=$("iq-scout-team")?.value||"";
 const list=players.filter(p=>(!q||[p.name,p.position,...(p.teams||[])].some(v=>String(v||"").toLowerCase().includes(q)))&&(!pos||p.position===pos)&&(!team||(p.teams||[]).includes(team))).slice(0,250);
 $("iq-scout-list").innerHTML=list.length?list.map(p=>'<button class="iq-scout-player '+(selected&&String(selected.id)===String(p.id)?"active":"")+'" data-id="'+esc(p.id)+'"><span><strong>'+esc(p.name)+'</strong><small>'+esc(p.position)+' · '+esc((p.teams||[]).join("/"))+'</small></span><span class="muted">›</span></button>').join(""):'<div class="iq-scout-empty">No NFL player records match these filters.</div>';
 $("iq-scout-list").querySelectorAll("[data-id]").forEach(b=>b.addEventListener("click",()=>selectPlayer(b.dataset.id)));
 $("iq-scout-result-count").textContent=list.length+" players shown · "+players.length+" records in feed";
}
function fillCompare(){const a=$("iq-scout-compare-a"),b=$("iq-scout-compare-b");if(!a||!b)return;const opts=players.slice().sort((x,y)=>x.name.localeCompare(y.name));for(const s of [a,b])s.innerHTML=opts.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' · '+esc(p.position)+'</option>').join("");if(opts.length>1)b.selectedIndex=1}
function compare(){const a=players.find(p=>String(p.id)===$("iq-scout-compare-a")?.value),b=players.find(p=>String(p.id)===$("iq-scout-compare-b")?.value),h=$("iq-scout-compare-result");if(!a||!b||!h)return;const same=a.position===b.position;const rows=[["Games","games"],["Passing yards","passing_yards"],["Passing TD","passing_tds"],["Interceptions","interceptions"],["Rushing yards","rushing_yards"],["Carries","carries"],["Receiving yards","receiving_yards"],["Receptions","receptions"],["Targets","targets"],["Receiving TD","receiving_tds"]];h.innerHTML='<div class="table-wrap"><table><thead><tr><th>Metric</th><th>'+esc(a.name)+'</th><th>'+esc(b.name)+'</th></tr></thead><tbody>'+rows.map(([label,key])=>{const av=a[key],bv=b[key];if(av===undefined&&bv===undefined)return "";return '<tr><td>'+label+'</td><td>'+fmt(Number(av)||0)+'</td><td>'+fmt(Number(bv)||0)+'</td></tr>'}).join("")+'</tbody></table></div>'+(same?'<p class="muted small">Both players are '+esc(a.position)+'. Their supported position-relative grades can be compared from their profiles.</p>':'<p class="muted small">Different positions selected. Raw totals are shown, but no cross-position grade or ranking is calculated.</p>')}
async function init(){
 inject();const root=$("iq-player-scouting");if(!root)return;
 root.innerHTML='<p class="muted small">Loading the verified NFL player feed…</p>';
 try{const [d,n,inj,sn]=await Promise.all([fetch("/data/nfl-players.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("NFL player feed unavailable ("+r.status+")");return r.json()}),fetch("/data/nfl-ngs-metrics.json",{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null),fetch("/data/nfl-injuries.json",{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null),fetch("/data/nfl-snap-counts.json",{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null)]);players=Array.isArray(d.players)?d.players:[];availableFields=d.availableStatColumns||[];injuryRecords=Number(inj?.season)===Number(d.season)?(inj?.records||[]):[];snapRecords=Number(sn?.season)===Number(d.season)?(sn?.records||[]):[];ngs=Array.isArray(n?.metrics)?n.metrics:[];season=d.season||"latest";root.innerHTML='<div class="notice">NFL players only · '+esc(season)+' season · '+players.length.toLocaleString()+' records from nflverse. Profiles and grades use only supported fields. Defensive and situational grades are withheld when the feed does not contain the required statistics.</div><div class="iq-scout-shell"><div><div class="card"><div class="panel-title">Find an NFL player</div><div class="iq-scout-controls"><input id="iq-scout-search" placeholder="Search player name or team"><select id="iq-scout-position"><option value="">All positions</option>'+[...new Set(players.map(p=>p.position).filter(Boolean))].sort().map(x=>'<option>'+esc(x)+'</option>').join("")+'</select><select id="iq-scout-team"><option value="">All teams</option>'+Object.entries(TEAM_NAMES).map(([k,v])=>'<option value="'+k+'">'+esc(v)+'</option>').join("")+'</select></div><div id="iq-scout-result-count" class="muted small"></div><div id="iq-scout-list" class="iq-scout-list" style="margin-top:10px"></div></div><div class="card" style="margin-top:14px"><div class="panel-title">Player Watchlist</div><p class="muted small">Save players to follow them here. Watchlist is stored privately in this browser on this device.</p><div id="iq-scout-watchlist"></div></div></div><div class="card"><div class="panel-title">Scouting Profile</div><div id="iq-scout-profile" class="iq-scout-empty">Choose a player from the list to open a full NFL scouting profile.</div></div></div><div class="card" style="margin-top:14px"><div class="panel-title">Player Comparison</div><p class="muted small">Compare actual season totals side by side. Position-relative grades are only meaningful for players at the same position.</p><div class="two-col"><select id="iq-scout-compare-a"></select><select id="iq-scout-compare-b"></select></div><div class="iq-scout-actions"><button class="btn" id="iq-scout-compare">COMPARE PLAYERS</button></div><div id="iq-scout-compare-result"></div></div><p class="muted small" style="margin-top:12px">Headshots are optional ESPN roster images and may not be available for every player. NGS and other advanced fields are displayed only when published and matched reliably. The current source does not supply complete weekly performance splits, injury-adjusted evaluations, or full defensive/line grades.</p>';
 fillCompare();renderList();renderWatch();
 ["iq-scout-search","iq-scout-position","iq-scout-team"].forEach(id=>$(id).addEventListener(id==="iq-scout-search"?"input":"change",renderList));
 $("iq-scout-compare").addEventListener("click",compare);
 }catch(e){root.innerHTML='<div class="notice">Player Scouting could not load the verified NFL player feed: '+esc(e.message)+'. Try again after the data refresh succeeds.</div><button class="btn secondary" id="iq-scout-retry">RETRY</button>';$("iq-scout-retry")?.addEventListener("click",init)}
}
document.addEventListener("DOMContentLoaded",init);
document.addEventListener("gridiron:players-loaded",()=>{if(!$("iq-scout-list"))init()});
})();
