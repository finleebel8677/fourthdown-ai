(function(){
"use strict";
const $=id=>document.getElementById(id);
const teams=["ARI","ATL","BAL","BUF","CAR","CHI","CIN","CLE","DAL","DEN","DET","GB","HOU","IND","JAX","KC","LV","LAC","LAR","MIA","MIN","NE","NO","NYG","NYJ","PHI","PIT","SF","SEA","TB","TEN","WAS"];
const teamNames={ARI:"Arizona Cardinals",ATL:"Atlanta Falcons",BAL:"Baltimore Ravens",BUF:"Buffalo Bills",CAR:"Carolina Panthers",CHI:"Chicago Bears",CIN:"Cincinnati Bengals",CLE:"Cleveland Browns",DAL:"Dallas Cowboys",DEN:"Denver Broncos",DET:"Detroit Lions",GB:"Green Bay Packers",HOU:"Houston Texans",IND:"Indianapolis Colts",JAX:"Jacksonville Jaguars",KC:"Kansas City Chiefs",LV:"Las Vegas Raiders",LAC:"Los Angeles Chargers",LAR:"Los Angeles Rams",MIA:"Miami Dolphins",MIN:"Minnesota Vikings",NE:"New England Patriots",NO:"New Orleans Saints",NYG:"New York Giants",NYJ:"New York Jets",PHI:"Philadelphia Eagles",PIT:"Pittsburgh Steelers",SF:"San Francisco 49ers",SEA:"Seattle Seahawks",TB:"Tampa Bay Buccaneers",TEN:"Tennessee Titans",WAS:"Washington Commanders"};
const ns="http://www.w3.org/2000/svg", esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let dots=[],routes=[],drag=null,routeStart=null,anim=null,mode="explore",selectedPlayer="";
const svgEl=(tag,attrs={})=>{const n=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));return n};
function rows(){return Array.isArray(window.loadedPlayerRows)?window.loadedPlayerRows:(typeof loadedPlayerRows!=="undefined"?loadedPlayerRows:[])}
function teamRows(){const t=$("lf-team").value;return rows().filter(p=>(p.teams||[]).includes(t))}
function playerOptions(){const t=$("lf-team").value,sel=$("lf-player");const list=rows().filter(p=>(p.teams||[]).includes(t)).sort((a,b)=>a.name.localeCompare(b.name));sel.innerHTML='<option value="">Select a player</option>'+list.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' · '+esc(p.position)+'</option>').join("");}
function fieldBase(svg){svg.innerHTML="";svg.append(svgEl("rect",{x:0,y:0,width:1000,height:500,fill:"#123e2d"}));for(let x=0;x<=1000;x+=50){svg.append(svgEl("line",{x1:x,y1:0,x2:x,y2:500,stroke:"#d7f2dd","stroke-opacity":x%100===0?".32":".12","stroke-width":x%100===0?2:1}));}for(let y=0;y<=500;y+=50)svg.append(svgEl("line",{x1:0,y1:y,x2:1000,y2:y,stroke:"#1dd9d0","stroke-opacity":".12","stroke-width":1}));svg.append(svgEl("rect",{x:0,y:0,width:70,height:500,fill:"#00d8ff","fill-opacity":".08"}),svgEl("rect",{x:930,y:0,width:70,height:500,fill:"#4b2d76","fill-opacity":".1"}),svgEl("line",{x1:500,y1:0,x2:500,y2:500,stroke:"#e8fbff","stroke-opacity":".6","stroke-width":2,"stroke-dasharray":"9 8"}));[100,200,300,400,600,700,800,900].forEach(x=>{const tx=svgEl("text",{x,y:24,fill:"#7ee9ef","font-size":13,"text-anchor":"middle","opacity":".7"});tx.textContent=String(Math.min(x,1000-x)/10);svg.append(tx)});svg.append(svgEl("rect",{x:10,y:10,width:980,height:480,fill:"none",stroke:"#00e5ff","stroke-opacity":".45","stroke-width":2}));}
function defaultDots(){dots=[{x:210,y:250,l:"QB",side:"O"},{x:300,y:250,l:"RB",side:"O"},{x:340,y:90,l:"WR",side:"O"},{x:340,y:410,l:"WR",side:"O"},{x:360,y:180,l:"TE",side:"O"},{x:475,y:165,l:"DE",side:"D"},{x:475,y:250,l:"DT",side:"D"},{x:475,y:335,l:"DE",side:"D"},{x:570,y:110,l:"CB",side:"D"},{x:570,y:390,l:"CB",side:"D"},{x:680,y:250,l:"S",side:"D"}];routes=[];}
function renderField(){
 const svg=$("lf-field");if(!svg)return;fieldBase(svg);
 routes.forEach(r=>svg.append(svgEl("path",{d:"M"+r.x1+" "+r.y1+" Q"+((r.x1+r.x2)/2)+" "+(Math.min(r.y1,r.y2)-35)+" "+r.x2+" "+r.y2,fill:"none",stroke:r.color,"stroke-width":5,"stroke-linecap":"round","stroke-dasharray":r.kind==="Run"?"10 8":"none","marker-end":"url(#lf-arrow)"})));
 const defs=svgEl("defs");const marker=svgEl("marker",{id:"lf-arrow",markerWidth:9,markerHeight:9,refX:7,refY:3,orient:"auto"});marker.append(svgEl("path",{d:"M0 0L0 6L8 3Z",fill:"#00e5ff"}));defs.append(marker);svg.prepend(defs);
 dots.forEach((d,i)=>{const g=svgEl("g",{transform:"translate("+d.x+" "+d.y+")","data-dot":i,class:"lf-dot",style:"cursor:grab"});g.append(svgEl("circle",{r:24,fill:d.side==="O"?"#00cfff":"#a855f7",stroke:"#00e5ff","stroke-width":3}));const t=svgEl("text",{x:0,y:4,"text-anchor":"middle",fill:"#07111b","font-size":13,"font-weight":900});t.textContent=d.l;g.append(t);svg.append(g)});
 svg.querySelectorAll("[data-dot]").forEach(g=>g.addEventListener("pointerdown",e=>{if($("lf-tool").value==="route"){routeStart=Number(g.dataset.dot);$("lf-status").textContent="Player selected. Tap a destination on the field.";return;}drag=Number(g.dataset.dot);g.setPointerCapture?.(e.pointerId)}));
 svg.onpointermove=e=>{if(drag===null)return;const r=svg.getBoundingClientRect(),d=dots[drag];d.x=Math.max(25,Math.min(975,(e.clientX-r.left)/r.width*1000));d.y=Math.max(25,Math.min(475,(e.clientY-r.top)/r.height*500));const node=svg.querySelector('[data-dot="'+drag+'"]');if(node)node.setAttribute("transform","translate("+d.x+" "+d.y+")")};
 svg.onpointerup=()=>{if(drag!==null){drag=null;renderField();$("lf-status").textContent="Player position adjusted. This is a user-created tactical layout, not NFL tracking."}};
 svg.onclick=e=>{if(e.target.closest("[data-dot]"))return;const tool=$("lf-tool").value;if(tool!=="route"||routeStart===null)return;const r=svg.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*1000,y=(e.clientY-r.top)/r.height*500,a=dots[routeStart];routes.push({x1:a.x,y1:a.y,x2:x,y2:y,kind:$("lf-route-kind").value,color:$("lf-route-kind").value==="Run"?"#39ff88":"#00e5ff"});routeStart=null;renderField();$("lf-status").textContent="Route added to tactical illustration."};
}
function metricChart(title,labels,values,color="#00e5ff"){
 const w=560,h=220,p=34,max=Math.max(1,...values),n=Math.max(1,values.length),slot=(w-p*2)/n,bw=Math.min(34,slot*.58);let out='<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(title)+' bar chart" class="lf-chart">';
 for(let i=0;i<4;i++){const y=p+i*(h-p*2)/3;out+='<line x1="'+p+'" y1="'+y+'" x2="'+(w-p)+'" y2="'+y+'" stroke="#26394d" stroke-dasharray="3 5"/>';}
 values.forEach((v,i)=>{const bh=(Math.max(0,v)/max)*(h-p*2),x=p+slot*i+(slot-bw)/2,y=h-p-bh;out+='<rect x="'+x+'" y="'+y+'" width="'+bw+'" height="'+bh+'" fill="'+color+'" opacity=".88"><title>'+esc(labels[i])+': '+Number(v).toLocaleString()+'</title></rect><text x="'+(x+bw/2)+'" y="'+(h-9)+'" fill="#91a2b9" font-size="10" text-anchor="middle">'+esc(labels[i])+'</text>';});
 return out+"</svg>";
}
function renderPlayer(){
 const id=$("lf-player").value,p=rows().find(x=>x.id===id),box=$("lf-player-card");if(!p){box.innerHTML='<div class="muted">Select a player to inspect verified season statistics.</div>';return;}
 const stats=[["Passing yards",+p.passing_yards||0],["Rushing yards",+p.rushing_yards||0],["Receiving yards",+p.receiving_yards||0],["Touchdowns",(+p.passing_tds||0)+(+p.rushing_tds||0)+(+p.receiving_tds||0)]];
 box.innerHTML='<div class="lf-player-head"><div><div class="eyebrow">PLAYER INTELLIGENCE</div><h2>'+esc(p.name)+'</h2><span class="muted">'+esc(p.position)+' · '+esc((p.teams||[]).join("/"))+' · '+esc(p.games)+' games</span></div><span class="lf-live-dot">VERIFIED DATA</span></div><div class="lf-metric-grid">'+stats.map(x=>'<div class="lf-metric"><small>'+x[0]+'</small><strong>'+x[1].toLocaleString()+'</strong></div>').join("")+'</div><div class="lf-chart-wrap"><div class="panel-title">SEASON PRODUCTION PROFILE</div>'+metricChart("Production",stats.map(x=>x[0]),stats.map(x=>x[1]))+'</div><p class="muted small">Season totals from the NFL statistics dataset. These totals are not player tracking coordinates.</p>'; 
 window.dispatchEvent(new CustomEvent("gridiron:field-player-selected",{detail:{id:p.id,name:p.name,position:p.position,teams:p.teams||[]}}));
}
function renderTeamCharts(){
 const t=$("lf-team").value,ps=teamRows(),totals=[["Passing yards",ps.reduce((a,p)=>a+(+p.passing_yards||0),0)],["Rushing yards",ps.reduce((a,p)=>a+(+p.rushing_yards||0),0)],["Receiving yards",ps.reduce((a,p)=>a+(+p.receiving_yards||0),0)]];
 $("lf-team-title").textContent=(teamNames[t]||t)+" · Player production aggregation";
 $("lf-team-chart").innerHTML=metricChart("Team player production",totals.map(x=>x[0]),totals.map(x=>x[1]),"#a855f7");
 $("lf-team-note").textContent="Derived by summing available player season totals for "+(teamNames[t]||t)+". This is not an official team offense or defense ranking.";
}
function renderPredictive(){
 const t=$("lf-team").value,ps=teamRows(),qb=ps.filter(p=>p.position==="QB"),wr=ps.filter(p=>["WR","TE"].includes(p.position)),rb=ps.filter(p=>p.position==="RB");
 const total=arr=>arr.reduce((a,p)=>a+(+p.passing_yards||0)+(+p.rushing_yards||0)+(+p.receiving_yards||0),0);
 const groups=[["QB production",total(qb)],["WR/TE receiving",wr.reduce((a,p)=>a+(+p.receiving_yards||0),0)],["RB rushing",rb.reduce((a,p)=>a+(+p.rushing_yards||0),0)]];
 $("lf-predict-chart").innerHTML=metricChart("Offensive production profile",groups.map(x=>x[0]),groups.map(x=>x[1]),"#39ff88");
 $("lf-predict-note").textContent="Descriptive profile for "+(teamNames[t]||t)+", calculated from player season totals. A true opponent-specific predictive advantage is not shown because verified opponent defensive/play-level inputs are not yet available in this dataset. No outcome probability is fabricated.";
}
function addCoreVisuals(){
 const ps=rows();
 const pHost=document.querySelector("#page-players .card");
 if(pHost&&!$("core-player-chart")){
  const wrap=document.createElement("div");wrap.className="card";wrap.id="core-player-chart";wrap.style.marginTop="14px";
  const leaders=ps.filter(p=>["QB","RB","WR","TE"].includes(p.position)).map(p=>({name:p.name,yards:(+p.passing_yards||0)+(+p.rushing_yards||0)+(+p.receiving_yards||0)})).sort((a,b)=>b.yards-a.yards).slice(0,8);
  wrap.innerHTML='<div class="lf-section-kicker">LEAGUE PRODUCTION LEADERS</div><div class="muted small">Combined passing, rushing and receiving yards · loaded season</div>'+metricChart("League production",leaders.map(x=>x.name.split(" ").slice(-1)[0]),leaders.map(x=>x.yards),"#00e5ff");
  pHost.after(wrap);
 }
 const tHost=$("team-detail");
 if(tHost&&!$("core-team-chart")){
  const wrap=document.createElement("div");wrap.className="card";wrap.id="core-team-chart";wrap.style.marginTop="14px";
  const teamTotals=teams.map(t=>({t,y:ps.filter(p=>(p.teams||[]).includes(t)).reduce((a,p)=>a+(+p.passing_yards||0)+(+p.rushing_yards||0)+(+p.receiving_yards||0),0)})).sort((a,b)=>b.y-a.y).slice(0,10);
  wrap.innerHTML='<div class="lf-section-kicker">TEAM PLAYER PRODUCTION</div><div class="muted small">Sum of available player season totals; not official team offense rankings.</div>'+metricChart("Team production",teamTotals.map(x=>x.t),teamTotals.map(x=>x.y),"#a855f7");
  tHost.after(wrap);
 }
}
function trackingStatus(){const s=$("lf-tracking-status");s.innerHTML='<strong>TRACKING FEED NOT CONNECTED</strong><p>Current NFLverse player records provide season statistics, not raw player coordinates for every play. Real movement trails and player-position replays remain disabled until a verified tracking feed is available.</p><div class="lf-data-tag">STATISTICS CONNECTED · COORDINATES UNAVAILABLE</div>';}
function setup(){
 if(!$("page-livingfield"))return;
 $("lf-team").innerHTML=teams.map(t=>'<option value="'+t+'">'+esc(teamNames[t])+'</option>').join("");
 const favorite=(()=>{try{return JSON.parse(localStorage.getItem("gridironIQDashboard")||"{}").team}catch(e){return ""}})();
 if(favorite&&teams.includes(favorite))$("lf-team").value=favorite;
 $("lf-team").addEventListener("change",()=>{playerOptions();renderTeamCharts();renderPredictive();renderPlayer()});
 $("lf-player").addEventListener("change",renderPlayer);
 $("lf-tool").addEventListener("change",()=>{$("lf-status").textContent=$("lf-tool").value==="route"?"Select a player, then tap a destination to draw a route.":"Drag player markers to customize the tactical illustration."});
 $("lf-reset").onclick=()=>{defaultDots();renderField();$("lf-status").textContent="Tactical field reset."};
 $("lf-clear-routes").onclick=()=>{routes=[];renderField();$("lf-status").textContent="Routes cleared."};
 $("lf-animate").onclick=()=>{
  const svg=$("lf-field");
  svg.querySelectorAll("path").forEach((p,i)=>{try{const n=p.getTotalLength();p.style.strokeDasharray=n;p.style.strokeDashoffset=n;p.animate([{strokeDashoffset:n},{strokeDashoffset:0}],{duration:1300,delay:i*100,fill:"forwards",easing:"ease-out"})}catch(e){}});
  routes.forEach(route=>{const idx=dots.findIndex(d=>Math.hypot(d.x-route.x1,d.y-route.y1)<35);if(idx<0)return;const node=svg.querySelector('[data-dot="'+idx+'"]');if(!node)return;const motion=svgEl("animateTransform",{attributeName:"transform",type:"translate",from:route.x1+" "+route.y1,to:route.x2+" "+route.y2,dur:"1.7s",fill:"freeze"});node.append(motion);if(motion.beginElement)motion.beginElement();});
  $("lf-status").textContent="Playing a user-created tactical simulation. Player movements are illustrative, not actual NFL tracking or recorded outcomes.";
 };
 $("lf-save").onclick=()=>{const payload={team:$("lf-team").value,dots,routes,updated:Date.now()};localStorage.setItem("gridironIQLivingField",JSON.stringify(payload));$("lf-status").textContent="Field layout saved on this device."};
 $("lf-load").onclick=()=>{try{const p=JSON.parse(localStorage.getItem("gridironIQLivingField")||"null");if(!p)throw Error();dots=p.dots||[];routes=p.routes||[];if(p.team)$("lf-team").value=p.team;renderField();$("lf-status").textContent="Saved field layout restored."}catch(e){$("lf-status").textContent="No saved field layout found on this device."}};
 defaultDots();playerOptions();renderField();renderTeamCharts();renderPredictive();trackingStatus();if(rows().length){renderPlayer();addCoreVisuals()}window.addEventListener("gridiron:players-loaded",()=>{playerOptions();renderPlayer();renderTeamCharts();renderPredictive();addCoreVisuals()});
 const obs=new MutationObserver(()=>{if(rows().length){playerOptions();renderTeamCharts();renderPredictive();renderPlayer();obs.disconnect()}});obs.observe($("lf-player-card"),{childList:true,subtree:true});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup);else setup();
window.addEventListener("load",()=>{if(rows().length){playerOptions();renderTeamCharts();renderPredictive();renderPlayer()}});
})();