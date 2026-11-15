/* GRIDIRON '99 — isolated game prototype.
   Player names/team associations are loaded from the existing nflverse-derived
   dataset in /data/nfl-players.json. No existing GRIDIRON IQ files are modified. */
(() => {
  "use strict";
  const teams = [
    ["ARI","Arizona Cardinals"],["ATL","Atlanta Falcons"],["BAL","Baltimore Ravens"],["BUF","Buffalo Bills"],
    ["CAR","Carolina Panthers"],["CHI","Chicago Bears"],["CIN","Cincinnati Bengals"],["CLE","Cleveland Browns"],
    ["DAL","Dallas Cowboys"],["DEN","Denver Broncos"],["DET","Detroit Lions"],["GB","Green Bay Packers"],
    ["HOU","Houston Texans"],["IND","Indianapolis Colts"],["JAC","Jacksonville Jaguars"],["KC","Kansas City Chiefs"],
    ["LV","Las Vegas Raiders"],["LAC","Los Angeles Chargers"],["LA","Los Angeles Rams"],["MIA","Miami Dolphins"],
    ["MIN","Minnesota Vikings"],["NE","New England Patriots"],["NO","New Orleans Saints"],["NYG","New York Giants"],
    ["NYJ","New York Jets"],["PHI","Philadelphia Eagles"],["PIT","Pittsburgh Steelers"],["SF","San Francisco 49ers"],
    ["SEA","Seattle Seahawks"],["TB","Tampa Bay Buccaneers"],["TEN","Tennessee Titans"],["WSH","Washington Commanders"]
  ];
  const aliases = { JAX:"JAC", WAS:"WSH", LAR:"LA" };
  const $ = id => document.getElementById(id);
  const screens = ["home","franchise","game","result","draft"];
  const show = id => screens.forEach(s => $(s).classList.toggle("hidden",s!==id));
  const saveKey = "gridiron99-franchise-v1";
  let playerData = [];
  let dataSeason = "—";
  let franchise = null;
  let opponent = null;
  let game = null;
  let selectedMode = "standard";
  let draft = null;
  let selectedDraftId = null;
  let raf = 0;
  let lastFrame = 0;
  const canvas = $("field");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  function rating(p) {
    const pos = p.position;
    let base = 58;
    if (pos==="QB") base = 61 + Math.min(30,(p.passing_yards||0)/180) + Math.min(8,(p.passing_tds||0)*.5);
    else if (["WR","TE"].includes(pos)) base = 58 + Math.min(25,(p.receiving_yards||0)/55) + Math.min(10,(p.receptions||0)/8);
    else if (pos==="RB" || pos==="FB") base = 58 + Math.min(24,(p.rushing_yards||0)/45) + Math.min(8,(p.rushing_tds||0)*2);
    else if (["CB","S","SAF","LB","DE","DT","DL","EDGE"].includes(pos)) base = 60 + Math.min(22,(p.def_tackles_solo||0)/2) + Math.min(10,(p.def_sacks||0)*2+(p.def_interceptions||0)*2);
    else base = 65 + Math.min(12,(p.games||0)*.7);
    return Math.max(55,Math.min(99,Math.round(base)));
  }
  function teamPlayers(code) {
    return playerData.filter(p => (p.teams||[]).some(t => (aliases[t]||t)===code));
  }
  function renderTeams() {
    $("team-grid").innerHTML = teams.map(([code,name]) =>
      '<button class="team-card" data-team="'+code+'"><strong>'+code+'</strong><span>'+name+'</span></button>'
    ).join("");
    document.querySelectorAll("[data-team]").forEach(b=>b.addEventListener("click",()=>selectTeam(b.dataset.team)));
  }
  function loadSave() {
    try { const raw=localStorage.getItem(saveKey); return raw?JSON.parse(raw):null; } catch { return null; }
  }
  function persist() { try { localStorage.setItem(saveKey,JSON.stringify(franchise)); } catch {} }
  function selectTeam(code) {
    if (selectedMode === "league") {
      startLeagueDraft(code);
      return;
    }
    const squad = teamPlayers(code);
    if (!squad.length) {
      $("data-status").textContent = "ROSTER DATA UNAVAILABLE";
      return;
    }
    franchise = { team:code, mode:"standard", wins:0, losses:0, week:1, season:1, titles:0, roster:squad.map(p=>p.id), history:[] };
    persist(); renderFranchise(); show("franchise");
  }
  function setMode(mode) {
    selectedMode=mode;
    $("standard-mode").classList.toggle("secondary",mode!=="standard");
    $("league-mode").classList.toggle("secondary",mode!=="league");
    $("mode-description").textContent=mode==="league"
      ?"League Reset: every player in the available NFL dataset enters one shared 32-team snake draft. You make every pick for your team; CPU teams draft automatically."
      :"Standard Franchise: start with each team's existing NFL player group.";
  }
  function startLeagueDraft(code) {
    const unique=[...new Map(playerData.map(p=>[p.id,p])).values()].sort((a,b)=>rating(b)-rating(a));
    if(!unique.length){$("data-status").textContent="PLAYER POOL UNAVAILABLE";return;}
    draft={userTeam:code,pool:unique,available:unique.map(p=>p.id),rosters:Object.fromEntries(teams.map(t=>[t[0],[]])),pick:0,board:[],rounds:Math.ceil(unique.length/32)};
    selectedDraftId=null;
    runCpuDraft();
    show("draft");
  }
  function draftTeamAt(index) {
    const round=Math.floor(index/32),slot=index%32;
    const teamIndex=round%2===0?slot:31-slot;
    return teams[teamIndex][0];
  }
  function runCpuDraft() {
    if(!draft)return;
    while(draft.pick<draft.pool.length && draftTeamAt(draft.pick)!==draft.userTeam){
      const team=draftTeamAt(draft.pick);
      const player=draft.pool.find(p=>draft.available.includes(p.id));
      if(!player)break;
      makeDraftSelection(player.id,team);
    }
    renderDraft();
  }
  function makeDraftSelection(playerId,team) {
    const player=draft.pool.find(p=>p.id===playerId);
    if(!player||!draft.available.includes(playerId))return;
    draft.available=draft.available.filter(id=>id!==playerId);
    draft.rosters[team].push(playerId);
    draft.board.push({pick:draft.pick+1,round:Math.floor(draft.pick/32)+1,team,player});
    draft.pick++;
  }
  function renderDraft() {
    if(!draft)return;
    if(draft.pick>=draft.pool.length){completeLeagueDraft();return;}
    const currentTeam=draftTeamAt(draft.pick);
    $("draft-title").textContent=getTeamName(draft.userTeam).toUpperCase()+" • LEAGUE RESET";
    $("draft-progress").textContent="Your team picks at #"+(draft.pick+1)+". CPU teams automatically fill their rosters.";
    $("draft-round").textContent=Math.floor(draft.pick/32)+1;
    $("draft-pick").textContent=draft.pick+1;
    $("draft-left").textContent=draft.available.length;
    $("draft-selected").textContent=selectedDraftId?"Selected: "+(draft.pool.find(p=>p.id===selectedDraftId)?.name||"Player"):"Select a player";
    $("make-pick").disabled=!selectedDraftId||currentTeam!==draft.userTeam;
    $("draft-players").innerHTML=draft.pool.filter(p=>draft.available.includes(p.id))
      .filter(p=>(($("draft-search").value||"").trim()===""||p.name.toLowerCase().includes($("draft-search").value.trim().toLowerCase())))
      .filter(p=>$("draft-position").value==="ALL"||p.position===$("draft-position").value)
      .slice(0,28).map(p=>'<button class="team-card draft-option" data-player="'+escapeHtml(p.id)+'"><strong>'+escapeHtml(p.name)+' • '+rating(p)+'</strong><span>'+escapeHtml(p.position||"—")+' • '+escapeHtml((p.teams||[]).join("/"))+'</span></button>').join("")||"<p>No matching players. Change the search or position filter.</p>";
    document.querySelectorAll(".draft-option").forEach(b=>b.addEventListener("click",()=>{selectedDraftId=b.dataset.player;renderDraft();}));
    $("draft-board").innerHTML=draft.board.slice(-20).reverse().map(p=>'<div class="player"><div><b>#'+p.pick+' '+escapeHtml(p.player.name)+'</b><br><span>'+p.team+' • '+escapeHtml(p.player.position||"—")+'</span></div><b>'+rating(p.player)+'</b></div>').join("");
  }
  function completeLeagueDraft() {
    const roster=draft.rosters[draft.userTeam];
    franchise={team:draft.userTeam,mode:"league",leagueRosters:draft.rosters,wins:0,losses:0,week:1,season:1,titles:0,roster,history:[]};
    persist();draft=null;renderFranchise();show("franchise");
  }
  function getTeamName(code) { return teams.find(t=>t[0]===code)?.[1] || code; }
  function getRoster() {
    const ids = new Set(franchise.roster);
    return playerData.filter(p=>ids.has(p.id) && (franchise.mode==="league" || (p.teams||[]).some(t=>(aliases[t]||t)===franchise.team)));
  }
  function renderFranchise() {
    $("team-title").textContent = getTeamName(franchise.team).toUpperCase();
    $("record").textContent = franchise.wins+"–"+franchise.losses+" • SEASON "+franchise.season;
    $("wins").textContent=franchise.wins; $("losses").textContent=franchise.losses;
    $("week").textContent=Math.min(franchise.week,17)+" / 17"; $("championships").textContent=franchise.titles;
    const opponents=teams.filter(t=>t[0]!==franchise.team);
    opponent=opponents[(franchise.week*7+3)%opponents.length];
    $("opponent").textContent="WEEK "+franchise.week;
    $("matchup").textContent=franchise.team+" vs "+opponent[0];
    $("matchup-note").textContent=getTeamName(franchise.team)+" vs "+opponent[1]+" • 17-game season";
    const roster=getRoster().sort((a,b)=>rating(b)-rating(a)).slice(0,18);
    $("roster-count").textContent=roster.length+" PLAYERS";
    $("roster").innerHTML=roster.map(p=>'<div class="player"><div><b>'+escapeHtml(p.name)+'</b><br><span>'+escapeHtml(p.position||"—")+'</span></div><b>'+rating(p)+'</b></div>').join("") || "<p>No roster data available for this team.</p>";
  }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function startGame() {
    if (!franchise) return;
    game={home:0,away:0,quarter:1,clock:45,down:1,toGo:10,spot:20,active:false,player:{x:190,y:245},receiver:{x:510,y:150},defenders:[],ball:null,mode:"idle",plays:0,finished:false,aim:{x:560,y:150},sprint:false,dodge:0,team:franchise.team,opponent:opponent[0]};
    $("game-title").textContent=franchise.team+"  vs  "+opponent[0];
    $("play-status").textContent="Kickoff! Return the opening kick.";
    $("snap").textContent="START OFFENSE";
    $("score").textContent="0 — 0"; $("quarter").textContent="1ST"; $("clock").textContent="0:45"; $("down").textContent="1ST & 10";
    show("game"); cancelAnimationFrame(raf); lastFrame=0; raf=requestAnimationFrame(loop); beginKickReturn();
  }
  function beginKickReturn() {
    if(!game||game.finished||game.active)return;
    game.active=true;game.mode="kickReturn";game.player={x:112,y:194};game.ball={x:112,y:165};
    game.defenders=[0,1,2,3,4].map((_,i)=>({x:390+i*92,y:65+i*58,speed:42+Math.random()*24}));
    game.receiver={x:game.player.x,y:game.player.y};game.sprint=false;game.dodge=0;
    $("snap").textContent="START OFFENSE";
    $("play-status").textContent="KICK RETURN: sprint, dodge defenders, and look for open grass.";
  }
  function finishKickReturn(touchdown=false) {
    if(!game||!game.active||game.mode!=="kickReturn")return;
    game.active=false;game.mode="idle";game.ball=null;game.sprint=false;
    if(touchdown){game.home+=6;game.spot=20;$("play-status").textContent="KICK RETURN TOUCHDOWN! +6";}
    else {game.spot=Math.max(15,Math.min(99,Math.round(15+(game.player.x-112)/8.2)));$("play-status").textContent="RETURN COMPLETE: "+(game.spot-15)+" YARD RETURN. Start your offense.";}
    game.down=1;game.toGo=10;game.plays++;
    updateHud();
    $("snap").textContent="START OFFENSE";
    if(touchdown && game.plays<20) setTimeout(beginKickReturn,550);
    if(game.plays>=20){endGame();}
  }
  function snap() {
    if(!game||game.finished||game.active)return;
    game.active=true; game.mode="run"; game.plays++;
    game.player={x:160+game.spot*6.1,y:245};
    game.receiver={x:game.player.x+300,y:145};
    game.defenders=[0,1,2,3].map((_,i)=>({x:game.player.x+260+i*95,y:100+i*65,speed:45+Math.random()*22}));
    game.ball=null; game.sprint=false;
    $("play-status").textContent="Ball snapped. Find a lane and avoid the defense.";
    updateHud();
  }
  function finishPlay(kind) {
    if(!game||!game.active)return;
    game.active=false; game.sprint=false; game.ball=null;
    const oldScore=game.home+game.away;
    const gain=Math.max(-2,Math.round((game.player.x-(160+game.spot*6.1))/6));
    if(kind==="touchdown" || game.player.x>=875){
      game.home+=7; game.spot=20; game.down=1; game.toGo=10;
      $("play-status").textContent="TOUCHDOWN! +7";
    } else if(kind==="turnover"){
      game.spot=20; game.down=1; game.toGo=10;
      const cpu=Math.random()<.34?7:Math.random()<.45?3:0; game.away+=cpu;
      $("play-status").textContent="TURNOVER. Opponent drive: "+cpu+" points.";
    } else {
      game.spot=Math.max(1,Math.min(99,game.spot+gain));
      if(gain>=game.toGo){game.down=1;game.toGo=10; $("play-status").textContent="FIRST DOWN. "+gain+" yards.";}
      else {game.down++;game.toGo=Math.max(1,game.toGo-gain);$("play-status").textContent=kind==="tackle"?"TACKLED. "+gain+" yards.":"PLAY OVER. "+gain+" yards.";}
      if(game.down>4){game.spot=20;game.down=1;game.toGo=10;const cpu=Math.random()<.35?7:Math.random()<.4?3:0;game.away+=cpu;$("play-status").textContent="TURNOVER ON DOWNS. Opponent: "+cpu+" points.";}
    }
    game.clock-=9;
    if(game.clock<=0){game.quarter++;game.clock=45;if(game.quarter>4){endGame();return;}}
    if(game.plays>=20){endGame();return;}
    updateHud();
    if(game.home+game.away>oldScore) setTimeout(beginKickReturn,550);
  }
  function updateHud(){
    $("score").textContent=game.home+" — "+game.away;
    $("quarter").textContent=["","1ST","2ND","3RD","4TH"][Math.min(game.quarter,4)];
    $("clock").textContent="0:"+String(Math.max(0,game.clock)).padStart(2,"0");
    $("down").textContent=game.down+(["ST","ND","RD","TH"][Math.min(game.down-1,3)])+" & "+game.toGo;
  }
  function endGame(){
    game.finished=true;game.active=false;cancelAnimationFrame(raf);
    const win=game.home>=game.away;
    if(win)franchise.wins++;else franchise.losses++;
    franchise.history.push({week:franchise.week,opponent:game.opponent,for:game.home,against:game.away,win});
    franchise.week++;
    if(franchise.week>17){
      if(franchise.wins>=10){franchise.titles++;$("result-copy").textContent="Season complete. Your team qualifies for the postseason and wins the championship in this prototype season wrap-up.";}
      else $("result-copy").textContent="Season complete. The offseason is here. Build your roster and try again.";
      franchise.season++;franchise.week=1;franchise.wins=0;franchise.losses=0;
    } else $("result-copy").textContent=win?"A win goes in the books. Your franchise record has been updated.":"Tough loss. Regroup and get ready for next week.";
    persist();$("result-title").textContent=win?"VICTORY!":"FINAL WHISTLE";
    $("result-score").textContent=game.home+" — "+game.away;
    $("result-record").textContent=franchise.wins+"–"+franchise.losses;
    show("result");
  }
  function drawField(){
    const w=canvas.width,h=canvas.height;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle="#1d583b";ctx.fillRect(0,0,w,h);
    for(let x=0;x<w;x+=96){ctx.fillStyle=(x/96)%2?"#205f40":"#1a5237";ctx.fillRect(x,0,96,h);}
    ctx.strokeStyle="#d2e4bb";ctx.lineWidth=3;
    for(let x=70;x<w;x+=82){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();ctx.fillStyle="#e0e8c9";ctx.font="16px monospace";ctx.fillText(String(Math.round((x-70)/8)+10),x+4,28);}
    ctx.fillStyle="#e5e8c5";ctx.fillRect(0,0,9,h);ctx.fillRect(w-9,0,9,h);
    ctx.fillStyle="#d8e6c0";ctx.font="bold 18px monospace";ctx.fillText(game.team,22, h-20);ctx.fillText(game.opponent, w-65,h-20);
    if(game.active){
      ctx.strokeStyle="#f6d36f";ctx.setLineDash([8,8]);ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(game.player.x+65,45);ctx.lineTo(game.player.x+65,h-45);ctx.stroke();ctx.setLineDash([]);
      if(game.mode!=="kickReturn") drawPlayer(game.receiver.x,game.receiver.y,"#f2cf72","#6d4822");
      game.defenders.forEach(d=>drawPlayer(d.x,d.y,"#8bc2e9","#244c75"));
      drawPlayer(game.player.x,game.player.y,"#f4d35e","#9d3e31",true);
      if(game.ball){ctx.fillStyle="#9b5b2b";ctx.fillRect(game.ball.x-7,game.ball.y-4,14,8);ctx.strokeStyle="#f7e4bd";ctx.strokeRect(game.ball.x-7,game.ball.y-4,14,8);}
      if(game.mode==="kickReturn"){ctx.fillStyle="#fff1b2";ctx.font="bold 17px monospace";ctx.fillText("KICK RETURN",w/2-75,38);}
      if(game.mode==="kickReturn"){ctx.fillStyle="#fff1b2";ctx.font="bold 17px monospace";ctx.fillText("KICK RETURN",w/2-75,38);}
      if(game.mode==="pass"){ctx.strokeStyle="#fff0a5";ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(game.player.x,game.player.y-15);ctx.lineTo(game.aim.x,game.aim.y);ctx.stroke();ctx.setLineDash([]);}
    }else{
      ctx.fillStyle="#dbe8c6";ctx.font="bold 20px monospace";ctx.fillText("GRIDIRON '99",w/2-110,h/2-12);
      ctx.font="13px monospace";ctx.fillText("SNAP THE BALL TO START",w/2-112,h/2+18);
    }
  }
  function drawPlayer(x,y,jersey,pants,controlled=false){
    const px=Math.round(x/4)*4,py=Math.round(y/4)*4;
    ctx.fillStyle="#10150f";ctx.fillRect(px-13,py+19,11,15);ctx.fillRect(px+3,py+19,11,15);
    ctx.fillStyle=pants;ctx.fillRect(px-14,py+14,29,9);
    ctx.fillStyle=jersey;ctx.fillRect(px-14,py-5,29,21);
    ctx.fillStyle="#f0c59a";ctx.fillRect(px-10,py-20,20,16);
    ctx.fillStyle="#18221a";ctx.fillRect(px-13,py-23,25,7);ctx.fillRect(px-15,py-20,4,11);
    ctx.fillStyle="#fff";ctx.font="bold 10px monospace";ctx.fillText(controlled?(game&&game.mode==="kickReturn"?"KR":"QB"):"",px-7,py+9);
    if(controlled){ctx.strokeStyle="#fff3b0";ctx.lineWidth=2;ctx.strokeRect(px-18,py-27,36,65);}
  }
  function loop(ts){
    if(!game||game.finished)return;
    const dt=Math.min(.04,(ts-(lastFrame||ts))/1000);lastFrame=ts;
    if(game.active){
      const p=game.player;
      if(game.mode==="kickReturn"&&game.ball){game.ball.x=p.x;game.ball.y=p.y-24;}
      if(game.mode==="pass"&&game.ball){
        const b=game.ball;b.x+=(b.tx-b.x)*Math.min(1,dt*4.5);b.y+=(b.ty-b.y)*Math.min(1,dt*4.5);
        if(Math.hypot(b.tx-b.x,b.ty-b.y)<10){
          if(Math.random()<.78){game.player.x=b.tx;game.player.y=b.ty;game.mode="run";game.ball=null;$("play-status").textContent="CATCH! Run after the reception.";}
          else {game.ball=null;finishPlay("incomplete");}
        }
      }
      game.defenders.forEach(d=>{
        const dx=p.x-d.x,dy=p.y-d.y,dist=Math.hypot(dx,dy)||1;
        d.x+=(dx/dist)*d.speed*dt;d.y+=(dy/dist)*d.speed*dt;
        if(dist<24&&game.active&&game.dodge<=0){
          if(game.mode==="kickReturn")finishKickReturn(false);
          else finishPlay("tackle");
        }
      });
      if(game.dodge>0)game.dodge-=dt;
      if(p.x>875&&game.active){
        if(game.mode==="kickReturn")finishKickReturn(true);
        else finishPlay("touchdown");
      }
      if((p.y<48||p.y>342)&&game.active){
        if(game.mode==="kickReturn")finishKickReturn(false);
        else finishPlay("tackle");
      }
    }
    drawField();raf=requestAnimationFrame(loop);
  }
  function move(dir){
    if(!game||!game.active)return;
    const step=game.sprint?14:8;
    if(dir==="left")game.player.x=Math.max(25,game.player.x-step);
    if(dir==="right")game.player.x=Math.min(900,game.player.x+step);
    if(dir==="up")game.player.y=Math.max(48,game.player.y-step);
    if(dir==="down")game.player.y=Math.min(342,game.player.y+step);
  }
  function pass(){
    if(!game||!game.active)return;
    if(game.mode==="run"){
      game.mode="pass";
      game.aim={x:Math.min(850,game.player.x+320),y:Math.max(55,Math.min(335,game.receiver.y))};
      $("play-status").textContent="Tap the field to aim, then tap PASS / THROW again.";
      $("pass").textContent="THROW";
    }else if(game.mode==="pass"){
      game.ball={x:game.player.x,y:game.player.y-10,tx:game.aim.x,ty:game.aim.y};
      $("play-status").textContent="Ball in the air.";
      $("pass").textContent="PASS / THROW";
    }
  }
  $("snap").addEventListener("click",snap);
  $("kick-return").addEventListener("click",beginKickReturn);
  $("pass").addEventListener("click",pass);
  $("sprint").addEventListener("pointerdown",()=>{if(game)game.sprint=true;});
  ["pointerup","pointerleave","pointercancel"].forEach(e=>$("sprint").addEventListener(e,()=>{if(game)game.sprint=false;}));
  $("dodge").addEventListener("click",()=>{if(game&&game.active){game.dodge=.65;game.player.x=Math.min(880,game.player.x+24);game.player.y=game.player.y<195?game.player.y+32:game.player.y-32;}});
  document.querySelectorAll("[data-move]").forEach(b=>{
    const dir=b.dataset.move;
    b.addEventListener("pointerdown",e=>{e.preventDefault();move(dir);});
  });
  canvas.addEventListener("pointerdown",e=>{
    if(!game||!game.active||game.mode!=="pass")return;
    const r=canvas.getBoundingClientRect(),sx=canvas.width/r.width,sy=canvas.height/r.height;
    game.aim={x:Math.max(game.player.x+50,Math.min(900,(e.clientX-r.left)*sx)),y:Math.max(45,Math.min(345,(e.clientY-r.top)*sy))};
    $("play-status").textContent="Target set. Tap THROW.";
  });
  $("play-game").addEventListener("click",startGame);
  $("standard-mode").addEventListener("click",()=>setMode("standard"));
  $("league-mode").addEventListener("click",()=>setMode("league"));
  $("make-pick").addEventListener("click",()=>{if(!draft||!selectedDraftId||draftTeamAt(draft.pick)!==draft.userTeam)return;makeDraftSelection(selectedDraftId,draft.userTeam);selectedDraftId=null;runCpuDraft();});
  $("draft-search").addEventListener("input",renderDraft);
  $("draft-position").addEventListener("change",renderDraft);
  $("draft-exit").addEventListener("click",()=>{if(confirm("Leave this draft? Its unsaved progress will be lost.")){draft=null;show("home");}});
  $("exit-game").addEventListener("click",()=>{cancelAnimationFrame(raf);renderFranchise();show("franchise");});
  $("continue-franchise").addEventListener("click",()=>{renderFranchise();show("franchise");});
  $("rematch").addEventListener("click",startGame);
  $("switch-team").addEventListener("click",()=>show("home"));
  $("back-home").addEventListener("click",()=>show("home"));
  $("reset-save").addEventListener("click",()=>{if(confirm("Reset this franchise save?")){localStorage.removeItem(saveKey);franchise=null;show("home");}});
  document.addEventListener("keydown",e=>{
    const map={ArrowLeft:"left",a:"left",ArrowRight:"right",d:"right",ArrowUp:"up",w:"up",ArrowDown:"down",s:"down"};
    if(map[e.key]){e.preventDefault();move(map[e.key]);}
    if(e.key===" "){e.preventDefault();if(game&&!game.active)snap();}
  });

  async function init(){
    renderTeams();
    const existing=loadSave();
    try{
      const response=await fetch("/data/nfl-players.json",{cache:"no-store"});
      if(!response.ok)throw new Error("NFL player dataset not available");
      const data=await response.json();
      playerData=Array.isArray(data.players)?data.players:[];
      dataSeason=data.season||"—";
      $("data-status").textContent=playerData.length.toLocaleString()+" NFL PLAYER RECORDS • "+dataSeason;
    }catch(err){
      $("data-status").textContent="NFL PLAYER DATA UNAVAILABLE";
      $("data-status").title=err.message;
    }
    if(existing&&playerData.length){
      const ids=new Set(playerData.map(p=>p.id));
      if(existing.roster?.some(id=>ids.has(id))){franchise=existing;renderFranchise();show("franchise");}
    }
  }
  init();
})();