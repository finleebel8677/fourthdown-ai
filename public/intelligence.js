/* GRIDIRON IQ verified tracking-metrics and matchup prediction UI.
   Data is loaded only from the scheduled nflverse build artifacts.
   No coordinates or client-generated prediction values are created here. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let ngsData = null, predictionData = null, playerData = null;

  async function loadJson(path) {
    const response = await fetch(path + "?v=" + Date.now(), {cache:"no-store"});
    if (!response.ok) throw new Error(path + " unavailable (" + response.status + ")");
    return response.json();
  }
  function fmt(value, suffix="") {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString(undefined,{maximumFractionDigits:2}) + suffix : "—";
  }
  function metricRows(player) {
    if (!ngsData || !Array.isArray(ngsData.metrics)) return [];
    const name = String(player.name || "").trim().toLowerCase();
    const teamSet = (player.teams || []).map(x=>String(x).toUpperCase());
    let matches = ngsData.metrics.filter(r =>
      String(r.player_display_name || "").trim().toLowerCase() === name &&
      (!teamSet.length || !r.team_abbr || teamSet.includes(String(r.team_abbr).toUpperCase()))
    );
    if (!matches.length) matches = ngsData.metrics.filter(r => String(r.player_display_name || "").trim().toLowerCase() === name);
    return matches;
  }
  function renderNgsForPlayer(player) {
    const host = $("lf-ngs-panel");
    if (!host) return;
    if (!ngsData) {
      host.innerHTML = '<div class="lf-section-kicker">NEXT GEN STATS METRICS</div><p class="muted small">Published NGS metrics are not available yet. No substitute values are shown.</p>';
      return;
    }
    const rows = metricRows(player);
    const preferred = player.position === "QB"
      ? ["avg_time_to_throw","avg_completed_air_yards","avg_intended_air_yards","aggressiveness","completion_percentage","expected_completion_percentage","completion_percentage_above_expectation","passer_rating"]
      : player.position === "RB"
      ? ["rush_yards_over_expected","rush_yards_over_expected_per_att","efficiency","percent_attempts_gte_eight_defenders","avg_time_to_throw"]
      : ["avg_separation","avg_cushion","avg_yac","avg_expected_yac","avg_yac_above_expectation","avg_air_yards","max_speed","avg_tracking_speed"];
    const available = preferred.filter(k => rows.some(r => r[k] !== null && r[k] !== undefined && Number.isFinite(Number(r[k]))));
    const keys = available.length ? available : [...new Set(rows.flatMap(r=>Object.keys(r)))].filter(k => !["player_gsis_id","player_id","player_display_name","player_position","team_abbr","season","season_type","week","metric_type"].includes(k) && rows.some(r=>Number.isFinite(Number(r[k])))).slice(0,8);
    const typeNames = {passing:"Passing",receiving:"Receiving",rushing:"Rushing"};
    const blocks = [];
    for (const key of keys) {
      const vals = rows.map(r=>Number(r[key])).filter(Number.isFinite);
      if (!vals.length) continue;
      const average = vals.reduce((a,b)=>a+b,0)/vals.length;
      const latest = rows.filter(r=>Number.isFinite(Number(r[key]))).sort((a,b)=>(Number(b.week)||0)-(Number(a.week)||0))[0];
      const label = key.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
      blocks.push('<div class="lf-metric"><small>'+esc(label)+'</small><strong>'+fmt(average)+'</strong><span class="muted small">Season weekly-row average · '+esc(typeNames[latest.metric_type] || latest.metric_type || "NGS")+'</span></div>');
    }
    host.innerHTML = '<div class="lf-section-kicker">NEXT GEN STATS · PUBLISHED METRICS</div>' +
      (blocks.length ? '<div class="lf-metric-grid">'+blocks.join("")+'</div><p class="muted small" style="margin-top:10px">From nflverse published NGS player metrics · '+esc(ngsData.season || "latest available season")+'. Values above average the available weekly metric rows for this player; this is not a coordinate feed.</p>'
      : '<p class="muted small">No matching published NGS metric rows were found for '+esc(player.name)+'. No values are inferred or substituted.</p>');
  }
  function getCurrentPlayer() {
    const id = $("lf-player")?.value;
    return (playerData?.players || []).find(p=>String(p.id)===String(id)) || null;
  }
  function renderPredictionSelect() {
    const select = $("prediction-game");
    const status = $("prediction-status");
    const host = $("prediction-results");
    if (!select || !status || !host) return;
    if (!predictionData || !Array.isArray(predictionData.predictions)) {
      select.innerHTML = '<option value="">No verified predictions available</option>';
      status.textContent = predictionData?.error || "Prediction data has not been successfully built yet.";
      host.innerHTML = '<p class="muted small">No probabilities or projected scores are displayed without a successfully trained and validated model.</p>';
      return;
    }
    const games = predictionData.predictions;
    if (!games.length) {
      select.innerHTML = '<option value="">No upcoming games in the data feed</option>';
      status.textContent = "Model built, but the current schedule feed contains no upcoming games with available pregame features.";
      host.innerHTML = '<p class="muted small">No game prediction is available at this time. Check again after the next schedule/data refresh.</p>';
      return;
    }
    select.innerHTML = games.map(g=>'<option value="'+esc(g.gameId)+'">'+esc(g.awayTeam)+' at '+esc(g.homeTeam)+' · Week '+esc(g.week)+'</option>').join("");
    select.onchange = renderSelectedPrediction;
    const m = predictionData.model || {};
    status.textContent = "Model: "+(m.name || "GRIDIRON IQ")+
      " · "+fmt(m.trainingGames)+" historical games · chronological holdout "+fmt(m.holdoutGames)+
      " games ("+esc(m.holdoutSeason || "—")+") · "+(m.status || "experimental");
    renderSelectedPrediction();
  }
  function renderSelectedPrediction() {
    const game = predictionData?.predictions?.find(g=>String(g.gameId)===$("prediction-game")?.value) || predictionData?.predictions?.[0];
    const host = $("prediction-results");
    if (!game || !host) return;
    const model = predictionData.model || {};
    const hp = Number(game.homeWinProbability), ap = Number(game.awayWinProbability);
    const valid = Number.isFinite(hp) && Number.isFinite(ap) && hp>=0 && hp<=1 && ap>=0 && ap<=1;
    const advantages = (game.advantages || []).map(a=>'<div class="lf-advantage-row"><span>'+esc(a.category)+'</span><strong>'+esc(a.team)+'</strong><span class="muted small">Δ '+fmt(a.difference)+'</span></div>').join("");
    const score = '<div class="lf-score-projection"><div><small>PROJECTED HOME POINTS</small><strong>'+fmt(game.projectedHomePoints, " pts")+'</strong><span class="muted small">'+esc(game.homeTeam)+'</span></div><div><small>PROJECTED AWAY POINTS</small><strong>'+fmt(game.projectedAwayPoints, " pts")+'</strong><span class="muted small">'+esc(game.awayTeam)+'</span></div></div>';
    host.innerHTML = '<div class="lf-prediction-teams"><div class="lf-pred-team"><small>AWAY WIN PROBABILITY</small><h2>'+esc(game.awayTeam)+'</h2><strong>'+(valid?fmt(ap*100,"%"):"—")+'</strong><span>Pregame model estimate</span></div><div class="lf-pred-vs">AT</div><div class="lf-pred-team home"><small>HOME WIN PROBABILITY</small><h2>'+esc(game.homeTeam)+'</h2><strong>'+(valid?fmt(hp*100,"%"):"—")+'</strong><span>Pregame model estimate</span></div></div>' +
      (valid?'<div class="lf-prob-track"><span class="away" style="width:'+(ap*100)+'%"></span><span class="home" style="width:'+(hp*100)+'%"></span></div>':'<p class="notice">The model output is invalid; probability display withheld.</p>')+
      score + '<div class="panel-title">Matchup advantages · recent pregame form</div>'+(advantages || '<p class="muted small">No advantage breakdown is available.</p>')+
      '<p class="muted small" style="margin-top:12px">'+esc(game.projectedScoreMethod || "Score estimate methodology not supplied.")+'</p>'+
      '<div class="notice" style="margin-top:12px"><strong>MODEL VALIDATION</strong><br>Holdout accuracy: '+fmt(model.holdoutAccuracy*100,"%")+' · Baseline: '+fmt(model.baselineAccuracy*100,"%")+'<br>Brier score: '+fmt(model.holdoutBrierScore)+' · Baseline Brier: '+fmt(model.baselineBrierScore)+'<br>'+esc(model.performanceNote || "Experimental estimates only.")+'</div>'+
      '<p class="muted small">'+esc(game.dataNote || "Generated from historical NFL play-by-play.")+' Injuries and inactive lists may not be included.</p>';
  }
  function renderMatchupPrediction() {
    const home = $("match-home")?.value, away = $("match-away")?.value, box = $("match-result");
    if (!home || !away || !box || !predictionData?.predictions) return;
    const game = predictionData.predictions.find(g=>g.homeTeam===home && g.awayTeam===away || g.homeTeam===away && g.awayTeam===home);
    if (!game) return;
    box.innerHTML = '<div class="eyebrow">MODEL-POWERED MATCHUP</div><div class="panel-title">'+esc(home)+' vs. '+esc(away)+'</div><p class="muted small">A verified upcoming schedule match was found. Full probability and model validation details are shown in the NFL Matchup Predictions panel below.</p><button class="btn secondary" id="open-prediction-details">VIEW FULL FORECAST</button>';
    $("open-prediction-details")?.addEventListener("click",()=>{showPage("matchup");$("prediction-game").value=game.gameId;renderSelectedPrediction();$("prediction-engine")?.scrollIntoView({behavior:"smooth"});});
  }
  async function init() {
    const playerPromise = loadJson("/data/nfl-players.json").catch(()=>null);
    const ngsPromise = loadJson("/data/nfl-ngs-metrics.json").catch(error=>({error:error.message,metrics:[]}));
    const predPromise = loadJson("/data/nfl-matchup-predictions.json").catch(error=>({error:error.message,predictions:[]}));
    [playerData,ngsData,predictionData] = await Promise.all([playerPromise,ngsPromise,predPromise]);
    if ($("lf-ngs-panel")) {
      if (playerData && Array.isArray(playerData.players)) renderNgsForPlayer(getCurrentPlayer() || playerData.players[0]);
      else $("lf-ngs-panel").innerHTML='<div class="lf-section-kicker">NEXT GEN STATS</div><p class="muted small">Player dataset is not available.</p>';
    }
    $("lf-player")?.addEventListener("change",()=>{const p=getCurrentPlayer();if(p)renderNgsForPlayer(p);});
    window.addEventListener("gridiron:players-loaded",()=>{if(playerData?.players?.length){renderNgsForPlayer(getCurrentPlayer() || playerData.players[0]);}});
    renderPredictionSelect();
    $("match-home")?.addEventListener("change",renderMatchupPrediction);
    $("match-away")?.addEventListener("change",renderMatchupPrediction);
    renderMatchupPrediction();
  }
  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
})();