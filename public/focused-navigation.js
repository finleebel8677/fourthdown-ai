/* GRIDIRON IQ focused navigation: keeps every existing tool, but places related content behind simple page tabs. */
(()=>{"use strict";
const $=id=>document.getElementById(id);
const pageTabs={
 "page-overview":[["overview","Overview"],["team","My Team"],["trends","Trends"]],
 "page-players":[["stats","Player Stats"],["scout","Player Scout"],["advanced","Advanced"]],
 "page-teams":[["teams","Teams"],["insights","Team Insights"]],
 "page-matchup":[["compare","Team Comparison"],["predictions","Predictions"],["planning","Game Planning"]],
 "page-playlab":[["playbook","Playbook"],["film","Film Room"],["simulator","Simulator"],["designer","Designer"]],
 "page-notebook":[["notes","Notebook"],["picks","Draft & Picks"],["dashboard","Dashboard"]]
};
const configs={
 "page-overview":(el)=>el.querySelector("#favorite-team")?"team":el.querySelector("#season-trends-content")?"trends":"overview",
 "page-players":(el)=>el.querySelector("#iq-player-scouting")?"scout":el.id==="module-advanced"||el.id==="module-tendencies"||el.classList.contains("embedded-module-label")?"advanced":"stats",
 "page-teams":(el)=>el.querySelector("#team-intelligence-modules")||el.textContent.trim().startsWith("Team Identity")?"insights":"teams",
 "page-matchup":(el)=>el.id==="module-gameplan"||el.id==="module-gameplan-label"?"planning":el.querySelector("#prediction-engine")||el.querySelector("#matchup-advantage-meter")?"predictions":"compare",
 "page-playlab":(el)=>el.id==="module-filmroom"||el.id==="module-filmroom-label"?"film":el.id==="module-simulator"||el.id==="module-simulator-label"?"simulator":el.id==="module-designer"||el.id==="module-designer-label"?"designer":"playbook",
 "page-notebook":(el)=>el.id==="module-picks"||el.id==="module-picks-label"?"picks":el.id==="module-dashboard"||el.id==="module-dashboard-label"?"dashboard":"notes"
};
const styles=`
.iq-page-tabs{display:flex;gap:7px;overflow-x:auto;padding:5px 1px 12px;margin:0 0 17px;border-bottom:1px solid #263247;scrollbar-width:none}
.iq-page-tabs::-webkit-scrollbar{display:none}
.iq-page-tab{flex:0 0 auto;border:1px solid #263247;background:#101a29;color:#9aabc1;border-radius:5px;padding:10px 14px;font-size:11px;font-weight:800;letter-spacing:.35px}
.iq-page-tab[aria-selected="true"]{background:#123247;border-color:#00bfe5;color:#eafaff;box-shadow:inset 0 -2px #00e5ff}
.iq-tab-panel{display:none;min-width:0;animation:iqTabIn .18s ease}
.iq-tab-panel.active{display:block}
.iq-tab-panel>*:first-child{margin-top:0}
.iq-tab-empty{padding:20px;border:1px dashed #33445b;border-radius:7px;color:#8491a5;font-size:12px}
@keyframes iqTabIn{from{opacity:.75;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}
.iq-tab-panel .embedded-module-label{margin-top:12px}
.iq-intel-tabs{margin-top:14px}
@media(max-width:650px){.iq-page-tabs{position:sticky;top:58px;z-index:12;background:rgba(8,11,18,.97);padding:9px 0 10px}.iq-page-tab{padding:10px 12px}.iq-tab-panel .grid{grid-template-columns:1fr}.iq-tab-panel .three-col{grid-template-columns:1fr}}
`;
function addStyle(){if($("iq-focus-style"))return;const s=document.createElement("style");s.id="iq-focus-style";s.textContent=styles;document.head.appendChild(s)}
function buildPageTabs(pageId,defs,classify){
 const page=$(pageId);if(!page||page.dataset.iqTabsBuilt)return;
 const heading=page.querySelector(":scope > .page-heading");if(!heading)return;
 const nodes=[...page.children].filter(el=>el!==heading&&!el.classList.contains("iq-page-tabs")&&!el.classList.contains("iq-tab-panel"));
 if(!nodes.length)return;
 const bar=document.createElement("div");bar.className="iq-page-tabs";bar.setAttribute("role","tablist");bar.setAttribute("aria-label",heading.querySelector("h1")?.textContent.trim()+" sections"||"Page sections");
 const panels=new Map();
 defs.forEach(([key,label],i)=>{
  const panel=document.createElement("div");panel.className="iq-tab-panel"+(i===0?" active":"");panel.dataset.iqTabPanel=key;panel.id=pageId+"-"+key+"-panel";panel.setAttribute("role","tabpanel");
  const btn=document.createElement("button");btn.type="button";btn.className="iq-page-tab";btn.textContent=label;btn.dataset.iqTab=key;btn.setAttribute("role","tab");btn.setAttribute("aria-controls",panel.id);btn.setAttribute("aria-selected",i===0?"true":"false");
  btn.addEventListener("click",()=>activate(pageId,key,true));bar.appendChild(btn);panels.set(key,panel);
 });
 nodes.forEach(el=>{const key=classify(el);(panels.get(key)||panels.values().next().value).appendChild(el)});
 heading.insertAdjacentElement("afterend",bar);
 let anchor=bar;for(const p of panels.values()){anchor.insertAdjacentElement("afterend",p);anchor=p}
 page.dataset.iqTabsBuilt="1";
 const saved=localStorage.getItem("iqTab:"+pageId);activate(pageId,panels.has(saved)?saved:defs[0][0],false);
}
function activate(pageId,key,scroll){
 const page=$(pageId);if(!page)return;
 page.querySelectorAll(".iq-page-tab").forEach(b=>{const on=b.dataset.iqTab===key;b.setAttribute("aria-selected",on?"true":"false")});
 page.querySelectorAll(".iq-tab-panel").forEach(p=>p.classList.toggle("active",p.dataset.iqTabPanel===key));
 try{localStorage.setItem("iqTab:"+pageId,key)}catch{}
 if(scroll){const top=page.querySelector(".iq-page-tabs")?.getBoundingClientRect().top||0;window.scrollTo({top:window.scrollY+top-78,behavior:"smooth"})}
}
function initPageTabs(){Object.entries(pageTabs).forEach(([id,defs])=>buildPageTabs(id,defs,configs[id]))}
function mapModuleTab(page,requested){
 const map={"advanced":["page-players","advanced"],"tendencies":["page-players","advanced"],"gameplan":["page-matchup","planning"],"filmroom":["page-playlab","film"],"simulator":["page-playlab","simulator"],"designer":["page-playlab","designer"],"picks":["page-notebook","picks"],"dashboard":["page-notebook","dashboard"]};
 const pair=map[requested];if(pair)activate(pair[0],pair[1],false);
}
function enhanceShowPage(){
 if(typeof window.showPage!=="function"||window.showPage.__iqTabs)return;
 const original=window.showPage;
 const wrapped=function(page){mapModuleTab(null,page);return original.apply(this,arguments)};
 wrapped.__iqTabs=true;window.showPage=wrapped;
}
function buildIntelligenceTabs(){
 const root=$("iq-intelligence-center");if(!root||root.dataset.iqTabsBuilt||!root.children.length)return;
 const defs=[["overview","Overview"],["league","League"],["players","Player Insights"],["predictions","Predictions"],["teams","Team Insights"]];
 const buckets=new Map(defs.map(([k])=>[k,[]]));let current="overview";
 [...root.children].forEach(el=>{
  if(el.classList.contains("section-title")){
   const t=el.textContent.toLowerCase();
   current=t.includes("league intelligence")?"league":t.includes("trend")||t.includes("defensive intelligence")||t.includes("advanced efficiency")?"players":t.includes("prediction")?"predictions":t.includes("team intelligence")||t.includes("situational")?"teams":"overview";
  }
  buckets.get(current).push(el);
 });
 const bar=document.createElement("div");bar.className="iq-page-tabs iq-intel-tabs";bar.setAttribute("role","tablist");bar.setAttribute("aria-label","Intelligence sections");
 const panels=new Map();defs.forEach(([key,label],i)=>{const b=document.createElement("button");b.type="button";b.className="iq-page-tab";b.textContent=label;b.dataset.iqIntelTab=key;b.setAttribute("role","tab");b.setAttribute("aria-selected",i===0?"true":"false");bar.appendChild(b);const p=document.createElement("div");p.className="iq-tab-panel"+(i===0?" active":"");p.dataset.iqIntelPanel=key;panels.set(key,p);b.addEventListener("click",()=>{bar.querySelectorAll("button").forEach(x=>x.setAttribute("aria-selected",x.dataset.iqIntelTab===key?"true":"false"));panels.forEach((x,k)=>x.classList.toggle("active",k===key));try{localStorage.setItem("iqTab:intelligence",key)}catch{}})});
 root.innerHTML="";root.appendChild(bar);defs.forEach(([key])=>{const p=panels.get(key);buckets.get(key).forEach(el=>p.appendChild(el));if(!p.children.length){const empty=document.createElement("div");empty.className="iq-tab-empty";empty.textContent="No information is available in this section yet.";p.appendChild(empty)}root.appendChild(p)});
 const saved=localStorage.getItem("iqTab:intelligence");if(panels.has(saved)){bar.querySelector('[data-iq-intel-tab="'+saved+'"]')?.click()}
 root.dataset.iqTabsBuilt="1";
}
function watchIntelligence(){
 const root=$("iq-intelligence-center");if(!root)return;
 const obs=new MutationObserver(()=>{if(root.children.length&&!root.dataset.iqTabsBuilt){obs.disconnect();buildIntelligenceTabs()}});
 obs.observe(root,{childList:true});
 if(root.children.length)buildIntelligenceTabs();
}
function init(){addStyle();initPageTabs();enhanceShowPage();watchIntelligence()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();