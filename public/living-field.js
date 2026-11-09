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
function fieldBase(svg){
 svg.innerHTML="";
 const defs=svgEl("defs"),grad=svgEl("linearGradient",{id:"lf-grass",x1:"0",y1:"0",x2:"0",y2:"1"});
 grad.append(svgEl("stop",{offset:"0%","stop-color":"#174b39"}));grad.append(svgEl("stop",{offset:"100%","stop-color":"#0b3329"}));defs.append(grad);svg.append(defs);
 svg.append(svgEl("rect",{x:0,y:0,width:1000,height:500,rx:8,fill:"url(#lf-grass)"}));
 for(let i=0;i<10;i++){svg.append(svgEl("rect",{x:70+i*86,y:0,width:43,height:500,fill:"#c5efcc","fill-opacity":".045"}));}
 svg.append(svgEl("rect",{x:0,y:0,width:70,height:500,fill:"#12435a",stroke:"#69dff3","stroke-width":2}));svg.append(svgEl("rect",{x:930,y:0,width:70,height:500,fill:"#302653",stroke:"#b99aff","stroke-width":2}));
 const e1=svgEl("text",{x:35,y:250,fill:"#b8efff","font-size":15,"font-weight":900,"text-anchor":"middle",transform:"rotate(-90 35 250)"});e1.textContent="DEFENSE";svg.append(e1);
 const e2=svgEl("text",{x:965,y:250,fill:"#e2d5ff","font-size":15,"font-weight":900,"text-anchor":"middle",transform:"rotate(90 965 250)"});e2.textContent="OFFENSE";svg.append(e2);
 for(let x=70;x<=930;x+=86){
  svg.append(svgEl("line",{x1:x,y1:0,x2:x,y2:500,stroke:"#e5f7e9","stroke-opacity":".58","stroke-width":2}));
  for(const y of [72,88,412,428]){svg.append(svgEl("line",{x1:x-5,y1:y,x2:x+5,y2:y,stroke:"#e5f7e9","stroke-opacity":".75","stroke-width":2}));}
  if(x>70&&x<930){const n=Math.round(Math.min(x-70,930-x)/8.6);for(const y of [45,465]){const t=svgEl("text",{x:x,y:y,fill:"#d8eee0","font-size":21,"font-weight":800,"text-anchor":"middle"});t.textContent=String(n);svg.append(t);}}
 }
 for(const y of [150,200,250,300,350]){svg.append(svgEl("line",{x1:70,y1:y,x2:930,y2:y,stroke:"#d6f0dd","stroke-opacity":".13"}));}
 svg.append(svgEl("line",{x1:500,y1:0,x2:500,y2:500,stroke:"#f4fff5","stroke-opacity":".8","stroke-width":2,"stroke-dasharray":"7 7"}));
 svg.append(svgEl("line",{x1:420,y1:0,x2:420,y2:500,stroke:"#ffd166","stroke-opacity":".85","stroke-width":3,"stroke-dasharray":"10 8"}));
 const los=svgEl("text",{x:420,y:18,fill:"#ffe09a","font-size":11,"font-weight":900,"text-anchor":"middle"});los.textContent="LINE TO GAIN";svg.append(los);
 svg.append(svgEl("rect",{x:8,y:8,width:984,height:484,rx:8,fill:"none",stroke:"#d6f7e1","stroke-opacity":".55","stroke-width":2}));
}
function defaultDots(){dots=[{x:210,y:250,l:"QB",side:"O"},{x:300,y:250,l:"RB",side:"O"},{x:340,y:90,l:"WR",side:"O"},{x:340,y:410,l:"WR",side:"O"},{x:360,y:180,l:"TE",side:"O"},{x:475,y:165,l:"DE",side:"D"},{x:475,y:250,l:"DT",side:"D"},{x:475,y:335,l:"DE",side:"D"},{x:570,y:110,l:"CB",side:"D"},{x:570,y:390,l:"CB",side:"D"},{x:680,y:250,l:"S",side:"D"}];routes=[];}
function renderField(){
 const svg=$("lf-field");if(!svg)return;fieldBase(svg);
 routes.forEach(r=>svg.append(svgEl("path",{d:"M"+r.x1+" "+r.y1+" Q"+((r.x1+r.x2)/2)+" "+(Math.min(r.y1,r.y2)-35)+" "+r.x2+" "+r.y2,fill:"none",stroke:r.color,"stroke-width":5,"stroke-linecap":"round","stroke-dasharray":r.kind==="Run"?"10 8":"none","marker-end":"url(#lf-arrow)"})));
 const defs=svgEl("defs");const marker=svgEl("marker",{id:"lf-arrow",markerWidth:9,markerHeight:9,refX:7,refY:3,orient:"auto"});marker.append(svgEl("path",{d:"M0 0L0 6L8 3Z",fill:"#00e5ff"}));defs.append(marker);svg.prepend(defs);
 dots.forEach((d,i)=>{const offense=d.side==="O",accent=offense?"#00e5ff":"#c29aff",fill=offense?"#07506b":"#4b2d76";const g=svgEl("g",{transform:"translate("+d.x+" "+d.y+")","data-dot":i,class:"lf-dot",style:"cursor:grab"});g.append(svgEl("path",{d:"M-18 -17 L-10 -25 L10 -25 L18 -17 L15 16 Q0 25 -15 16Z",fill:fill,stroke:accent,"stroke-width":3}));const num=svgEl("text",{x:0,y:5,"text-anchor":"middle",fill:"#ffffff","font-size":17,"font-weight":900});num.textContent=String(i+1).padStart(2,"0");g.append(num);g.append(svgEl("rect",{x:-23,y:27,width:46,height:17,rx:5,fill:offense?"#063b50":"#30204e",stroke:accent,"stroke-width":1}));const label=svgEl("text",{x:0,y:39,"text-anchor":"middle",fill:"#ffffff","font-size":10,"font-weight":900});label.textContent=d.l;g.append(label);svg.append(g)});
 svg.querySelectorAll("[data-dot]").forEach(g=>g.addEventListener("pointerdown",e=>{if($("lf-tool").value==="route"){routeStart=Number(g.dataset.dot);$("lf-status").textContent="Player selected. Tap a destination on the field.";return;}drag=Number(g.dataset.dot);g.setPointerCapture?.(e.pointerId)}));
 svg.onpointermove=e=>{if(drag===null)return;const r=svg.getBoundingClientRect(),d=dots[drag];d.x=Math.max(25,Math.min(975,(e.clientX-r.left)/r.width*1000));d.y=Math.max(25,Math.min(475,(e.clientY-r.top)/r.height*500));const node=svg.querySelector('[data-dot="'+drag+'"]');if(node)node.setAttribute("transform","translate("+d.x+" "+d.y+")")};
 svg.onpointerup=()=>{if(drag!==null){drag=null;renderField();$("lf-status").textContent="Player position adjusted. This is a user-created tactical layout, not NFL tracking."}};
 svg.onclick=e=>{if(e.target.closest("[data-dot]"))return;const tool=$("lf-tool").value;if(tool!=="route"||routeStart===null)return;const r=svg.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*1000,y=(e.clientY-r.top)/r.height*500,a=dots[routeStart];routes.push({x1:a.x,y1:a.y,x2:x,y2:y,kind:$("lf-route-kind").value,color:$("lf-route-kind").value==="Run"?"#39ff88":"#00e5ff"});routeStart=null;renderField();$("lf-status").textContent="Route added to tactical illustration."};
}
function metricChart(title,labels,values,color="#00e5ff",type="dots"){
 const w=560,h=250,n=Math.max(1,values.length),safe=values.map(v=>Math.max(0,Number(v)||0)),max=Math.max(1,...safe);
 let out='<svg viewBox="0 0 560 250" role="img" aria-label="'+esc(title)+' '+esc(type)+' chart" class="lf-chart" xmlns="'+ns+'">';
 if(type==="radar"&&n>=3){const cx=280,cy=112,r=78,angle=i=>(Math.PI*2*i/n)-Math.PI/2,point=(i,v)=>[cx+Math.cos(angle(i))*r*v,cy+Math.sin(angle(i))*r*v];
 for(let ring=1;ring<=4;ring++){const pts=labels.map((x,i)=>point(i,ring/4).join(",")).join(" ");out+='<polygon points="'+pts+'" fill="none" stroke="#34475e"/>';}
 labels.forEach((label,i)=>{const q=point(i,1);out+='<line x1="'+cx+'" y1="'+cy+'" x2="'+q[0]+'" y2="'+q[1]+'" stroke="#34475e"/><text x="'+(cx+Math.cos(angle(i))*105)+'" y="'+(cy+Math.sin(angle(i))*105+4)+'" fill="#aebed0" font-size="11" text-anchor="middle">'+esc(label)+'</text>';});
 const pts=safe.map((v,i)=>point(i,v/max).join(",")).join(" ");out+='<polygon points="'+pts+'" fill="'+color+'" fill-opacity=".2" stroke="'+color+'" stroke-width="3"/>';
 safe.forEach((v,i)=>{const q=point(i,v/max);out+='<circle cx="'+q[0]+'" cy="'+q[1]+'" r="5" fill="'+color+'" stroke="#fff"><title>'+esc(labels[i])+": "+v.toLocaleString()+'</title></circle>';});
 out+='<text x="280" y="238" fill="#8193a9" font-size="10" text-anchor="middle">Relative scale within profile · yards</text>';
 }else{const row=180/n;safe.forEach((v,i)=>{const y=35+i*row+row/2,x=175+300*(v/max);out+='<text x="160" y="'+(y+4)+'" fill="#aebed0" font-size="11" text-anchor="end">'+esc(labels[i])+'</text><line x1="175" y1="'+y+'" x2="475" y2="'+y+'" stroke="#26394d" stroke-width="2"/><line x1="175" y1="'+y+'" x2="'+x+'" y2="'+y+'" stroke="'+color+'" stroke-opacity=".35" stroke-width="5"/><circle cx="'+x+'" cy="'+y+'" r="7" fill="'+color+'" stroke="#fff" stroke-width="2"/><text x="495" y="'+(y+4)+'" fill="#f4f7fb" font-size="11">'+v.toLocaleString()+'</text>';});}
 return out+"</svg>";
}
function renderPlayer(){
 const id=$("lf-player").value,p=rows().find(x=>x.id===id),box=$("lf-player-card");if(!p){box.innerHTML='<div class="muted">Select a player to inspect verified season statistics.</div>';return;}
 const stats=[["Passing yards",+p.passing_yards||0],["Rushing yards",+p.rushing_yards||0],["Receiving yards",+p.receiving_yards||0],["Touchdowns",(+p.passing_tds||0)+(+p.rushing_tds||0)+(+p.receiving_tds||0)]];
 box.innerHTML='<div class="lf-player-head"><div><div class="eyebrow">PLAYER INTELLIGENCE</div><h2>'+esc(p.name)+'</h2><span class="muted">'+esc(p.position)+' · '+esc((p.teams||[]).join("/"))+' · '+esc(p.games)+' games</span></div><span class="lf-live-dot">VERIFIED DATA</span></div><div class="lf-metric-grid">'+stats.map(x=>'<div class="lf-metric"><small>'+x[0]+'</small><strong>'+x[1].toLocaleString()+'</strong></div>').join("")+'</div><div class="lf-chart-wrap"><div class="panel-title">SEASON PRODUCTION PROFILE</div>'+metricChart("Player season production",["Pass","Rush","Receive"],[stats[0][1],stats[1][1],stats[2][1]],"#00e5ff","radar")+'</div><p class="muted small">Season totals from the NFL statistics dataset. These totals are not player tracking coordinates.</p>'; 
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
 $("lf-predict-chart").innerHTML=metricChart("Offensive production profile",groups.map(x=>x[0]),groups.map(x=>x[1]),"#39ff88","radar");
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

let coverageVisible=true,coverageType="cover2",breakdownStep=0,trackingTrails=null,stadiumMode=false;
const coverageCopy={cover0:"Cover 0: man coverage with no deep safety help; pressure can be aggressive but leaves isolated matchups.",cover1:"Cover 1: man coverage underneath with one deep middle safety.",cover2:"Cover 2: two deep safeties split the deep field; underneath defenders protect short zones.",cover3:"Cover 3: three deep defenders divide the field into thirds with underneath zones.",cover4:"Cover 4: four deep defenders divide the deep field into quarters and match vertical releases.",cover6:"Cover 6: one side plays quarters while the other side plays a Cover 2 half-field structure."};
function drawCoverage(svg){
 if(!coverageVisible)return;
 const zones={
 cover0:'<text x="510" y="65" fill="#fecaca" font-size="19" font-weight="900">ZERO DEEP SAFETIES · MAN</text>',
 cover1:'<rect x="700" y="30" width="180" height="440" fill="#a855f7" fill-opacity=".12" stroke="#c4b5fd" stroke-dasharray="8 6"/><text x="790" y="55" fill="#ddd6fe" text-anchor="middle" font-size="15">POST SAFETY</text>',
 cover2:'<rect x="610" y="25" width="155" height="450" fill="#60a5fa" fill-opacity=".13" stroke="#93c5fd" stroke-dasharray="7 6"/><rect x="765" y="25" width="155" height="450" fill="#60a5fa" fill-opacity=".13" stroke="#93c5fd" stroke-dasharray="7 6"/><text x="685" y="55" fill="#dbeafe" text-anchor="middle" font-size="15">DEEP HALF</text><text x="840" y="55" fill="#dbeafe" text-anchor="middle" font-size="15">DEEP HALF</text>',
 cover3:'<rect x="570" y="25" width="115" height="450" fill="#38bdf8" fill-opacity=".12" stroke="#7dd3fc"/><rect x="685" y="25" width="115" height="450" fill="#38bdf8" fill-opacity=".12" stroke="#7dd3fc"/><rect x="800" y="25" width="115" height="450" fill="#38bdf8" fill-opacity=".12" stroke="#7dd3fc"/><text x="742" y="55" fill="#cffafe" text-anchor="middle" font-size="15">THREE DEEP ZONES</text>',
 cover4:'<rect x="550" y="25" width="90" height="450" fill="#a78bfa" fill-opacity=".13" stroke="#c4b5fd"/><rect x="640" y="25" width="90" height="450" fill="#a78bfa" fill-opacity=".13" stroke="#c4b5fd"/><rect x="730" y="25" width="90" height="450" fill="#a78bfa" fill-opacity=".13" stroke="#c4b5fd"/><rect x="820" y="25" width="90" height="450" fill="#a78bfa" fill-opacity=".13" stroke="#c4b5fd"/><text x="730" y="55" fill="#ede9fe" text-anchor="middle" font-size="15">QUARTERS SHELL</text>',
 cover6:'<rect x="570" y="25" width="170" height="450" fill="#38bdf8" fill-opacity=".13" stroke="#7dd3fc"/><rect x="740" y="25" width="180" height="225" fill="#a78bfa" fill-opacity=".15" stroke="#c4b5fd"/><rect x="740" y="250" width="180" height="225" fill="#a78bfa" fill-opacity=".15" stroke="#c4b5fd"/><text x="650" y="55" fill="#cffafe" text-anchor="middle" font-size="15">QUARTERS</text><text x="830" y="55" fill="#ede9fe" text-anchor="middle" font-size="15">COVER 2 HALF</text>'};
 svg.append(svgEl("g",{id:"lf-coverage-zones"}));
 const g=svg.querySelector("#lf-coverage-zones");g.innerHTML=zones[coverageType]||"";
}
function drawTrails(svg){
 const player=$("lf-player")?.value;
 if(!trackingTrails?.plays?.length||!player)return;
 const matches=trackingTrails.plays.filter(p=>String(p.playerId)===String(player)&&Array.isArray(p.points)&&p.points.length>1);
 matches.forEach(play=>{const pts=play.points.filter(p=>Number.isFinite(+p.x)&&Number.isFinite(+p.y));if(pts.length<2)return;const d=pts.map((p,i)=>(i?"L":"M")+(+p.x)+" "+(+p.y)).join(" ");svg.append(svgEl("path",{d,fill:"none",stroke:"#fbbf24","stroke-width":5,"stroke-linecap":"round","stroke-linejoin":"round","stroke-opacity":".9"}));const end=pts[pts.length-1];svg.append(svgEl("circle",{cx:end.x,cy:end.y,r:8,fill:"#fbbf24",stroke:"#fff","stroke-width":2}));});
}
function recognizeFormation(){
 const off=dots.filter(d=>d.side==="O"),qb=off.find(d=>/QB/i.test(d.l)),receivers=off.filter(d=>/WR|TE/i.test(d.l)),left=receivers.filter(d=>d.y<250),right=receivers.filter(d=>d.y>250);
 const trips=Math.max(left.length,right.length)>=3,bunch=receivers.some(a=>receivers.some(b=>a!==b&&Math.abs(a.x-b.x)<45&&Math.abs(a.y-b.y)<55));
 const wide=receivers.filter(d=>Math.abs(d.y-250)>125).length>=2;
 const backfield=off.filter(d=>/RB|FB/i.test(d.l)).length;
 let name=trips?"Trips":bunch?"Bunch":wide?"Spread / wide alignment":receivers.length>=2?"Balanced 2x2 / multiple receiver": "Unbalanced / custom";
 if(qb&&off.some(d=>/OL|LT|LG|C|RG|RT/i.test(d.l)&&d.x-qb.x>90))name+=" · shotgun-like";
 else if(qb)name+=" · under-center / custom depth";
 const detail=receivers.length+" eligible receiver markers · "+backfield+" backfield runner marker(s) · "+(trips?"three or more receivers aligned to one side":bunch?"receivers clustered tightly":wide?"receivers split wide":"custom spacing");
 $("lf-formation-result").innerHTML='<div class="lf-profile-chip">DETECTED ALIGNMENT</div><h2 style="font-size:20px;margin:9px 0;color:#00e5ff">'+esc(name)+'</h2><p>'+esc(detail)+'</p><p class="muted small">Heuristic based only on your current marker positions; not a computer-vision read of an NFL play.</p>';
}
function breakdownRender(){
 const stages=[["Pre-snap","Confirm personnel, formation, defensive shell, and player alignment."],["Release","Receivers begin their routes; identify leverage and the first defender affected."],["Development","Track route spacing, defensive rotation, and the quarterback's progression."],["Finish","Evaluate the route destination and the available throw or run lane."]];
 const s=stages[breakdownStep];$("lf-breakdown-copy").innerHTML='<strong>'+s[0]+'</strong><br>'+s[1]+(routes.length?' <br><span class="muted">Your diagram currently contains '+routes.length+' user-drawn route(s).</span>':' <br><span class="muted">Draw routes on the field to make this walkthrough specific to your play.</span>');
 $("lf-breakdown-track").innerHTML=stages.map((x,i)=>'<span class="'+(i<=breakdownStep?'active':'')+'"></span>').join("");
 $("lf-breakdown-prev").disabled=breakdownStep===0;$("lf-breakdown-next").textContent=breakdownStep===3?"RESTART":"NEXT STEP";
}
function comparisonOptions(){
 const list=rows().filter(p=>["QB","RB","WR","TE"].includes(p.position)).sort((a,b)=>a.name.localeCompare(b.name));
 ["lf-compare-a","lf-compare-b"].forEach((id,i)=>{const s=$(id);if(!s)return;const old=s.value;s.innerHTML=list.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' · '+esc(p.position)+'</option>').join("");if(list.some(p=>String(p.id)===old))s.value=old;else if(i===1&&list.length>1)s.selectedIndex=1;});
 renderComparison();
}
function renderComparison(){
 const a=rows().find(p=>String(p.id)===$("lf-compare-a")?.value),b=rows().find(p=>String(p.id)===$("lf-compare-b")?.value),box=$("lf-compare-result");if(!box)return;
 if(!a||!b){box.innerHTML='<p class="muted small">Player comparison requires two available player records.</p>';return;}
 const fields=[["Passing yards","passing_yards"],["Rushing yards","rushing_yards"],["Receiving yards","receiving_yards"],["Passing TD","passing_tds"],["Rushing TD","rushing_tds"],["Receiving TD","receiving_tds"]];
 const vals=fields.map(([label,key])=>({label,a:+a[key]||0,b:+b[key]||0}));
 const max=Math.max(1,...vals.flatMap(x=>[x.a,x.b]));
 box.innerHTML='<div class="lf-profile-chip">'+esc(a.position)+' · '+esc((a.teams||[]).join("/"))+'</div><div class="lf-profile-chip">'+esc(b.position)+' · '+esc((b.teams||[]).join("/"))+'</div>'+vals.map(x=>'<div style="margin:9px 0"><div style="display:flex;justify-content:space-between;font-size:10px"><span>'+x.label+'</span><b>'+x.a.toLocaleString()+' / '+x.b.toLocaleString()+'</b></div><div style="display:flex;height:8px;background:#26364a;margin-top:5px;border-radius:8px;overflow:hidden"><span style="width:'+(x.a/max*100)+'%;background:#00e5ff"></span><span style="width:'+(x.b/max*100)+'%;background:#a78bfa"></span></div></div>').join("")+'<p class="muted small">Cyan: '+esc(a.name)+' · Purple: '+esc(b.name)+' · loaded season totals.</p>';
}
function teamIdentity(){
 const ps=teamRows(),pass=ps.reduce((a,p)=>a+(+p.passing_yards||0),0),rush=ps.reduce((a,p)=>a+(+p.rushing_yards||0),0),rec=ps.reduce((a,p)=>a+(+p.receiving_yards||0),0),td=ps.reduce((a,p)=>a+(+p.passing_tds||0)+(+p.rushing_tds||0)+(+p.receiving_tds||0),0),sum=pass+rush;
 const balance=sum?pass/sum:0,style=!sum?"Insufficient production data":balance>.68?"Pass-production leaning":balance<.42?"Rush-production leaning":"Balanced pass/run production";
 const leaders=ps.filter(p=>["QB","RB","WR","TE"].includes(p.position)).sort((a,b)=>(+b.passing_yards||0)+(+b.rushing_yards||0)+(+b.receiving_yards||0)-((+a.passing_yards||0)+(+a.rushing_yards||0)+(+a.receiving_yards||0))).slice(0,3);
 $("lf-identity-result").innerHTML='<h2 style="font-size:19px;color:#00e5ff;margin:5px 0">'+esc(teamNames[$("lf-team").value]||$("lf-team").value)+'</h2><div class="lf-profile-chip">'+style+'</div><div class="lf-metric-grid"><div class="lf-metric"><small>Pass yards</small><strong>'+pass.toLocaleString()+'</strong></div><div class="lf-metric"><small>Rush yards</small><strong>'+rush.toLocaleString()+'</strong></div><div class="lf-metric"><small>Receiving yards</small><strong>'+rec.toLocaleString()+'</strong></div><div class="lf-metric"><small>Player TD total</small><strong>'+td.toLocaleString()+'</strong></div></div><p class="muted small">Top production contributors: '+(leaders.length?leaders.map(p=>esc(p.name)).join(", "):"Not available")+'. Derived from loaded player totals, not official team play-calling rates or standings.</p>';
}
function renderPowerMap(){
 const key=$("lf-power-metric")?.value||"total",desc={total:"combined yards",passing:"passing yards",rushing:"rushing yards",receiving:"receiving yards",touchdowns:"combined touchdowns"}[key];
 const arr=teams.map(t=>{const ps=rows().filter(p=>(p.teams||[]).includes(t));const val=ps.reduce((a,p)=>a+(key==="total"?(+p.passing_yards||0)+(+p.rushing_yards||0)+(+p.receiving_yards||0):key==="touchdowns"?(+p.passing_tds||0)+(+p.rushing_tds||0)+(+p.receiving_tds||0):(+p[key+"_yards"]||0)),0);return {team:t,val};}).sort((a,b)=>$("lf-power-sort")?.value==="low"?a.val-b.val:b.val-a.val);
 $("lf-power-map").innerHTML=arr.map((x,i)=>'<div class="lf-power-tile" title="'+esc(teamNames[x.team])+' · '+x.val.toLocaleString()+' '+desc+'"><strong>#'+(i+1)+' '+x.team+'</strong><span>'+x.val.toLocaleString()+'</span></div>').join("");
 $("lf-power-note").textContent="Sorted by "+desc+". Values are sums of available individual player records; teams can have incomplete or duplicated player attribution after transactions, and this is not an official team ranking.";
}
async function loadVerifiedTrails(){
 const status=$("lf-trail-status");try{
  const res=await fetch("/data/nfl-tracking-trails.json?refresh="+Date.now(),{cache:"no-store"});if(!res.ok)throw Error("No published tracking-trail file was found.");
  const data=await res.json();if(!Array.isArray(data.plays))throw Error("Tracking dataset schema is not valid.");
  trackingTrails=data;status.className="lf-trail-status ready";status.textContent="Verified coordinate dataset connected · "+data.plays.length+" play records · "+(data.source||"source metadata not supplied")+". Trails will render only for matching player records.";
 }catch(e){trackingTrails=null;status.className="lf-trail-status";status.textContent="Unavailable: "+e.message+" · No coordinates or movement paths have been invented.";}
 renderField();
}
function initializeFeatureStudio(){
 $("lf-3d-toggle").onclick=()=>{stadiumMode=!stadiumMode;$("lf-field").parentElement.classList.toggle("lf-stadium-3d",stadiumMode);$("lf-3d-toggle").textContent=stadiumMode?"RETURN TO TACTICAL VIEW":"ENTER 3D STADIUM";};
 $("lf-coverage").onchange=()=>{coverageType=$("lf-coverage").value;$("lf-coverage-note").textContent=coverageCopy[coverageType];renderField();};
 $("lf-coverage-toggle").onclick=()=>{coverageVisible=!coverageVisible;$("lf-coverage-toggle").textContent=coverageVisible?"HIDE ZONES":"SHOW ZONES";renderField();};
 $("lf-formation-refresh").onclick=recognizeFormation;
 $("lf-breakdown-prev").onclick=()=>{breakdownStep=Math.max(0,breakdownStep-1);breakdownRender();};
 $("lf-breakdown-next").onclick=()=>{breakdownStep=breakdownStep===3?0:breakdownStep+1;breakdownRender();};
 ["lf-compare-a","lf-compare-b"].forEach(id=>$(id).onchange=renderComparison);
 ["lf-power-metric","lf-power-sort"].forEach(id=>$(id).onchange=renderPowerMap);
 breakdownRender();recognizeFormation();teamIdentity();renderPowerMap();comparisonOptions();loadVerifiedTrails();
}

