(function(){
"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let predictionData=null,ngsData=null,currentPlayer=null;
const TEAM_NAMES={ARI:"Arizona Cardinals",ATL:"Atlanta Falcons",BAL:"Baltimore Ravens",BUF:"Buffalo Bills",CAR:"Carolina Panthers",CHI:"Chicago Bears",CIN:"Cincinnati Bengals",CLE:"Cleveland Browns",DAL:"Dallas Cowboys",DEN:"Denver Broncos",DET:"Detroit Lions",GB:"Green Bay Packers",HOU:"Houston Texans",IND:"Indianapolis Colts",JAX:"Jacksonville Jaguars",KC:"Kansas City Chiefs",LV:"Las Vegas Raiders",LAC:"Los Angeles Chargers",LAR:"Los Angeles Rams",MIA:"Miami Dolphins",MIN:"Minnesota Vikings",NE:"New England Patriots",NO:"New Orleans Saints",NYG:"New York Giants",NYJ:"New York Jets",PHI:"Philadelphia Eagles",PIT:"Pittsburgh Steelers",SF:"San Francisco 49ers",SEA:"Seattle Seahawks",TB:"Tampa Bay Buccaneers",TEN:"Tennessee Titans",WAS:"Washington Commanders"};
const METRIC_LABELS={
 avg_time_to_throw:["Average time to throw"," sec"],avg_completed_air_yards:["Completed air yards"," yd"],
 avg_intended_air_yards:["Intended air yards"," yd"],aggressiveness:["Aggressiveness","%"],
 completion_percentage:["Completion percentage","%"],expected_completion_percentage:["Expected completion","%"],
 completion_percentage_above_expectation:["Completion above expectation","%"],passer_rating:["Passer rating",""],
 avg_air_yards:["Average air yards"," yd"],avg_yac:["Average yards after catch"," yd"],
 avg_yac_above_expectation:["YAC above expectation"," yd"],avg_cushion:["Defender cushion"," yd"],
 avg_separation:["Receiver separation"," yd"],avg_tracking_speed:["Average tracking speed"," mph"],
 max_speed:["Maximum speed"," mph"],rush_yards_over_expected:["Rushing yards over expected"," yd"],
 rush_yards_over_expected_per_att:["RYOE per attempt"," yd"],efficiency:["Rushing efficiency","%"],
 percent_attempts_gte_eight_defenders:["Runs vs. 8+ defenders","%"]
};
function metricValue(key,value){
 const n=Number(value);if(!Number.isFinite(n))return String(value);
 const pct=/percentage|aggressiveness|efficiency|percent_attempts/.test(key);
 const scale=pct&&n>0&&n<=1?100:n;
 return (Math.abs(scale)>=100?scale.toFixed(1):scale.toFixed(2))+((METRIC_LABELS[key]||[])[1]||"");
}
function renderNgs(player){
 const host=$("lf-ngs-panel");if(!host)return;
 if(!ngsData){host.innerHTML='<div class="lf-section-kicker">NEXT GEN STATS METRICS</div><p class="muted small">Loading published tracking-derived metrics…</p>';return;}
 if(ngsData.error||!ngsData.metrics?.length){host.innerHTML='<div class="lf-section-kicker">NEXT GEN STATS METRICS</div><p class="muted small">No published NGS metric records are currently available. Player coordinates are not available from this feed.</p>';return;}
 const team=(player.teams||[])[0]||"",name=String(player.name||"").trim().toLowerCase();
 let matches=ngsData.metrics.filter(r=>String(r.player_display_name||"").trim().toLowerCase()===name&&(!r.team_abbr||!team||r.team_abbr===team));
 if(!matches.length&&player.id)matches=ngsData.metrics.filter(r=>String(r.player_gsis_id||r.player_id||"")===String(player.id));
 if(!matches.length){host.innerHTML='<div class="lf-section-kicker">NEXT GEN STATS METRICS</div><p class="muted small">No matching published NGS metrics found for this player in the available '+esc(ngsData.season||"latest")+' dataset. This is not a player-location feed.</p>';return;}
 matches.sort((a,b)=>(Number(b.week)||0)-(Number(a.week)||0));
 const groups=["passing","receiving","rushing"].map(type=>({type,rows:matches.filter(r=>r.metric_type===type)})).filter(g=>g.rows.length);
 const blocks=groups.map(g=>{
  const r=g.rows[0],fields=Object.keys(METRIC_LABELS).filter(k=>r[k]!==undefined&&r[k]!==null&&Number.isFinite(Number(r[k])));
  const selected=fields.slice(0,4);
  if(!selected.length)return "";
  return '<div class="lf-ngs-group"><div class="lf-ngs-group-title">'+esc(g.type.toUpperCase())+' · '+(r.week?'WEEK '+esc(r.week):'PUBLISHED RECORD')+'</div><div class="lf-metric-grid">'+selected.map(k=>'<div class="lf-metric"><small>'+esc(METRIC_LABELS[k][0])+'</small><strong>'+esc(metricValue(k,r[k]))+'</strong></div>').join("")+'</div></div>';
 }).join("");
 host.innerHTML='<div class="lf-section-kicker">NEXT GEN STATS · '+esc(ngsData.season||"LATEST AVAILABLE")+'</div>'+blocks+'<p class="muted small">Published NFL tracking-derived metrics from nflverse. These are not raw x/y coordinates, route paths, or live player locations. Source refreshed '+esc(new Date(ngsData.retrievedAt).toLocaleDateString())+'.</p>';
}
function renderPrediction(){
 const select=$("prediction-game"),host=$("prediction-results"),status=$("prediction-status");
 if(!select||!host)return;
 if(!predictionData){status.textContent="Loading verified play-by-play and schedule data…";return;}
 const games=predictionData.predictions||[];
 if(predictionData.error||!games.length){
  select.innerHTML='<option value="">No upcoming model-ready games</option>';
  status.textContent=predictionData.error?"Prediction dataset unavailable: "+predictionData.error:"No upcoming games are currently available in the published schedule dataset. No prediction has been fabricated.";
  host.innerHTML='<p class="muted small">The prediction engine will display a matchup when schedule and historical play-by-play data are available.</p>';return;
 }
 select.innerHTML=games.map((g,i)=>'<option value="'+i+'">Week '+esc(g.week)+' · '+esc(g.awayTeam)+' at '+esc(g.homeTeam)+(g.gameDate?' · '+esc(g.gameDate):'')+'</option>').join("");
 const m=predictionData.model||{};
 status.textContent="Model trained on "+Number(m.trainingGames||0).toLocaleString()+" historical matchups · "+(m.trainingSeasons||[]).join("–")+". Chronological holdout: "+(m.holdoutSeason||"—")+".";
 function draw(){
  const g=games[Number(select.value)||0];if(!g)return;
  const hp=Math.round(g.homeWinProbability*100),ap=Math.round(g.awayWinProbability*100);
  const edges=(g.advantages||[]).map(a=>'<div class="lf-advantage-row"><span>'+esc(a.category)+'</span><strong class="'+(a.team==="Even"?"":"lf-advantage")+'">'+esc(a.team==="Even"?"Even":a.team)+'</strong></div>').join("");
  host.innerHTML='<div class="lf-prediction-teams"><div class="lf-pred-team"><small>AWAY</small><h2>'+esc(TEAM_NAMES[g.awayTeam]||g.awayTeam)+'</h2><strong>'+ap+'%</strong><span>Win probability</span></div><div class="lf-pred-vs">VS</div><div class="lf-pred-team home"><small>HOME</small><h2>'+esc(TEAM_NAMES[g.homeTeam]||g.homeTeam)+'</h2><strong>'+hp+'%</strong><span>Win probability</span></div></div>'+
  '<div class="lf-prob-track"><div class="away" style="width:'+ap+'%"></div><div class="home" style="width:'+hp+'%"></div></div>'+
  '<div class="lf-score-projection"><div><small>PROJECTED AWAY POINTS</small><strong>'+Number(g.projectedAwayPoints).toFixed(1)+'</strong></div><div><small>PROJECTED HOME POINTS</small><strong>'+Number(g.projectedHomePoints).toFixed(1)+'</strong></div></div>'+
  '<div class="lf-section-kicker">MATCHUP ADVANTAGES</div>'+edges+
  '<div class="lf-validation"><strong>MODEL VALIDATION</strong><div>Chronological holdout accuracy: '+(Number(m.holdoutAccuracy)*100).toFixed(1)+'%</div><div>Brier score: '+Number(m.holdoutBrierScore).toFixed(3)+' · '+Number(m.holdoutGames||0)+' holdout games</div><div>Pregame form samples: '+g.sampleGamesAway+' away games · '+g.sampleGamesHome+' home games</div></div>'+
  '<p class="muted small">'+esc(g.dataNote||"Statistical estimate, not a guaranteed outcome.")+' Projected score: '+esc(g.projectedScoreMethod||"")+'</p>';
 }
 select.addEventListener("change",draw);select.value="0";draw();
}
async function load(){
 try{const r=await fetch("/data/nfl-ngs-metrics.json?refresh="+Date.now(),{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);ngsData=await r.json();}catch(e){ngsData={error:e.message,metrics:[]};}
 const tracking=$("lf-tracking-status");
 if(tracking){tracking.innerHTML=ngsData&&!ngsData.error&&ngsData.recordCount?'<strong>PUBLISHED NGS METRICS CONNECTED · RAW COORDINATES UNAVAILABLE</strong><p>'+Number(ngsData.recordCount).toLocaleString()+' published player metric records · season '+esc(ngsData.season||"latest available")+'. Player speed, separation, cushion, air-yard and efficiency metrics appear when published by the source. Actual x/y player positions and frame-by-frame tracking are not included.</p><div class="lf-data-tag">METRICS AVAILABLE · NO RAW PLAYER LOCATIONS</div>':'<strong>NGS METRIC FEED UNAVAILABLE · RAW COORDINATES UNAVAILABLE</strong><p>No published player metric file is currently available. The app will not substitute simulated locations.</p>';}
 try{const r=await fetch("/data/nfl-matchup-predictions.json?refresh="+Date.now(),{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);predictionData=await r.json();}catch(e){predictionData={error:e.message,predictions:[]};}
 renderPrediction();if(currentPlayer)renderNgs(currentPlayer);
}
window.addEventListener("gridiron:field-player-selected",e=>{currentPlayer=e.detail;renderNgs(currentPlayer)});
window.addEventListener("gridiron:players-loaded",()=>{if(currentPlayer)renderNgs(currentPlayer)});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",load);else load();
})();