function setup(){
 if(!$("page-livingfield"))return;
 $("lf-team").innerHTML=teams.map(t=>'<option value="'+t+'">'+esc(teamNames[t])+'</option>').join("");
 const favorite=(()=>{try{return JSON.parse(localStorage.getItem("gridironIQDashboard")||"{}").team}catch(e){return ""}})();
 if(favorite&&teams.includes(favorite))$("lf-team").value=favorite;
 $("lf-team").addEventListener("change",()=>{playerOptions();renderTeamCharts();renderPredictive();renderPlayer();teamIdentity()});
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
 defaultDots();playerOptions();renderField();renderTeamCharts();renderPredictive();trackingStatus();initializeFeatureStudio();if(rows().length){renderPlayer();addCoreVisuals()}window.addEventListener("gridiron:players-loaded",()=>{playerOptions();renderPlayer();renderTeamCharts();renderPredictive();addCoreVisuals();comparisonOptions();teamIdentity();renderPowerMap()});
 const obs=new MutationObserver(()=>{if(rows().length){playerOptions();renderTeamCharts();renderPredictive();renderPlayer();obs.disconnect()}});obs.observe($("lf-player-card"),{childList:true,subtree:true});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup);else setup();
window.addEventListener("load",()=>{if(rows().length){playerOptions();renderTeamCharts();renderPredictive();renderPlayer()}});
})();