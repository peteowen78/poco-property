/* ============================================================
   POCO DEAL TOOL — Phase 1 working prototype
   Three screens: Deals list · Property (Refurb + Deal) · Settings
   Calculations are lifted straight from the St Helens workbook,
   with stamp duty updated to the 2026 SPV (limited-company) rules.
   Data is saved to Claude's shared storage so both of you see the
   same deals; if that's unavailable it falls back to memory only.
   ============================================================ */

/* ---------- cost library (defaults from the refurb sheet; editable per deal) ---------- */
const UNIT_LABEL = {fixed:"", unit:"Qty", room:"Rooms", sqm:"m²", metre:"Metres", day:"Days", wall:"Walls"};
const needsQty = u => u !== "fixed";

const LIBRARY = [
 {cat:"External works", items:[
   ["roof_new","New roof (terraced)","fixed",5000],["roof_min","Minor roof works","fixed",50],
   ["chim_pt","Chimney – pointing","fixed",1000],["chim_min","Chimney – minor works","fixed",100],
   ["gut_f","Front gutters","fixed",450],["gut_r","Rear gutters","fixed",300],
   ["fascia","Fascia & soffits","fixed",1200],["ext_door","External door (non-composite)","unit",450],
   ["windows","Windows","unit",400],["garden","Garden work","day",120],
   ["fence","Fence","fixed",700],["pointing","Pointing","wall",1400]]},
 {cat:"Kitchen", items:[
   ["k_suite","New suite","fixed",2500],["k_floor","Flooring","fixed",225],["k_strip","Strip wallpaper / tiles","fixed",175],
   ["k_skim","Skim throughout","fixed",400],["k_paint","Paint throughout","fixed",175],["k_ceil","Re-board ceiling","sqm",55],
   ["k_rad","Radiator","fixed",175],["k_idoor","Internal door w/ casing","fixed",100],["k_fdoor","Fire door w/ casing","fixed",350],
   ["k_skirt","Skirting","fixed",150],["k_smoke","Smoke alarm","fixed",100],["k_pane","Blown window pane","unit",50]]},
 {cat:"Bathroom", items:[
   ["b_suite","New suite","fixed",1750],["b_floor","Flooring","fixed",225],["b_strip","Strip wallpaper / tiles","fixed",175],
   ["b_skim","Skim throughout","fixed",400],["b_paint","Paint throughout","fixed",175],["b_ceil","Re-board ceiling","sqm",55],
   ["b_rad","Radiator","fixed",200],["b_idoor","Internal door w/ casing","fixed",100]]},
 {cat:"WC", items:[
   ["wc_suite","New suite","fixed",275],["wc_floor","Flooring","fixed",100],["wc_strip","Strip wallpaper / tiles","fixed",75],
   ["wc_skim","Skim throughout","fixed",200],["wc_paint","Paint throughout","fixed",100],["wc_ceil","Re-board ceiling","fixed",100],
   ["wc_rad","Radiator","fixed",75],["wc_idoor","Internal door w/ casing","fixed",100]]},
 {cat:"Bedrooms / reception / hallway / landing", items:[
   ["r_floor","Flooring","room",225],["r_strip","Strip wallpaper","room",175],["r_skim","Skim throughout","room",400],
   ["r_paint","Paint throughout","room",175],["r_ceil","Re-board ceiling","sqm",55],["r_part","Partition wall","sqm",55],
   ["r_rad","Radiator","fixed",175],["r_idoor","Internal door w/ casing","fixed",100],["r_fdoor","Fire door w/ casing","fixed",350],
   ["r_skirt","Skirting","room",150],["r_smoke","Smoke alarm","room",100],["r_pane","Blown window pane","unit",50]]},
 {cat:"Flooring breakdown", items:[
   ["fb_carp","Carpet","sqm",8],["fb_carp_u","Carpet underlay","sqm",5],["fb_lam","Laminate","sqm",12],["fb_lam_u","Laminate underlay","sqm",2]]},
 {cat:"Other", items:[
   ["o_boil","New boiler (fitted)","fixed",1500],["o_boil_rl","Relocate boiler","fixed",1500],
   ["o_heat","Full heating inc. radiators","fixed",2500],["o_rewire","Full rewire inc. consumer unit","fixed",2500],
   ["o_rewire_p","Partial rewire","fixed",1000],["o_cu","New consumer unit","fixed",100],["o_iso","Isolation switch","fixed",50],
   ["o_dpc","Damp proof course","metre",120],["o_under","Underpinning","metre",1000],["o_wood","Woodworm treatment","fixed",500],
   ["o_lintel","Replace lintel","fixed",400]]},
 {cat:"Extensions", items:[
   ["e_ens_i","En-suite (2m² internal)","fixed",3000],["e_ens_e","En-suite (2m² external)","fixed",7000],["e_loft","Loft conversion","fixed",25000]]},
];
const ITEM = {}; LIBRARY.forEach(c=>c.items.forEach(([id,nm,unit,rate])=>ITEM[id]={id,nm,unit,rate,cat:c.cat}));

const DEFAULT_ASSUMPTIONS = {
  ltvPct:75, mortgageRate:5.5, stressRate:8, mgmtPct:10, moePct:15,
  solicitor:1500, broker:1000, costOfMoney:2500, corpTaxPct:19,
  companyName:"Poco Property Limited",
  companyAddress:"2 Morris Park, Hartford, Northwich, Cheshire CW8 1SB",
  directorNames:"Peter Owen & Caroline Owen"
};
const STAGES = ["Lead","Viewing","Analysed","Offer made","Agreed","Completed","Rejected"];
// compliance certificates tracked on owned properties
const CERTS = [["gas","Gas Safety","Annual"],["eicr","Electrical (EICR)","5-yearly"],["epc","EPC","10-yearly"],["insurance","Insurance renewal","Annual"]];
function daysTo(dateStr){ if(!dateStr) return null; const dt=new Date(dateStr+"T00:00:00"); if(isNaN(dt)) return null; return Math.round((dt-new Date(new Date().toDateString()))/86400000); }
function certStatus(dateStr){
  const dt=daysTo(dateStr);
  if(dt===null) return {label:"Not set", cls:"muted", days:null};
  if(dt<0)  return {label:"Overdue",  cls:"bad",  days:dt};
  if(dt<=60) return {label:"Due soon", cls:"warn", days:dt};
  return {label:"Valid", cls:"good", days:dt};
}
function loanInterest(amount,rate,dateLoaned,paybackDate){
  const a=num(amount), r=num(rate);
  if(!a || !r || !dateLoaned || !paybackDate) return null;
  const d1=new Date(dateLoaned+"T00:00:00"), d2=new Date(paybackDate+"T00:00:00");
  if(isNaN(d1) || isNaN(d2)) return null;
  const days=(d2-d1)/86400000;
  if(days<=0) return null;
  return a*(r/100)*(days/365.25);
}
function ensureManage(d){
  if(!d.manage) d.manage={};
  const m=d.manage;
  if(m.status==null) m.status="vacant";
  ["tenant","contact","rent","start","end","deposit","scheme"].forEach(k=>{ if(m[k]==null) m[k]=""; });
  if(!m.certs) m.certs={gas:"",eicr:"",epc:"",insurance:""};
  if(!Array.isArray(m.maintenance)) m.maintenance=[];
  if(!m.mortgage) m.mortgage={};
  if(m.mortgage.status==null) m.mortgage.status="Not started";
  ["lender","broker","amount","rate","termYears","startDate","productEndDate","monthlyPayment","notes"].forEach(k=>{ if(m.mortgage[k]==null) m.mortgage[k]=""; });
  if(m.mortgage.type==null) m.mortgage.type="Interest-only";
  return m;
}

/* ---------- lifecycle phases (the four app sections) ---------- */
const PHASES=[["analysis","Analysis"],["purchasing","Purchasing"],["refurbishing","Refurbishing"],["owned","Owned"]];
const SUGGESTED_ROLES={
  analysis:["Estate agent","Sourcing agent","Auction house"],
  purchasing:["Solicitor","Conveyancer","Mortgage broker","Lender","Surveyor"],
  refurbishing:["Builder","Electrician","Plumber","Plasterer","Roofer","Gas engineer","Joiner","Decorator","Skip hire"],
  owned:["Letting agent","Management company","Insurer","Accountant","Handyman","Gas engineer"]
};
const ANALYSIS_STAGES=["Lead","Viewing","Analysed","Offer made","Rejected"];
const PURCHASE_CHECKLIST=[["instructed","Solicitor instructed"],["searches","Searches ordered"],["enquiries","Enquiries raised & answered"],["offer","Mortgage offer received"],["exchanged","Exchanged"],["completed","Completed"]];
const MORTGAGE_STATES=["Not started","Applied","Valuation booked","Offer received","Completed"];

function ensurePhase(d){
  if(!d.phase) d.phase = d.stage==="Completed" ? "owned" : d.stage==="Agreed" ? "purchasing" : "analysis";
  if(!ANALYSIS_STAGES.includes(d.stage)) d.stage = (d.stage==="Completed"||d.stage==="Agreed") ? "Offer made" : "Lead";
  if(!Array.isArray(d.photos)) d.photos=[];
}
function ensurePurchase(d){
  if(!d.purchase) d.purchase={};
  const p=d.purchase;
  ["agreedPrice","solicitor","solicitorRef","targetExchange","targetCompletion"].forEach(k=>{ if(p[k]==null) p[k]=""; });
  if(!Array.isArray(p.finance)) p.finance=[];
  p.finance.forEach(x=>{ if(x.address==null) x.address=""; });
  if(!p.checklist) p.checklist={};
  PURCHASE_CHECKLIST.forEach(([k])=>{ if(p.checklist[k]==null) p.checklist[k]=false; });
  return p;
}
function ensureRefurbish(d){
  if(!d.refurbish) d.refurbish={};
  const r=d.refurbish;
  if(r.start==null) r.start=""; if(r.end==null) r.end=""; if(r.percent==null) r.percent=0;
  if(!Array.isArray(r.actuals)) r.actuals=[];
  if(!Array.isArray(r.contractors)) r.contractors=[];
  if(!Array.isArray(r.snags)) r.snags=[];
  return r;
}

/* ---------- state ---------- */
let DATA = { deals:[], contacts:[], assumptions:{...DEFAULT_ASSUMPTIONS} };
let view = "list", currentId = null, tab = "deal", homeMode = "list", section = "owned", analysisSub = "numbers", sectionTab = "items", currentFinanceIndex = null;
let memoryOnly = false;
const hasStore = (typeof window !== "undefined" && window.storage && typeof window.storage.get === "function");

/* ---------- storage (shared so both partners see the same deals) ---------- */
async function loadData(){
  if(!hasStore){ memoryOnly = true; seedIfEmpty(); return; }
  try{
    const res = await window.storage.get("poco_data", true); // true = shared across users
    if(res && res.value){ DATA = JSON.parse(res.value); DATA.assumptions = {...DEFAULT_ASSUMPTIONS, ...(DATA.assumptions||{})}; if(!Array.isArray(DATA.contacts)) DATA.contacts=[]; }
    else { seedIfEmpty(); await saveData(); }
  }catch(e){ memoryOnly = true; seedIfEmpty(); }
}
let saveTimer=null;
function saveData(){
  if(USE_FIREBASE){
    if(!fbReady) return Promise.resolve();
    clearTimeout(saveTimer);
    return new Promise(res=>{ saveTimer=setTimeout(async()=>{
      try{ lastJson=JSON.stringify(DATA); await fbDocRef.set({payload:DATA, updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}); }
      catch(e){ console.error("POCO save failed",e); }
      res();
    },350); });
  }
  if(memoryOnly || !hasStore) return Promise.resolve();
  clearTimeout(saveTimer);
  return new Promise(res=>{ saveTimer=setTimeout(async()=>{
    try{ await window.storage.set("poco_data", JSON.stringify(DATA), true); }catch(e){}
    res();
  },250); });
}
function seedIfEmpty(){
  if(DATA.deals.length) return;
  // one worked example so the tool isn't empty on first open
  const d = newDeal("14 Elizabeth St","WA9 3LN");
  d.beds=2; d.price=70000; d.stage="Analysed";
  d.deal.duv=121000; d.deal.rent=550;
  ["k_suite","b_suite","o_rewire","k_skim","k_paint","r_skim","r_paint","windows","fascia"].forEach(id=>{ d.refurb.included[id]=true; });
  d.refurb.qty["windows"]=6;
  DATA.deals.push(d);
}

/* ---------- Firebase: shared database + Google sign-in ---------- */
let fbAuth=null, fbDocRef=null, fbReady=false, lastJson="", pendingRemote=null;
function normalizeData(d){
  if(!d || typeof d!=="object") d={};
  if(!Array.isArray(d.deals)) d.deals=[];
  if(!Array.isArray(d.contacts)) d.contacts=[];
  d.assumptions={...DEFAULT_ASSUMPTIONS, ...(d.assumptions||{})};
  return d;
}
function fbInit(){
  if(typeof firebase==="undefined"){ showLogin("Couldn't load Firebase — check your internet connection and reload.", true); return; }
  try{ firebase.initializeApp(firebaseConfig); }catch(e){}
  fbAuth=firebase.auth();
  fbDocRef=firebase.firestore().collection("workspace").doc("shared");
  window.fbStorage=firebase.storage();
  fbAuth.onAuthStateChanged(async user=>{
    if(!user){ showLogin(); return; }
    const email=(user.email||"").toLowerCase();
    if(ALLOWED_EMAILS.length && !ALLOWED_EMAILS.map(e=>e.toLowerCase()).includes(email)){
      showLogin("The account "+email+" isn't on this workspace's allow-list.", true); return;
    }
    hideGate(); setIdentity(email); await fbStart();
  });
}
async function fbStart(){
  try{ const snap=await fbDocRef.get(); if(!snap.exists){ lastJson=JSON.stringify(DATA); await fbDocRef.set({payload:DATA}); } }
  catch(e){ console.error(e); }
  fbDocRef.onSnapshot(snap=>{
    if(!snap.exists) return;
    const data=snap.data().payload; if(!data) return;
    const j=JSON.stringify(data);
    if(j===lastJson) return;                                   // ignore our own write echoing back
    const a=document.activeElement;
    if(a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)){ pendingRemote=data; return; }  // don't yank a field being typed in
    DATA=normalizeData(data); lastJson=j; fbReady=true; render();
  }, err=>console.error("POCO sync error",err));
  fbReady=true; render();
}
// apply a deferred partner update once you click out of the field you were editing
document.addEventListener("focusout",()=>{ if(pendingRemote){ const d=pendingRemote; pendingRemote=null; DATA=normalizeData(d); lastJson=JSON.stringify(d); render(); } });

function showLogin(msg,noAccess){
  const g=document.getElementById("authgate");
  g.innerHTML=`<div class="authcard">
    <img src="${document.getElementById('logo').src}" alt="POCO Property">
    <h2>${noAccess?'No access':'Sign in'}</h2>
    <p>${msg?esc(msg):'Sign in with Google to open your shared POCO workspace.'}</p>
    ${noAccess?`<button class="gbtn" id="goOut">Sign out</button>`:`<button class="gbtn" id="goIn">Sign in with Google</button>`}
  </div>`;
  g.style.display="flex";
  const inBtn=g.querySelector("#goIn"), outBtn=g.querySelector("#goOut");
  if(inBtn) inBtn.onclick=()=>{ const p=new firebase.auth.GoogleAuthProvider(); fbAuth.signInWithPopup(p).catch(e=>{ g.querySelector('.authcard').insertAdjacentHTML('beforeend',`<div class="autherr">${esc(e.message||'Sign-in failed')}</div>`); }); };
  if(outBtn) outBtn.onclick=()=>fbAuth.signOut();
}
function hideGate(){ const g=document.getElementById("authgate"); if(g) g.style.display="none"; }
function setIdentity(email){
  const who=document.getElementById("who"), out=document.getElementById("signout");
  if(who){ who.style.display=""; who.textContent=email; }
  if(out){ out.style.display=""; out.onclick=()=>fbAuth.signOut(); }
}

/* ---------- model helpers ---------- */
function uid(){ return "d"+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function newDeal(addr,pc){
  return { id:uid(), address:addr||"New property", postcode:pc||"", beds:"", price:"", source:"", stage:"Lead", phase:"analysis", notes:"", photos:[],
           refurb:{ included:{}, qty:{}, rates:{}, contingencyPct:15, pmFee:1000 },
           deal:{ duv:"", rent:"", yourOffer:"", hmoCosts:"", refurbOverride:"", comparables:[] },
           purchase:{ agreedPrice:"", solicitor:"", solicitorRef:"", finance:[], targetExchange:"", targetCompletion:"", checklist:{instructed:false,searches:false,enquiries:false,offer:false,exchanged:false,completed:false} },
           refurbish:{ start:"", end:"", percent:0, actuals:[], contractors:[], snags:[] },
           manage:{ status:"vacant", tenant:"", contact:"", rent:"", start:"", end:"", deposit:"", scheme:"", certs:{gas:"",eicr:"",epc:"",insurance:""}, maintenance:[],
                    mortgage:{ status:"Not started", lender:"", broker:"", amount:"", rate:"", termYears:"", type:"Interest-only", startDate:"", productEndDate:"", monthlyPayment:"", notes:"" } } };
}
const num = v => { if(typeof v==="string") v=v.replace(/[£,\s]/g,""); const n = parseFloat(v); return isFinite(n)?n:0; };
const money = n => (n<0?"−£":"£") + Math.round(Math.abs(n)).toLocaleString("en-GB");

/* ---------- calculations ---------- */
function stampDutySPV(price){            // UK Ltd company / additional-property rules (England & NI), 2026
  if(price<=40000) return 0;             // surcharge only kicks in above £40k
  if(price>500000) return price*0.17;    // company flat 17% over £500k
  const bands=[[125000,0.05],[250000,0.07],[925000,0.10],[1500000,0.15],[Infinity,0.17]];
  let tax=0, lower=0;
  for(const [upper,rate] of bands){
    if(price>lower){ tax += (Math.min(price,upper)-lower)*rate; lower=upper; } else break;
  }
  return tax;
}
function computeRefurb(d){
  let subtotal=0;
  for(const id in d.refurb.included){
    if(!d.refurb.included[id]) continue;
    const it=ITEM[id]; if(!it) continue;
    const rate = (d.refurb.rates[id]!=null && d.refurb.rates[id]!=="") ? num(d.refurb.rates[id]) : it.rate;
    const qty = needsQty(it.unit) ? num(d.refurb.qty[id]) : 1;
    subtotal += rate*qty;
  }
  const contingency = subtotal*(num(d.refurb.contingencyPct)/100);
  const pmFee = num(d.refurb.pmFee);
  return { subtotal, contingency, pmFee, total: subtotal+contingency+pmFee };
}
function computeDeal(d){
  const a=DATA.assumptions;
  const refurb = (d.deal.refurbOverride!=null && d.deal.refurbOverride!=="") ? num(d.deal.refurbOverride) : computeRefurb(d).total;
  const duv=num(d.deal.duv), rent=num(d.deal.rent), hmo=num(d.deal.hmoCosts);
  const has=v=>v!=null&&v!=="";
  // per-deal overrides — blank falls back to the Settings default
  const solicitor=has(d.deal.solicitor)?num(d.deal.solicitor):num(a.solicitor);
  const broker=has(d.deal.broker)?num(d.deal.broker):num(a.broker);
  const costOfMoney=has(d.deal.costOfMoney)?num(d.deal.costOfMoney):num(a.costOfMoney);
  const mortgageRate=has(d.deal.mortgageRate)?num(d.deal.mortgageRate):num(a.mortgageRate);
  const mortgage=duv*(a.ltvPct/100);
  const otherCosts=refurb + solicitor + broker + costOfMoney;
  // Max offer pulls all cash back out (MIMO). Stamp duty sits on the price you pay,
  // so we solve for it across a few passes (handles every price band, not just sub-£125k).
  let maxOffer=mortgage-otherCosts, sd=0;
  for(let i=0;i<8;i++){ sd=stampDutySPV(Math.max(maxOffer,0)); maxOffer=mortgage-otherCosts-sd; }
  const mPay=mortgage*(mortgageRate/100)/12;
  const mgmt=rent*(a.mgmtPct/100), moe=rent*(a.moePct/100);
  const cashflow=rent-mPay-mgmt-moe-hmo, annual=cashflow*12;
  const sPay=mortgage*(a.stressRate/100)/12, sCashflow=rent-sPay-mgmt-moe-hmo;
  const yo = d.deal.yourOffer; const hasOffer = yo!=="" && yo!=null;
  const moneyLeftIn = hasOffer ? (num(yo)-maxOffer) : null;
  const maxBorrow145 = rent>0 ? (rent*12/0.055/1.45) : 0;
  // returns
  const basis = hasOffer ? num(yo) : maxOffer;            // price the yield is measured against
  const grossYield = basis>0 ? (rent*12/basis*100) : null;
  let coc=null, cocInf=false;                             // cash-on-cash ROI on money left in
  if(hasOffer){ if(moneyLeftIn<=0){ cocInf=true; } else { coc = annual/moneyLeftIn*100; } }
  return { refurb, mortgage, costOfMoney, mortgageRate, solicitor, broker, stampDuty:sd, maxOffer,
           rent, mPay, mgmt, moe, hmo, cashflow, annual, sPay, sCashflow, hasOffer, yourOffer:num(yo),
           moneyLeftIn, maxBorrow145, grossYield, coc, cocInf, basis };
}

/* ---------- tiny render helpers ---------- */
const app = document.getElementById("app");
function esc(s){ return (s==null?"":String(s)).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function go(v,id){ view=v; if(id!==undefined)currentId=id; window.scrollTo(0,0); render(); }
function curDeal(){ return DATA.deals.find(x=>x.id===currentId); }

/* ============================================================ HOME (list + board) */
function dealMetricsRow(c){
  let mliClass="", mliVal="—";
  if(c.hasOffer){ mliVal=money(c.moneyLeftIn); mliClass = c.moneyLeftIn<=0?"good":(c.moneyLeftIn<=c.annual?"warn":"bad"); }
  return {mliClass,mliVal,cfClass:c.cashflow>=0?"good":"bad"};
}
function stageSelectHTML(d){
  return `<select class="stagesel" data-stage="${d.id}">${ANALYSIS_STAGES.map(s=>`<option ${s===d.stage?"selected":""}>${s}</option>`).join("")}</select>`;
}
function openDeal(id){ const d=DATA.deals.find(x=>x.id===id); if(d){ ensurePhase(d); tab=d.phase||"analysis"; analysisSub="numbers"; } go("property",id); }
function newDealAndOpen(){ const d=newDeal(); DATA.deals.push(d); saveData(); tab="analysis"; analysisSub="numbers"; go("property",d.id); }
function fmtDate(s){ if(!s) return ""; const d=new Date(s+"T00:00:00"); if(isNaN(d)) return s; return d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); }
function innerEmpty(msg){ return `<div class="empty"><p style="margin:0">${msg}</p></div>`; }
function sectionShell(title, leftControls, content){
  const sub=`<div class="seg" id="sectab"><button class="${sectionTab==='items'?'on':''}" data-sv="items">${section==='owned'?'Portfolio':'Properties'}</button><button class="${sectionTab==='contacts'?'on':''}" data-sv="contacts">Contacts</button></div>`;
  return `<div class="page-head" style="margin-bottom:16px"><div><h1 class="page" style="font-size:22px">${title}</h1><div class="ul" style="width:44px"></div></div><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${leftControls||''}${sub}</div></div>${content}`;
}

function analysisCard(d){
  const c=computeDeal(d), m=dealMetricsRow(c);
  return `<div class="card" data-open="${d.id}">
    <span class="chip">${esc(d.stage)}</span>
    <p class="addr">${esc(d.address)}</p>
    <p class="sub">${esc(d.postcode||"")}${d.beds?` · ${esc(d.beds)} bed`:""}${d.price?` · listed ${money(num(d.price))}`:""}</p>
    <div class="metrics">
      <div class="metric"><div class="k">Max offer</div><div class="v">${money(c.maxOffer)}</div></div>
      <div class="metric"><div class="k">Cashflow / mo</div><div class="v ${m.cfClass}">${money(c.cashflow)}</div></div>
      <div class="metric"><div class="k">Money left in</div><div class="v ${m.mliClass}">${m.mliVal}</div></div>
    </div></div>`;
}
function renderPurchasingListHTML(){
  const deals=DATA.deals.filter(d=>d.phase==="purchasing");
  if(!deals.length) return innerEmpty("Nothing being purchased right now. Open a property and switch its phase to Purchasing once an offer's agreed.");
  const cards=deals.map(d=>{ const p=ensurePurchase(d);
    const done=PURCHASE_CHECKLIST.filter(([k])=>p.checklist[k]).length, pct=Math.round(done/PURCHASE_CHECKLIST.length*100);
    const financeTotal=p.finance.reduce((a,x)=>a+num(x.amount),0);
    return `<div class="card" data-open="${d.id}">
      <span class="chip">${p.checklist.completed?'Completed':p.checklist.exchanged?'Exchanged':'In conveyancing'}</span>
      <p class="addr">${esc(d.address)}</p>
      <p class="sub">${p.agreedPrice?`Agreed ${money(num(p.agreedPrice))}`:'No agreed price yet'}${p.targetCompletion?` · target ${fmtDate(p.targetCompletion)}`:''}</p>
      <div class="prog"><span style="width:${pct}%"></span></div>
      <p class="sub" style="margin:4px 0 0">${done}/${PURCHASE_CHECKLIST.length} conveyancing steps${financeTotal>0?` · finance raised: ${money(financeTotal)}`:""}</p>
    </div>`;
  }).join("");
  return `<div class="grid">${cards}</div>`;
}
function renderRefurbishingListHTML(){
  const deals=DATA.deals.filter(d=>d.phase==="refurbishing");
  if(!deals.length) return innerEmpty("No active refurbs. Open a completed property and switch its phase to Refurbishing once works begin.");
  const cards=deals.map(d=>{ const r=ensureRefurbish(d);
    const budget=(d.deal.refurbOverride!=null&&d.deal.refurbOverride!=="")?num(d.deal.refurbOverride):computeRefurb(d).total;
    const actual=r.actuals.reduce((a,x)=>a+num(x.amount),0);
    const over=actual>budget;
    return `<div class="card" data-open="${d.id}">
      <span class="chip">${r.percent||0}% done</span>
      <p class="addr">${esc(d.address)}</p>
      <p class="sub">Budget ${money(budget)} · Spent ${money(actual)} <b style="color:${over?'var(--bad)':'var(--good)'}">(${actual-budget>=0?'+':''}${money(actual-budget)})</b></p>
      <div class="prog green"><span style="width:${Math.min(100,Math.max(0,r.percent||0))}%"></span></div>
    </div>`;
  }).join("");
  return `<div class="grid">${cards}</div>`;
}

/* ---------- contacts (shared address book, by section) ---------- */
function renderContactsHTML(sec){
  const list=DATA.contacts.filter(c=>c.section===sec);
  const sugg=(SUGGESTED_ROLES[sec]||[]);
  const dl=`<datalist id="roles_${sec}">${sugg.map(r=>`<option value="${esc(r)}">`).join("")}</datalist>`;
  const cards=list.map(c=>`<div class="ccard" data-cid="${c.id}">
      <div class="cgrid">
        <input class="nm" data-cf="name" value="${esc(c.name||"")}" placeholder="Name">
        <input data-cf="company" value="${esc(c.company||"")}" placeholder="Company">
        <input data-cf="role" list="roles_${sec}" value="${esc(c.role||"")}" placeholder="Role">
        <button class="comp-del" data-cdel="${c.id}" title="Remove">✕</button>
      </div>
      <div class="cgrid2">
        <input data-cf="phone" value="${esc(c.phone||"")}" placeholder="Phone">
        <input data-cf="email" value="${esc(c.email||"")}" placeholder="Email">
        <input data-cf="notes" value="${esc(c.notes||"")}" placeholder="Notes">
      </div>
    </div>`).join("");
  const roleHint=sugg.length?`Typical here: ${sugg.slice(0,5).join(", ")}.`:"";
  return `<div class="panel">
    <p class="hint" style="margin-top:0">Your shared address book for this stage — visible across all your properties. ${roleHint}</p>
    ${cards||`<p class="hint" style="margin:0 0 12px">No contacts yet.</p>`}
    <button class="btn ghost sm" id="addContact">+ Add contact</button>
  </div>${dl}`;
}
function wireContacts(sec){
  app.querySelectorAll(".ccard").forEach(card=>{
    const id=card.dataset.cid; const c=DATA.contacts.find(x=>x.id===id); if(!c) return;
    card.querySelectorAll("[data-cf]").forEach(inp=>inp.addEventListener("input",()=>{ c[inp.dataset.cf]=inp.value; saveData(); }));
  });
  app.querySelectorAll("[data-cdel]").forEach(b=>b.onclick=()=>{ DATA.contacts=DATA.contacts.filter(x=>x.id!==b.dataset.cdel); saveData(); renderList(); });
  const add=app.querySelector("#addContact");
  if(add) add.onclick=()=>{ DATA.contacts.push({id:uid(),section:sec,name:"",company:"",role:"",phone:"",email:"",notes:""}); saveData(); renderList(); };
}

function renderList(){
  DATA.deals.forEach(ensurePhase);
  const counts={analysis:0,purchasing:0,refurbishing:0,owned:0};
  DATA.deals.forEach(d=>{ counts[d.phase]=(counts[d.phase]||0)+1; });
  const nav=`<div class="phasenav" id="phasenav">${PHASES.map(([k,label])=>`<button class="${section===k?'on':''}" data-section="${k}"><span>${label}</span><span class="pcount">${counts[k]||0}</span></button>`).join("")}</div>`;
  const label=(PHASES.find(p=>p[0]===section)||[,"Analysis"])[1];

  let body;
  if(sectionTab==="contacts"){
    body=sectionShell(label, "", renderContactsHTML(section));
  } else if(section==="analysis"){
    const deals=DATA.deals.filter(d=>d.phase==="analysis");
    const toggle=`<div class="seg" id="seg"><button class="${homeMode==='list'?'on':''}" data-mode="list">List</button><button class="${homeMode==='board'?'on':''}" data-mode="board">Board</button></div>`;
    let inner;
    if(!deals.length) inner=innerEmpty("No properties in analysis. Tap “New deal” to start running the numbers.");
    else if(homeMode==="board") inner=renderBoardHTML();
    else inner=`<div class="grid">${deals.map(analysisCard).join("")}</div>`;
    body=sectionShell(label, deals.length?toggle:"", inner);
  } else if(section==="purchasing"){
    body=sectionShell(label, "", renderPurchasingListHTML());
  } else if(section==="refurbishing"){
    body=sectionShell(label, "", renderRefurbishingListHTML());
  } else {
    body=sectionShell(label, "", renderPortfolioHTML());
  }

  app.innerHTML = `
    <div class="page-head">
      <div><span class="eyebrow">POCO Property</span><br><h1 class="page">Pipeline</h1><div class="ul" style="width:54px"></div></div>
      <button class="btn" id="newDeal">+ New deal</button>
    </div>
    ${nav}
    ${body}
    <p class="footnote">A rough, on-the-road guide — not a valuation or financial advice. Always do your own due diligence before offering.</p>`;

  app.querySelectorAll("[data-open]").forEach(el=>el.onclick=()=>openDeal(el.dataset.open));
  app.querySelectorAll("#phasenav button").forEach(b=>b.onclick=()=>{ section=b.dataset.section; sectionTab="items"; renderList(); });
  app.querySelectorAll("#sectab button").forEach(b=>b.onclick=()=>{ sectionTab=b.dataset.sv; renderList(); });
  if(app.querySelector("#newDeal")) app.querySelector("#newDeal").onclick=newDealAndOpen;
  app.querySelectorAll("#seg button").forEach(b=>b.onclick=()=>{ homeMode=b.dataset.mode; renderList(); });
  if(sectionTab==="contacts") wireContacts(section);
  else if(section==="analysis" && homeMode==="board") wireBoard();
}

function renderPortfolioHTML(){
  const owned=DATA.deals.filter(d=>d.phase==="owned");
  // compliance alerts across every property that has cert dates
  const alerts=[];
  DATA.deals.forEach(d=>{ const m=d.manage; if(!m||!m.certs) return;
    CERTS.forEach(([key,name])=>{ const st=certStatus(m.certs[key]); if(st.cls==="bad"||st.cls==="warn") alerts.push({d,name,st}); });
  });
  alerts.sort((a,b)=>(a.st.days??1e9)-(b.st.days??1e9));

  if(!owned.length && !alerts.length){
    return `<div class="empty"><h1 class="page" style="font-size:22px">Nothing owned yet</h1>
      <p>Move a property to the <b>Owned</b> phase — from the phase menu at the top of its page — and it'll appear here with its rent, cashflow, equity and compliance dates.</p></div>`;
  }
  let totRent=0, totAnnual=0, totEquity=0, totCashflow=0;
  owned.forEach(d=>{ const c=computeDeal(d), m=d.manage||{}; totRent+=(num(m.rent)||c.rent); totAnnual+=c.annual; totCashflow+=c.cashflow;
    const realMortgage=m.mortgage&&num(m.mortgage.amount)>0?num(m.mortgage.amount):c.mortgage;
    totEquity+=(num(d.deal.duv)-realMortgage); });
  const corp=num(DATA.assumptions.corpTaxPct);
  const afterTax=totAnnual>0?totAnnual*(1-corp/100):totAnnual;

  const rows=owned.map(d=>{ const c=computeDeal(d), m=d.manage||{};
    let next=null;
    if(m.certs) CERTS.forEach(([key,name])=>{ const st=certStatus(m.certs[key]); if(st.days!=null && (!next||st.days<next.st.days)) next={name,st}; });
    const rentV=num(m.rent)||c.rent;
    const realMortgage=m.mortgage&&num(m.mortgage.amount)>0?num(m.mortgage.amount):c.mortgage;
    return `<tr class="click" data-open="${d.id}">
      <td>${esc(d.address)}</td>
      <td>${m.status==='let'?'Let':'Vacant'}</td>
      <td>${money(rentV)}</td>
      <td style="${c.cashflow<0?'color:var(--bad);':''}font-weight:800">${money(c.cashflow)}</td>
      <td>${money(num(d.deal.duv)-realMortgage)}</td>
      <td>${next?`<span class="cstat ${next.st.cls}">${next.name.split(' ')[0]} · ${next.st.label}</span>`:'—'}</td>
    </tr>`;
  }).join("");

  const alertHTML = alerts.length
    ? alerts.map(a=>`<div class="alert"><span>${esc(a.d.address)} — ${a.name}</span><span class="cstat ${a.st.cls}">${a.st.label}${a.st.days!=null?` · ${a.st.days<0?Math.abs(a.st.days)+"d ago":a.st.days+"d"}`:""}</span></div>`).join("")
    : `<p class="hint" style="margin:0">All certificates valid, or none entered yet.</p>`;

  return `
    <div class="pstats">
      <div class="pstat"><div class="k">Properties owned</div><div class="v">${owned.length}</div></div>
      <div class="pstat"><div class="k">Monthly rent</div><div class="v">${money(totRent)}</div></div>
      <div class="pstat"><div class="k">Monthly cashflow</div><div class="v" style="${totCashflow<0?'color:var(--bad)':''}">${money(totCashflow)}</div></div>
      <div class="pstat"><div class="k">Annual cashflow</div><div class="v" style="${totAnnual<0?'color:var(--bad)':''}">${money(totAnnual)}</div></div>
      <div class="pstat"><div class="k">Est. equity</div><div class="v">${money(totEquity)}</div></div>
    </div>
    <div class="panel">
      <h3>Compliance alerts</h3>
      <p class="hint">Anything overdue or due within 60 days, across your properties.</p>
      ${alertHTML}
    </div>
    <div class="panel">
      <h3>Owned properties <span style="font-weight:600;color:var(--muted);font-size:12px;text-transform:none;letter-spacing:0">· after ${corp}% corp tax ≈ ${money(afterTax)}/yr (rough)</span></h3>
      <table class="ptable">
        <tr><th>Property</th><th>Status</th><th>Rent</th><th>Cashflow/mo</th><th>Est. equity</th><th>Next due</th></tr>
        ${rows||`<tr><td colspan="6" style="color:var(--muted)">No completed properties yet.</td></tr>`}
      </table>
      <p class="hint" style="margin-top:12px">Est. equity is a rough figure: post-refurb value minus the ${DATA.assumptions.ltvPct}% mortgage — or the real mortgage amount, once you've entered one on a property's Owned tab. After-tax is cashflow less corporation tax — a guide, not a tax calculation.</p>
    </div>`;
}

function renderBoardHTML(){
  const cols=ANALYSIS_STAGES.map(stage=>{
    const inStage=DATA.deals.filter(d=>d.phase==="analysis" && d.stage===stage);
    const cards=inStage.map(d=>{
      const c=computeDeal(d), m=dealMetricsRow(c);
      return `<div class="bcard" draggable="true" data-id="${d.id}">
        <p class="ba" data-open="${d.id}">${esc(d.address)}</p>
        <div class="bm"><span class="k">Max offer</span><span class="v">${money(c.maxOffer)}</span></div>
        <div class="bm"><span class="k">Cashflow/mo</span><span class="v ${m.cfClass}">${money(c.cashflow)}</span></div>
        ${c.hasOffer?`<div class="bm"><span class="k">Left in</span><span class="v ${m.mliClass}">${m.mliVal}</span></div>`:""}
        ${stageSelectHTML(d)}
      </div>`;
    }).join("");
    return `<div class="col ${stage==='Rejected'?'rejected':''}" data-col="${stage}">
      <div class="col-head"><span class="nm">${stage}</span><span class="ct">${inStage.length}</span></div>
      ${cards}
    </div>`;
  }).join("");
  return `<p class="draghint">Drag cards between columns on desktop · on a phone, tap a card's stage menu to move it.</p><div class="board" id="board">${cols}</div>`;
}

function wireBoard(){
  app.querySelectorAll(".bcard .ba").forEach(el=>el.onclick=()=>openDeal(el.dataset.open));
  app.querySelectorAll("select[data-stage]").forEach(sel=>{
    sel.onclick=e=>e.stopPropagation();
    sel.onchange=()=>{ const d=DATA.deals.find(x=>x.id===sel.dataset.stage); d.stage=sel.value; saveData(); renderList(); };
  });
  // desktop drag-and-drop
  app.querySelectorAll(".bcard").forEach(card=>{
    card.addEventListener("dragstart",e=>{ e.dataTransfer.setData("text/plain",card.dataset.id); card.classList.add("dragging"); });
    card.addEventListener("dragend",()=>card.classList.remove("dragging"));
  });
  app.querySelectorAll(".col").forEach(col=>{
    col.addEventListener("dragover",e=>{ e.preventDefault(); col.classList.add("drop"); });
    col.addEventListener("dragleave",()=>col.classList.remove("drop"));
    col.addEventListener("drop",e=>{ e.preventDefault(); col.classList.remove("drop");
      const id=e.dataTransfer.getData("text/plain"); const d=DATA.deals.find(x=>x.id===id);
      if(d && d.stage!==col.dataset.col){ d.stage=col.dataset.col; saveData(); renderList(); }
    });
  });
}

/* ============================================================ PROPERTY */
function renderProperty(){
  const d=curDeal(); if(!d){ go("list"); return; }
  ensurePhase(d);
  const PHASE_TABS=[...PHASES.map(p=>p[0]),"photos"];
  if(!PHASE_TABS.includes(tab)) tab=d.phase||"analysis";
  app.innerHTML = `
    <button class="back" id="back">← Pipeline</button>
    <div class="prop-head">
      <div style="flex:1;min-width:240px">
        <span class="eyebrow">Property</span>
        <input id="f_address" value="${esc(d.address)}" style="display:block;width:100%;border:none;background:none;font-style:italic;font-weight:900;font-size:28px;letter-spacing:-.02em;padding:2px 0;margin-top:2px">
        <div class="ul" style="width:54px"></div>
      </div>
      <div class="prop-actions">
        <select class="stagesel" id="f_phase" title="Lifecycle phase">${PHASES.map(([k,label])=>`<option value="${k}" ${k===d.phase?"selected":""}>${label}</option>`).join("")}</select>
        <button class="btn sm" id="share">Share summary</button>
        <button class="btn ghost sm" id="del">Delete</button>
      </div>
    </div>
    <div class="prop-details">
      <div class="field"><label>Postcode</label><input id="f_pc" value="${esc(d.postcode)}"></div>
      <div class="field"><label>Bedrooms</label><input inputmode="decimal" id="f_beds" value="${esc(d.beds)}"></div>
      <div class="field"><label>Listed price</label><div class="prefix"><span>£</span><input inputmode="decimal" id="f_price" value="${esc(d.price)}"></div></div>
      <div class="field"><label>Source</label><input id="f_source" value="${esc(d.source)}" placeholder="agent / auction…"></div>
    </div>
    <div class="tabs">
      ${PHASES.map(([k,label])=>`<button class="tab ${tab===k?'active':''}" data-tab="${k}">${label}</button>`).join("")}
      <button class="tab ${tab==='photos'?'active':''}" data-tab="photos">Photos${d.photos&&d.photos.length?` (${d.photos.length})`:""}</button>
    </div>
    <div id="tabwrap"></div>`;
  app.querySelector("#back").onclick=()=>go("list");
  app.querySelector("#del").onclick=()=>{ if(confirm("Delete this deal?")){ DATA.deals=DATA.deals.filter(x=>x.id!==d.id); saveData(); go("list"); } };
  app.querySelector("#share").onclick=()=>go("summary",d.id);
  app.querySelector("#f_phase").onchange=e=>{ d.phase=e.target.value; tab=d.phase; analysisSub="numbers"; saveData(); renderProperty(); };
  bindInput(app.querySelector("#f_address"), v=>{ d.address=v; }, true);
  bindInput(app.querySelector("#f_pc"), v=>{ d.postcode=v; }, true);
  bindInput(app.querySelector("#f_beds"), v=>{ d.beds=v; }, true);
  bindInput(app.querySelector("#f_price"), v=>{ d.price=v; }, true);
  bindInput(app.querySelector("#f_source"), v=>{ d.source=v; }, true);
  app.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{ tab=t.dataset.tab; analysisSub="numbers"; renderProperty(); });
  if(tab==="purchasing") renderPurchasing(d);
  else if(tab==="refurbishing") renderRefurbishing(d);
  else if(tab==="owned") renderManage(d);
  else if(tab==="photos") renderPhotos(d);
  else { analysisSub==="estimate" ? renderRefurb(d) : renderDeal(d); }
}

function bindInput(elm, setter, light){
  elm.addEventListener("input",()=>{ setter(elm.value); saveData(); });
  if(!light) elm.addEventListener("blur",()=>render()); // refresh computed views on blur
}

/* ---------- DEAL TAB ---------- */
function renderDeal(d){
  const wrap=document.getElementById("tabwrap");
  // Inputs are rendered once; results live in #dealOut and repaint on every keystroke.
  wrap.innerHTML = `
    <div class="field inline" style="margin-bottom:14px"><label style="text-transform:uppercase;letter-spacing:.04em">Pipeline stage</label><select class="stagesel" id="i_stage" style="width:auto">${ANALYSIS_STAGES.map(s=>`<option ${s===d.stage?"selected":""}>${s}</option>`).join("")}</select></div>
    <div class="panel">
      <h3>Your inputs</h3>
      <p class="hint">DUV is the value once the work's done — find it from comparables. Refurb defaults to your checklist total, or type a quick figure below.</p>
      <div class="row2">
        <div class="field"><label>DUV — post-refurb value</label><div class="prefix"><span>£</span><input inputmode="decimal" id="i_duv" value="${esc(d.deal.duv)}"></div></div>
        <div class="field"><label>Monthly rent (PCM)</label><div class="prefix"><span>£</span><input inputmode="decimal" id="i_rent" value="${esc(d.deal.rent)}"></div></div>
        <div class="field"><label>Your offer (optional)</label><div class="prefix"><span>£</span><input inputmode="decimal" id="i_offer" value="${esc(d.deal.yourOffer)}"></div></div>
        <div class="field"><label>HMO costs / mo (optional)</label><div class="prefix"><span>£</span><input inputmode="decimal" id="i_hmo" value="${esc(d.deal.hmoCosts)}"></div></div>
      </div>
      <div class="costgrid">
        <div class="field"><label>Solicitor</label><div class="prefix"><span>£</span><input inputmode="decimal" id="i_sol" value="${esc(d.deal.solicitor)}" placeholder="${DATA.assumptions.solicitor}"></div></div>
        <div class="field"><label>Broker</label><div class="prefix"><span>£</span><input inputmode="decimal" id="i_brk" value="${esc(d.deal.broker)}" placeholder="${DATA.assumptions.broker}"></div></div>
        <div class="field"><label>Cost of money</label><div class="prefix"><span>£</span><input inputmode="decimal" id="i_com" value="${esc(d.deal.costOfMoney)}" placeholder="${DATA.assumptions.costOfMoney}"></div></div>
        <div class="field"><label>Mortgage rate</label><div class="prefix"><input inputmode="decimal" id="i_mrate" value="${esc(d.deal.mortgageRate)}" placeholder="${DATA.assumptions.mortgageRate}" style="padding-left:12px;padding-right:24px"><span style="left:auto;right:12px">%</span></div></div>
      </div>
      <p class="hint" style="margin:-4px 0 0">These default from Settings — type to override for this deal. Pop the live mortgage rate from each offer straight in here.</p>
      <div class="field" style="margin-top:14px">
        <label>Refurb cost</label>
        <div class="prefix"><span>£</span><input inputmode="decimal" id="i_refurb" value="${esc((d.deal.refurbOverride!=null&&d.deal.refurbOverride!=='')?d.deal.refurbOverride:computeRefurb(d).total)}"></div>
      </div>
      <p class="hint" id="refHint" style="margin:-6px 0 0"></p>
    </div>
    <div class="panel" id="compsPanel"></div>
    <div id="dealOut"></div>`;

  function paintDealOut(){
    const c=computeDeal(d), cfGood=c.cashflow>=0;
    let verdict="";
    if(c.hasOffer){
      if(c.moneyLeftIn<=0) verdict=`<span class="verdict good">Full MIMO — all cash out (£${Math.round(Math.abs(c.moneyLeftIn)).toLocaleString("en-GB")} headroom)</span>`;
      else verdict=`<span class="verdict warn">${money(c.moneyLeftIn)} left in the deal</span>`;
    }
    const test145 = c.rent>0 ? (c.maxBorrow145>=c.mortgage
        ? `<span class="ok-text">Rent supports the loan.</span> Max borrowing ${money(c.maxBorrow145)} vs mortgage ${money(c.mortgage)}.`
        : `<span class="danger-text">Shortfall — bigger deposit needed.</span> Rent only supports ${money(c.maxBorrow145)} vs ${money(c.mortgage)} mortgage. Do the numbers still stack?`)
        : `Enter a monthly rent to run the lender stress test.`;
    document.getElementById("dealOut").innerHTML = `
      <div class="hero">
        <div class="k">Max offer · money in, money out</div>
        <p class="big">${money(c.maxOffer)}</p>
        <div class="ulbar"></div>
        <p class="note">The most you can pay and still pull all your cash back out on refinance at ${DATA.assumptions.ltvPct}% LTV.</p>
        ${verdict}
      </div>
      <div class="stats3">
        <div class="stat"><div class="k">Cash-on-cash ROI</div><div class="v ${c.cocInf?'good':(c.coc!=null&&c.coc<0?'bad':'')}">${c.hasOffer?(c.cocInf?'∞':Math.round(c.coc)+'%'):'—'}</div><div class="s">${c.hasOffer?(c.cocInf?'all cash out':'on '+money(c.moneyLeftIn)+' left in'):'enter your offer'}</div></div>
        <div class="stat"><div class="k">Gross yield</div><div class="v">${c.grossYield!=null?c.grossYield.toFixed(1)+'%':'—'}</div><div class="s">on ${c.hasOffer?'your offer':'max offer'}</div></div>
        <div class="stat"><div class="k">Annual cashflow</div><div class="v ${c.annual>=0?'good':'bad'}">${money(c.annual)}</div><div class="s">${money(c.cashflow)}/mo</div></div>
      </div>
      <div class="twocol">
        <div class="panel">
          <h3>How that's worked out</h3>
          <div class="bd"><span class="k">Mortgage (${DATA.assumptions.ltvPct}% of DUV)</span><span class="v">${money(c.mortgage)}</span></div>
          <div class="bd minus"><span class="k">– Refurb</span><span class="v">${money(c.refurb)}</span></div>
          <div class="bd minus"><span class="k">– Solicitor</span><span class="v">${money(c.solicitor)}</span></div>
          <div class="bd minus"><span class="k">– Broker</span><span class="v">${money(c.broker)}</span></div>
          <div class="bd minus"><span class="k">– Cost of money</span><span class="v">${money(c.costOfMoney)}</span></div>
          <div class="bd minus"><span class="k">– Stamp duty (SPV)</span><span class="v">${money(c.stampDuty)}</span></div>
          <div class="bd total"><span class="k">Max offer</span><span class="v">${money(c.maxOffer)}</span></div>
        </div>
        <div class="panel">
          <h3>Monthly cashflow</h3>
          <div class="cf-num ${cfGood?'good':'bad'}">${money(c.cashflow)}</div>
          <div class="stress">Stress-tested at ${DATA.assumptions.stressRate}%: <b>${money(c.sCashflow)}</b> /mo · Annual: <b>${money(c.annual)}</b></div>
          <div style="margin-top:12px">
            <div class="bd"><span class="k">Rent</span><span class="v">${money(c.rent)}</span></div>
            <div class="bd minus"><span class="k">– Mortgage (${c.mortgageRate}%, interest-only)</span><span class="v">${money(c.mPay)}</span></div>
            <div class="bd minus"><span class="k">– Management (${DATA.assumptions.mgmtPct}%)</span><span class="v">${money(c.mgmt)}</span></div>
            <div class="bd minus"><span class="k">– Maintenance/voids (${DATA.assumptions.moePct}%)</span><span class="v">${money(c.moe)}</span></div>
            ${c.hmo?`<div class="bd minus"><span class="k">– HMO costs</span><span class="v">${money(c.hmo)}</span></div>`:""}
            <div class="bd total"><span class="k">Cashflow</span><span class="v">${money(c.cashflow)}</span></div>
          </div>
        </div>
      </div>
      <div class="twocol">
        <div class="panel">
          <h3>ROI ladder</h3>
          <p class="hint">How far above max offer you could go, and how long the cashflow takes to pay that back.</p>
          <table class="roi"><tr><th>Offer</th><th>Money left in</th><th>ROI</th><th>Paid back</th></tr>
          ${[1,2,3,4,5].map(n=>`<tr><td class="hl">${money(c.maxOffer+n*c.annual)}</td><td>${money(n*c.annual)}</td><td>${Math.round(100/n)}%</td><td>${12*n} mo</td></tr>`).join("")}
          </table>
        </div>
        <div class="panel">
          <h3>145% BTL lender test</h3>
          <p class="hint">Rough rule: about £15k of borrowing per £100/mo of rent.</p>
          <div class="callout" style="margin-top:0">${test145}</div>
        </div>
      </div>`;
  }
  paintDealOut();
  renderComps(d);

  // live update: model + save + repaint results (input fields are untouched, so focus stays put)
  const liveBind=(id,setter)=>{ const e=wrap.querySelector(id); e.addEventListener("input",()=>{ setter(e.value); saveData(); paintDealOut(); }); };
  const stageSel=wrap.querySelector("#i_stage"); if(stageSel) stageSel.onchange=()=>{ d.stage=stageSel.value; saveData(); };
  liveBind("#i_duv",   v=>d.deal.duv=v);
  liveBind("#i_rent",  v=>d.deal.rent=v);
  liveBind("#i_offer", v=>d.deal.yourOffer=v);
  liveBind("#i_hmo",   v=>d.deal.hmoCosts=v);
  liveBind("#i_sol",   v=>d.deal.solicitor=v);
  liveBind("#i_brk",   v=>d.deal.broker=v);
  liveBind("#i_com",   v=>d.deal.costOfMoney=v);
  liveBind("#i_mrate", v=>d.deal.mortgageRate=v);

  // Refurb: defaults to the checklist total, but you can type a rough figure to gauge a deal fast.
  function setRefHint(){
    const hint=document.getElementById("refHint"); if(!hint) return;
    const manual=(d.deal.refurbOverride!=null&&d.deal.refurbOverride!=="");
    if(manual){
      hint.innerHTML=`Quick figure — overriding the checklist. <a href="#" id="useChecklist" style="color:var(--ink);font-weight:800">↺ use checklist total (${money(computeRefurb(d).total)})</a>`;
      hint.querySelector("#useChecklist").onclick=e=>{e.preventDefault(); d.deal.refurbOverride=""; saveData(); renderDeal(d);};
    } else {
      hint.innerHTML=`From your Refurb checklist. Type a number here for a quick estimate instead · <a href="#" id="toRefurb2" style="color:var(--ink);font-weight:800">edit checklist →</a>`;
      hint.querySelector("#toRefurb2").onclick=e=>{e.preventDefault(); analysisSub="estimate"; renderProperty();};
    }
  }
  const refIn=wrap.querySelector("#i_refurb");
  refIn.addEventListener("input",()=>{ d.deal.refurbOverride=refIn.value; saveData(); paintDealOut(); setRefHint(); });
  refIn.addEventListener("blur",()=>renderDeal(d));   // normalise display (empty = back to checklist total)
  setRefHint();
}

/* ---------- COMPARABLES (the comps behind your DUV) ---------- */
function renderComps(d){
  if(!Array.isArray(d.deal.comparables)) d.deal.comparables=[];
  const comps=d.deal.comparables;
  const el=document.getElementById("compsPanel"); if(!el) return;
  const prices=comps.map(c=>num(c.price)).filter(p=>p>0);
  const avg=prices.length?Math.round(prices.reduce((a,b)=>a+b,0)/prices.length):0;
  const rows=comps.map((c,i)=>`<div class="comp-row">
      <input data-cf="addr" data-i="${i}" value="${esc(c.addr)}" placeholder="Comparable address">
      <div class="prefix"><span>£</span><input data-cf="price" data-i="${i}" inputmode="decimal" value="${esc(c.price)}" placeholder="Sold price" style="padding-left:22px"></div>
      <button class="comp-del" data-del="${i}" title="Remove">✕</button>
    </div>`).join("");
  el.innerHTML=`
    <h3>Comparables</h3>
    <p class="hint">Record the sold prices behind your DUV — so the figure's defensible later, and easy to share.</p>
    ${rows||`<p class="hint" style="margin:0 0 10px">No comparables yet.</p>`}
    <button class="btn ghost sm" id="addComp">+ Add comparable</button>
    ${avg?`<div class="comp-avg"><span><b>Average of ${prices.length} comp${prices.length>1?'s':''}:</b> ${money(avg)}</span><button class="btn sm" id="useDuv">Use as DUV</button></div>`:""}`;
  el.querySelectorAll("input[data-cf]").forEach(inp=>{
    inp.addEventListener("input",()=>{ const i=+inp.dataset.i; comps[i][inp.dataset.cf]=inp.value; saveData(); });
    inp.addEventListener("blur",()=>renderComps(d));
  });
  el.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{ comps.splice(+b.dataset.del,1); saveData(); renderComps(d); });
  el.querySelector("#addComp").onclick=()=>{ comps.push({addr:"",price:""}); saveData(); renderComps(d); };
  if(el.querySelector("#useDuv")) el.querySelector("#useDuv").onclick=()=>{
    const duv=document.getElementById("i_duv"); if(duv){ d.deal.duv=String(avg); duv.value=avg; duv.dispatchEvent(new Event("input")); }
  };
}

/* ---------- REFURB TAB ---------- */
let openCats = {};
function renderRefurb(d){
  const wrap=document.getElementById("tabwrap");
  const r=computeRefurb(d);
  const cats = LIBRARY.map((c,ci)=>{
    let catTotal=0, count=0;
    const rows = c.items.map(([id,nm,unit,defRate])=>{
      const on = !!d.refurb.included[id];
      const rate = (d.refurb.rates[id]!=null && d.refurb.rates[id]!=="") ? d.refurb.rates[id] : defRate;
      const qty = d.refurb.qty[id]!=null ? d.refurb.qty[id] : "";
      const lt = on ? (num(rate) * (needsQty(unit)?num(qty):1)) : 0;
      if(on){ catTotal+=lt; count++; }
      return `<div class="item ${on?'on':'off'}" data-id="${id}">
        <div class="check" data-check="${id}">${on?'✓':''}</div>
        <div class="nm" data-check="${id}">${esc(nm)}${needsQty(unit)?`<span class="unit-tag">${UNIT_LABEL[unit]}</span>`:""}</div>
        <div class="rate"><div class="p"><span class="s">£</span><input inputmode="decimal" data-rate="${id}" value="${esc(rate)}"></div></div>
        <input class="qty ${needsQty(unit)?'':'hidden'}" inputmode="decimal" data-qty="${id}" value="${esc(qty)}" placeholder="${UNIT_LABEL[unit]||''}">
        <div class="lt">${on?money(lt):""}</div>
      </div>`;
    }).join("");
    const isOpen = openCats[ci] || false;
    return `<div class="cat ${isOpen?'open':''}" data-ci="${ci}">
      <div class="cat-head" data-toggle="${ci}">
        <span class="nm">${esc(c.cat)}</span>
        <span class="meta">${count?`<b style="color:var(--ink)">${money(catTotal)}</b>`:""}${count?` · ${count} selected`:"tap to open"}<span style="font-size:11px">${isOpen?'▲':'▼'}</span></span>
      </div>
      <div class="cat-body">${rows}</div>
    </div>`;
  }).join("");

  wrap.innerHTML = `
    <button class="back" id="backNum" style="margin-bottom:12px">← Deal numbers</button>
    ${(d.deal.refurbOverride!=null&&d.deal.refurbOverride!=="")?`<div class="callout" style="margin-bottom:14px">A quick refurb figure of <b>${money(num(d.deal.refurbOverride))}</b> is set on the Deal tab and is driving the numbers right now — this checklist won't change the deal until you <a href="#" id="clearOv" style="color:var(--ink);font-weight:800">switch back to the checklist total</a>.</div>`:""}
    <div class="panel" style="padding-bottom:8px">
      <h3>Refurb estimate</h3>
      <p class="hint">Tick the work it needs. Rates are your editable defaults from the cost sheet — change any of them per deal. The total flows into the Analysis numbers.</p>
    </div>
    ${cats}
    <div class="totbar">
      <div class="lines">
        <div><div class="k">Subtotal</div><div class="vv">${money(r.subtotal)}</div></div>
        <div class="slider-wrap"><div><div class="k">Contingency</div><div class="vv">${money(r.contingency)}</div></div>
          <input type="range" min="0" max="25" step="1" value="${num(d.refurb.contingencyPct)}" id="cont">
          <span style="font-weight:800;color:var(--yellow)">${num(d.refurb.contingencyPct)}%</span></div>
        <div><div class="k">PM fee</div><input class="mini" inputmode="decimal" id="pm" value="${esc(d.refurb.pmFee)}"></div>
      </div>
      <div class="grand"><div class="k">Refurb total</div><div class="vv">${money(r.total)}</div></div>
    </div>`;

  // expand/collapse
  wrap.querySelector("#backNum").onclick=()=>{ analysisSub="numbers"; renderProperty(); };
  wrap.querySelectorAll("[data-toggle]").forEach(h=>h.onclick=()=>{ const ci=h.dataset.toggle; openCats[ci]=!openCats[ci]; renderRefurb(d); });
  if(wrap.querySelector("#clearOv")) wrap.querySelector("#clearOv").onclick=e=>{ e.preventDefault(); d.deal.refurbOverride=""; saveData(); renderRefurb(d); };
  // toggle item include
  wrap.querySelectorAll("[data-check]").forEach(el=>el.onclick=()=>{
    const id=el.dataset.check; d.refurb.included[id]=!d.refurb.included[id];
    if(d.refurb.included[id] && needsQty(ITEM[id].unit) && (d.refurb.qty[id]==null||d.refurb.qty[id]==="")) d.refurb.qty[id]=1;
    saveData(); renderRefurb(d);
  });
  // rate edits
  wrap.querySelectorAll("[data-rate]").forEach(inp=>{ inp.onclick=e=>e.stopPropagation();
    inp.addEventListener("input",()=>{ d.refurb.rates[inp.dataset.rate]=inp.value; saveData(); });
    inp.addEventListener("blur",()=>renderRefurb(d)); });
  // qty edits
  wrap.querySelectorAll("[data-qty]").forEach(inp=>{ inp.onclick=e=>e.stopPropagation();
    inp.addEventListener("input",()=>{ d.refurb.qty[inp.dataset.qty]=inp.value; if(inp.value!=="") d.refurb.included[inp.dataset.qty]=true; saveData(); });
    inp.addEventListener("blur",()=>renderRefurb(d)); });
  // contingency + pm
  const cont=wrap.querySelector("#cont"); cont.addEventListener("input",()=>{ d.refurb.contingencyPct=cont.value; saveData(); renderRefurb(d); });
  const pm=wrap.querySelector("#pm"); pm.addEventListener("input",()=>{ d.refurb.pmFee=pm.value; saveData(); });
  pm.addEventListener("blur",()=>renderRefurb(d));
}

/* ============================================================ PURCHASING TAB */
function renderPurchasing(d){
  const p=ensurePurchase(d), c=computeDeal(d);
  const wrap=document.getElementById("tabwrap");
  const price=num(p.agreedPrice);
  const sdlt=stampDutySPV(price);
  const acqCosts=sdlt + c.solicitor + c.broker;
  const done=PURCHASE_CHECKLIST.filter(([k])=>p.checklist[k]).length;
  const pct=Math.round(done/PURCHASE_CHECKLIST.length*100);
  const chkRows=PURCHASE_CHECKLIST.map(([k,label])=>`<div class="chk-row ${p.checklist[k]?'on':''}" data-chk="${k}"><div class="check">${p.checklist[k]?'✓':''}</div><div class="lbl">${label}</div></div>`).join("");
  const financeCanGenerate=x=>x.name && x.address && num(x.amount)>0 && num(x.rate)>0 && x.dateLoaned && x.paybackDate;
  const financeRows=p.finance.map((x,i)=>{
    const interest=loanInterest(x.amount,x.rate,x.dateLoaned,x.paybackDate);
    const canGenerate=financeCanGenerate(x);
    return `<div class="frow">
      <input data-ff="name" data-i="${i}" value="${esc(x.name||"")}" placeholder="Name">
      <div class="prefix"><span>£</span><input data-ff="amount" data-i="${i}" inputmode="decimal" value="${esc(x.amount||"")}" placeholder="Amount" style="padding-left:22px"></div>
      <div class="prefix"><input data-ff="rate" data-i="${i}" inputmode="decimal" value="${esc(x.rate||"")}" placeholder="Rate" style="padding-left:10px;padding-right:22px"><span style="left:auto;right:10px">%</span></div>
      <input type="date" data-ff="dateLoaned" data-i="${i}" value="${esc(x.dateLoaned||"")}">
      <input type="date" data-ff="paybackDate" data-i="${i}" value="${esc(x.paybackDate||"")}">
      <span class="interest">${interest==null?"—":money(interest)}</span>
      <button class="comp-del" data-fdel="${i}" title="Remove">✕</button>
    </div>
    <div class="frow-addr">
      <input data-ff="address" data-i="${i}" value="${esc(x.address||"")}" placeholder="Lender's address">
      <button class="btn ghost sm" data-fgen="${i}" ${canGenerate?"":'disabled title="Fill in name, address, amount, rate, and both dates first"'}>Generate agreement</button>
    </div>`;
  }).join("");
  const financeTotal=p.finance.reduce((a,x)=>a+num(x.amount),0);
  wrap.innerHTML=`
    <div class="panel">
      <h3>Agreed price &amp; purchase costs</h3>
      <div class="row2">
        <div class="field"><label>Agreed price</label><div class="prefix"><span>£</span><input inputmode="decimal" id="p_price" value="${esc(p.agreedPrice)}" placeholder="${esc(d.deal.yourOffer||d.price||'')}"></div></div>
        <div class="field"><label>Solicitor</label><input id="p_sol" value="${esc(p.solicitor)}" placeholder="firm name"></div>
        <div class="field"><label>Solicitor ref</label><input id="p_solref" value="${esc(p.solicitorRef)}"></div>
      </div>
      <div class="bd"><span class="k">Stamp duty (SPV, on agreed price)</span><span class="v">${money(sdlt)}</span></div>
      <div class="bd"><span class="k">Solicitor &amp; broker fees</span><span class="v">${money(c.solicitor+c.broker)}</span></div>
      <div class="bd total"><span class="k">Acquisition costs (excl. deposit &amp; refurb)</span><span class="v">${money(acqCosts)}</span></div>
    </div>
    <div class="panel">
      <h3>Finance raised</h3>
      <p class="hint">Investors, friends or family, bridging loans — whatever funded this purchase. Total interest is calculated for you once an entry has an amount, rate, and both dates.</p>
      ${financeRows||`<p class="hint" style="margin:0 0 10px">No finance sources added yet.</p>`}
      <button class="btn ghost sm" id="addFin">+ Add finance</button>
      <div class="comp-avg" id="finTotWrap" style="${financeTotal?'':'display:none'}"><span><b>Total raised:</b> <span id="finTot">${money(financeTotal)}</span></span></div>
    </div>
    <div class="panel">
      <h3>Key dates</h3>
      <div class="row2">
        <div class="field"><label>Target exchange</label><input type="date" id="p_tex" value="${esc(p.targetExchange)}"></div>
        <div class="field"><label>Target completion</label><input type="date" id="p_tco" value="${esc(p.targetCompletion)}"></div>
      </div>
    </div>
    <div class="panel">
      <h3>Conveyancing checklist <span style="font-weight:600;color:var(--muted);font-size:12px;text-transform:none;letter-spacing:0">· ${done}/${PURCHASE_CHECKLIST.length} done</span></h3>
      <div class="prog green"><span style="width:${pct}%"></span></div>
      ${chkRows}
      ${p.checklist.completed?`<div class="comp-avg" style="margin-top:12px"><span><b>Completed.</b> Ready to start the refurb?</span><button class="btn sm" id="toRefurbish">Move to Refurbishing →</button></div>`:""}
    </div>`;
  const lb=(id,setter)=>{ const e=wrap.querySelector(id); if(e) e.addEventListener("input",()=>{ setter(e.value); saveData(); }); };
  lb("#p_price",v=>p.agreedPrice=v); lb("#p_sol",v=>p.solicitor=v); lb("#p_solref",v=>p.solicitorRef=v);
  wrap.querySelector("#p_price").addEventListener("blur",()=>renderPurchasing(d));   // refresh SDLT
  wrap.querySelector("#p_tex").addEventListener("change",e=>{ p.targetExchange=e.target.value; saveData(); });
  wrap.querySelector("#p_tco").addEventListener("change",e=>{ p.targetCompletion=e.target.value; saveData(); });
  // finance raised: update the row's interest figure and the running total live, without a full re-render (preserves focus while typing)
  const updateFinRow=(i)=>{
    const x=p.finance[i];
    const interest=loanInterest(x.amount,x.rate,x.dateLoaned,x.paybackDate);
    const inp=wrap.querySelector(`[data-ff][data-i="${i}"]`);
    const row=inp?inp.closest(".frow"):null;
    const span=row?row.querySelector(".interest"):null;
    if(span) span.textContent=interest==null?"—":money(interest);
    const total=p.finance.reduce((a,y)=>a+num(y.amount),0);
    const ft=wrap.querySelector("#finTot"); if(ft) ft.textContent=money(total);
    const ftw=wrap.querySelector("#finTotWrap"); if(ftw) ftw.style.display=total?"":"none";
    const genBtn=wrap.querySelector(`[data-fgen="${i}"]`);
    if(genBtn){
      const canGenerate=financeCanGenerate(x);
      genBtn.disabled=!canGenerate;
      genBtn.title=canGenerate?"":"Fill in name, address, amount, rate, and both dates first";
    }
  };
  wrap.querySelectorAll("[data-ff]").forEach(inp=>{
    const i=+inp.dataset.i, f=inp.dataset.ff, ev=inp.type==="date"?"change":"input";
    inp.addEventListener(ev,()=>{ p.finance[i][f]=inp.value; saveData(); updateFinRow(i); });
  });
  wrap.querySelectorAll("[data-fdel]").forEach(b=>b.onclick=()=>{ p.finance.splice(+b.dataset.fdel,1); saveData(); renderPurchasing(d); });
  wrap.querySelectorAll("[data-fgen]").forEach(b=>{ b.onclick=()=>{ if(b.disabled) return; currentFinanceIndex=+b.dataset.fgen; go("agreement", d.id); }; });
  wrap.querySelector("#addFin").onclick=()=>{ p.finance.push({name:"",amount:"",rate:"",dateLoaned:"",paybackDate:"",address:""}); saveData(); renderPurchasing(d); };
  wrap.querySelectorAll("[data-chk]").forEach(r=>r.onclick=()=>{ p.checklist[r.dataset.chk]=!p.checklist[r.dataset.chk]; saveData(); renderPurchasing(d); });
  if(wrap.querySelector("#toRefurbish")) wrap.querySelector("#toRefurbish").onclick=()=>{ d.phase="refurbishing"; tab="refurbishing"; saveData(); renderProperty(); };
}

/* ============================================================ REFURBISHING TAB */
function renderRefurbishing(d){
  const r=ensureRefurbish(d);
  const wrap=document.getElementById("tabwrap");
  const budget=(d.deal.refurbOverride!=null&&d.deal.refurbOverride!=="")?num(d.deal.refurbOverride):computeRefurb(d).total;
  const actual=r.actuals.reduce((a,x)=>a+num(x.amount),0);
  const variance=actual-budget;
  const spendPct=budget>0?Math.min(100,Math.round(actual/budget*100)):0;
  const actRows=r.actuals.map((x,i)=>`<div class="comp-row">
      <input data-af="desc" data-i="${i}" value="${esc(x.desc||"")}" placeholder="What was it for?">
      <div class="prefix"><span>£</span><input data-af="amount" data-i="${i}" inputmode="decimal" value="${esc(x.amount||"")}" placeholder="Amount" style="padding-left:22px"></div>
      <button class="comp-del" data-adel="${i}" title="Remove">✕</button>
    </div>`).join("");
  const conRows=r.contractors.map((x,i)=>`<div class="crow">
      <input data-cf="name" data-i="${i}" value="${esc(x.name||"")}" placeholder="Name">
      <input data-cf="trade" data-i="${i}" value="${esc(x.trade||"")}" placeholder="Trade">
      <input data-cf="contact" data-i="${i}" value="${esc(x.contact||"")}" placeholder="Contact">
      <div class="prefix"><span>£</span><input data-cf="paid" data-i="${i}" inputmode="decimal" value="${esc(x.paid||"")}" placeholder="Paid" style="padding-left:22px"></div>
      <button class="comp-del" data-cdel="${i}" title="Remove">✕</button>
    </div>`).join("");
  const snagRows=r.snags.map((x,i)=>`<div class="snag-row"><div class="check ${x.done?'on':''}" data-sdone="${i}" style="width:22px;height:22px;border:2px solid ${x.done?'var(--good)':'var(--line)'};background:${x.done?'var(--good)':'transparent'};border-radius:7px;display:flex;align-items:center;justify-content:center;color:#fff;cursor:pointer;flex:none">${x.done?'✓':''}</div><input class="t" data-sf="text" data-i="${i}" value="${esc(x.text||"")}" placeholder="Snag / outstanding item" style="${x.done?'text-decoration:line-through;color:var(--muted)':''}"><button class="comp-del" data-sdel="${i}">✕</button></div>`).join("");
  wrap.innerHTML=`
    <div class="panel">
      <h3>Budget vs actual</h3>
      <div class="bigfig">
        <div class="b"><div class="k">Budget (estimate)</div><div class="v">${money(budget)}</div></div>
        <div class="b"><div class="k">Spent so far</div><div class="v">${money(actual)}</div></div>
        <div class="b"><div class="k">Variance</div><div class="v" style="color:${variance>0?'var(--bad)':'var(--good)'}">${variance>=0?'+':''}${money(variance)}</div></div>
      </div>
      <div class="prog ${variance>0?'':'green'}"><span style="width:${spendPct}%"></span></div>
      <p class="hint" style="margin:6px 0 14px">Log actual spend as you go — it's measured against the estimate you built in Analysis (${money(budget)}).</p>
      ${actRows}
      <button class="btn ghost sm" id="addAct">+ Add spend</button>
    </div>
    <div class="panel">
      <h3>Works schedule</h3>
      <div class="row2">
        <div class="field"><label>Start date</label><input type="date" id="r_start" value="${esc(r.start)}"></div>
        <div class="field"><label>Target end</label><input type="date" id="r_end" value="${esc(r.end)}"></div>
      </div>
      <div class="field inline"><label>Progress</label><input type="range" min="0" max="100" step="5" id="r_pct" value="${num(r.percent)}" style="flex:1;accent-color:var(--yellow)"><span style="font-weight:800;color:var(--ink);min-width:44px;text-align:right" id="r_pctlbl">${num(r.percent)}%</span></div>
      ${r.percent>=100?`<div class="comp-avg" style="margin-top:6px"><span><b>Works done.</b> Move it into your portfolio?</span><button class="btn sm" id="toOwned">Move to Owned →</button></div>`:""}
    </div>
    <div class="panel">
      <h3>Contractors &amp; payments</h3>
      ${conRows||`<p class="hint" style="margin:0 0 10px">No contractors added.</p>`}
      <button class="btn ghost sm" id="addCon">+ Add contractor</button>
    </div>
    <div class="panel">
      <h3>Snagging list</h3>
      ${snagRows||`<p class="hint" style="margin:0 0 10px">No snags logged.</p>`}
      <button class="btn ghost sm" id="addSnag">+ Add snag</button>
    </div>`;
  // actuals
  wrap.querySelectorAll("[data-af]").forEach(inp=>{ const i=+inp.dataset.i,f=inp.dataset.af;
    inp.addEventListener("input",()=>{ r.actuals[i][f]=inp.value; saveData(); });
    if(f==="amount") inp.addEventListener("blur",()=>renderRefurbishing(d)); });
  wrap.querySelectorAll("[data-adel]").forEach(b=>b.onclick=()=>{ r.actuals.splice(+b.dataset.adel,1); saveData(); renderRefurbishing(d); });
  wrap.querySelector("#addAct").onclick=()=>{ r.actuals.push({desc:"",amount:""}); saveData(); renderRefurbishing(d); };
  // schedule
  wrap.querySelector("#r_start").addEventListener("change",e=>{ r.start=e.target.value; saveData(); });
  wrap.querySelector("#r_end").addEventListener("change",e=>{ r.end=e.target.value; saveData(); });
  const pctEl=wrap.querySelector("#r_pct"); pctEl.addEventListener("input",()=>{ r.percent=+pctEl.value; wrap.querySelector("#r_pctlbl").textContent=pctEl.value+"%"; saveData(); });
  pctEl.addEventListener("change",()=>renderRefurbishing(d));
  if(wrap.querySelector("#toOwned")) wrap.querySelector("#toOwned").onclick=()=>{ d.phase="owned"; tab="owned"; saveData(); renderProperty(); };
  // contractors
  wrap.querySelectorAll("[data-cf]").forEach(inp=>{ const i=+inp.dataset.i,f=inp.dataset.cf; inp.addEventListener("input",()=>{ r.contractors[i][f]=inp.value; saveData(); }); });
  wrap.querySelectorAll("[data-cdel]").forEach(b=>b.onclick=()=>{ r.contractors.splice(+b.dataset.cdel,1); saveData(); renderRefurbishing(d); });
  wrap.querySelector("#addCon").onclick=()=>{ r.contractors.push({name:"",trade:"",contact:"",paid:""}); saveData(); renderRefurbishing(d); };
  // snags
  wrap.querySelectorAll("[data-sf]").forEach(inp=>{ const i=+inp.dataset.i; inp.addEventListener("input",()=>{ r.snags[i].text=inp.value; saveData(); }); });
  wrap.querySelectorAll("[data-sdone]").forEach(b=>b.onclick=()=>{ const i=+b.dataset.sdone; r.snags[i].done=!r.snags[i].done; saveData(); renderRefurbishing(d); });
  wrap.querySelectorAll("[data-sdel]").forEach(b=>b.onclick=()=>{ r.snags.splice(+b.dataset.sdel,1); saveData(); renderRefurbishing(d); });
  wrap.querySelector("#addSnag").onclick=()=>{ r.snags.push({text:"",done:false}); saveData(); renderRefurbishing(d); };
}

/* ============================================================ MANAGE TAB */
function renderManage(d){
  const m=ensureManage(d), c=computeDeal(d);
  const wrap=document.getElementById("tabwrap");
  const certRows=CERTS.map(([key,name,freq])=>{
    const st=certStatus(m.certs[key]);
    const when = st.days==null ? "" : ` · ${st.days<0?Math.abs(st.days)+" days ago":st.days+" days left"}`;
    return `<div class="cert">
      <div><div class="cn">${name} <span class="cstat ${st.cls}">${st.label}</span></div><div class="cf">${freq}${when}</div></div>
      <input type="date" data-cert="${key}" value="${esc(m.certs[key]||"")}">
    </div>`;
  }).join("");
  const maint=m.maintenance.map((x,i)=>`<div class="mrow">
      <input type="date" data-mf="date" data-i="${i}" value="${esc(x.date||"")}">
      <input data-mf="desc" data-i="${i}" value="${esc(x.desc||"")}" placeholder="Issue / work">
      <select data-mf="status" data-i="${i}">${["Open","In progress","Done"].map(s=>`<option ${s===x.status?"selected":""}>${s}</option>`).join("")}</select>
      <div class="prefix"><span>£</span><input data-mf="cost" data-i="${i}" inputmode="decimal" value="${esc(x.cost||"")}" placeholder="Cost" style="padding-left:22px"></div>
      <button class="comp-del" data-mdel="${i}" title="Remove">✕</button>
    </div>`).join("");
  const maintTotal=m.maintenance.reduce((a,x)=>a+num(x.cost),0);
  const schemes=["","DPS","MyDeposits","TDS","Other"];
  wrap.innerHTML=`
    <div class="panel">
      <h3>Mortgage</h3>
      <p class="hint">Record the real mortgage on this property — whether it's the refinance after a cash purchase, or one that was already in place.</p>
      <div class="row2">
        <div class="field"><label>Status</label><select id="mo_status">${MORTGAGE_STATES.map(s=>`<option ${s===m.mortgage.status?"selected":""}>${s}</option>`).join("")}</select></div>
        <div class="field"><label>Lender</label><input id="mo_lender" value="${esc(m.mortgage.lender)}"></div>
        <div class="field"><label>Broker</label><input id="mo_broker" value="${esc(m.mortgage.broker)}"></div>
        <div class="field"><label>Type</label><select id="mo_type">${["Interest-only","Repayment"].map(s=>`<option ${s===m.mortgage.type?"selected":""}>${s}</option>`).join("")}</select></div>
        <div class="field"><label>Mortgage amount</label><div class="prefix"><span>£</span><input inputmode="decimal" id="mo_amount" value="${esc(m.mortgage.amount)}"></div></div>
        <div class="field"><label>Monthly payment</label><div class="prefix"><span>£</span><input inputmode="decimal" id="mo_payment" value="${esc(m.mortgage.monthlyPayment)}"></div></div>
        <div class="field"><label>Interest rate</label><div class="prefix"><input inputmode="decimal" id="mo_rate" value="${esc(m.mortgage.rate)}" style="padding-left:12px;padding-right:24px"><span style="left:auto;right:12px">%</span></div></div>
        <div class="field"><label>Term (years)</label><input inputmode="decimal" id="mo_term" value="${esc(m.mortgage.termYears)}"></div>
        <div class="field"><label>Start date</label><input type="date" id="mo_start" value="${esc(m.mortgage.startDate)}"></div>
        <div class="field"><label>Product/fix ends</label><input type="date" id="mo_pend" value="${esc(m.mortgage.productEndDate)}"></div>
        <div class="field"><label>Notes</label><input id="mo_notes" value="${esc(m.mortgage.notes)}"></div>
      </div>
    </div>
    <div class="panel">
      <h3>Tenancy</h3>
      <div class="seg" id="tstatus" style="margin-bottom:16px">
        <button class="${m.status!=='let'?'on':''}" data-st="vacant">Vacant</button>
        <button class="${m.status==='let'?'on':''}" data-st="let">Let</button>
      </div>
      <div class="row2">
        <div class="field"><label>Tenant name</label><input id="m_tenant" value="${esc(m.tenant)}"></div>
        <div class="field"><label>Contact</label><input id="m_contact" value="${esc(m.contact)}" placeholder="phone / email"></div>
        <div class="field"><label>Rent (PCM)</label><div class="prefix"><span>£</span><input inputmode="decimal" id="m_rent" value="${esc(m.rent)}" placeholder="${esc(d.deal.rent||'')}"></div></div>
        <div class="field"><label>Monthly cashflow</label><div style="border:1px solid var(--line);border-radius:10px;padding:11px 12px;font-size:15px;font-weight:600;background:var(--surface);${c.cashflow<0?'color:var(--bad)':''}">${money(c.cashflow)}</div></div>
        <div class="field"><label>Deposit</label><div class="prefix"><span>£</span><input inputmode="decimal" id="m_deposit" value="${esc(m.deposit)}"></div></div>
        <div class="field"><label>Tenancy start</label><input type="date" id="m_start" value="${esc(m.start)}"></div>
        <div class="field"><label>Tenancy end</label><input type="date" id="m_end" value="${esc(m.end)}"></div>
        <div class="field"><label>Deposit scheme</label><select id="m_scheme">${schemes.map(s=>`<option value="${s}" ${s===m.scheme?"selected":""}>${s||"— select —"}</option>`).join("")}</select></div>
      </div>
    </div>
    <div class="panel">
      <h3>Compliance</h3>
      <p class="hint">Enter each certificate's expiry date — the status flags when one's within 60 days or already overdue, and it'll surface on your Portfolio dashboard.</p>
      ${certRows}
    </div>
    <div class="panel">
      <h3>Maintenance log</h3>
      <p class="hint">Log issues and what they cost — useful for your records and for sense-checking your maintenance allowance.</p>
      ${maint||`<p class="hint" style="margin:0 0 10px">No issues logged yet.</p>`}
      <button class="btn ghost sm" id="addM">+ Add issue</button>
      <div class="comp-avg" id="mtotWrap" style="${maintTotal?'':'display:none'}"><span><b>Total logged:</b> <span id="mtot">${money(maintTotal)}</span></span></div>
    </div>`;

  wrap.querySelectorAll("#tstatus button").forEach(b=>b.onclick=()=>{ m.status=b.dataset.st; saveData(); renderManage(d); });
  const lb=(id,setter)=>{ const e=wrap.querySelector(id); if(e) e.addEventListener("input",()=>{ setter(e.value); saveData(); }); };
  lb("#m_tenant",v=>m.tenant=v); lb("#m_contact",v=>m.contact=v); lb("#m_rent",v=>m.rent=v); lb("#m_deposit",v=>m.deposit=v);
  lb("#m_start",v=>m.start=v); lb("#m_end",v=>m.end=v);
  wrap.querySelector("#m_scheme").onchange=e=>{ m.scheme=e.target.value; saveData(); };
  lb("#mo_lender",v=>m.mortgage.lender=v); lb("#mo_broker",v=>m.mortgage.broker=v);
  lb("#mo_amount",v=>m.mortgage.amount=v); lb("#mo_payment",v=>m.mortgage.monthlyPayment=v); lb("#mo_rate",v=>m.mortgage.rate=v);
  lb("#mo_term",v=>m.mortgage.termYears=v); lb("#mo_notes",v=>m.mortgage.notes=v);
  wrap.querySelector("#mo_status").onchange=e=>{ m.mortgage.status=e.target.value; saveData(); };
  wrap.querySelector("#mo_type").onchange=e=>{ m.mortgage.type=e.target.value; saveData(); };
  wrap.querySelector("#mo_start").addEventListener("change",e=>{ m.mortgage.startDate=e.target.value; saveData(); });
  wrap.querySelector("#mo_pend").addEventListener("change",e=>{ m.mortgage.productEndDate=e.target.value; saveData(); });
  // certs: changing a date re-renders to refresh the status flag
  wrap.querySelectorAll("input[data-cert]").forEach(inp=>inp.addEventListener("change",()=>{ m.certs[inp.dataset.cert]=inp.value; saveData(); renderManage(d); }));
  // maintenance rows (no re-render on edit, to keep focus; total updates live on cost)
  wrap.querySelectorAll("[data-mf]").forEach(inp=>{
    const i=+inp.dataset.i, f=inp.dataset.mf, ev=inp.tagName==="SELECT"?"change":"input";
    inp.addEventListener(ev,()=>{
      m.maintenance[i][f]=inp.value; saveData();
      if(f==="cost"){ const t=m.maintenance.reduce((a,x)=>a+num(x.cost),0); const mt=wrap.querySelector("#mtot"); if(mt) mt.textContent=money(t); wrap.querySelector("#mtotWrap").style.display=t?"":"none"; }
    });
  });
  wrap.querySelectorAll("[data-mdel]").forEach(b=>b.onclick=()=>{ m.maintenance.splice(+b.dataset.mdel,1); saveData(); renderManage(d); });
  wrap.querySelector("#addM").onclick=()=>{ m.maintenance.push({date:"",desc:"",status:"Open",cost:""}); saveData(); renderManage(d); };
}

/* ============================================================ PHOTOS */
function renderPhotos(d){
  const wrap=document.getElementById("tabwrap");
  const canUpload=!!(window.fbStorage);
  function paint(){
    wrap.innerHTML=`
      <div class="panel">
        <h3>Viewing photos</h3>
        <p class="hint">Add photos from your viewing — they sync across devices. Tap a photo to view full size.</p>
        ${canUpload
          ? `<label class="btn" style="cursor:pointer;display:inline-block;margin-bottom:16px">
               + Add photos
               <input type="file" id="photoUpload" accept="image/*" multiple style="display:none">
             </label>`
          : `<p class="hint" style="color:var(--bad)">Photo upload requires Firebase — running in demo mode.</p>`}
        <div id="uploadStatus" style="margin-bottom:12px;font-size:14px;color:var(--muted)"></div>
        ${d.photos.length
          ? `<div class="photo-grid">${d.photos.map((p,i)=>`
              <div class="photo-thumb" data-i="${i}">
                <img src="${esc(p.url)}" alt="${esc(p.name||'')}">
                <button class="photo-del" data-i="${i}" title="Delete photo">✕</button>
              </div>`).join("")}</div>`
          : `<p class="hint" style="margin-top:8px">No photos yet.</p>`}
      </div>`;

    if(canUpload){
      wrap.querySelector("#photoUpload").onchange=async e=>{
        const files=[...e.target.files]; if(!files.length) return;
        const status=wrap.querySelector("#uploadStatus");
        status.textContent=`Uploading ${files.length} photo${files.length>1?"s":""}…`;
        let done=0, failed=0;
        for(const file of files){
          try{
            const path=`deals/${d.id}/${Date.now()}_${file.name}`;
            const ref=window.fbStorage.ref(path);
            await ref.put(file);
            const url=await ref.getDownloadURL();
            d.photos.push({url, name:file.name, path});   // accumulate — save once after the loop
            done++;
            status.textContent=`Uploaded ${done} of ${files.length}…`;
          }catch(err){
            console.error("Upload failed",err);
            failed++;
          }
        }
        if(done) saveData();                               // single write → no sync-echo reverts
        status.textContent = failed ? `${failed} photo${failed>1?"s":""} failed to upload.` : "";
        renderPhotos(d);
      };
    }

    wrap.querySelectorAll(".photo-thumb img").forEach(img=>{
      img.onclick=()=>window.open(img.src,"_blank");
    });
    wrap.querySelectorAll(".photo-del").forEach(btn=>{
      btn.onclick=async e=>{
        e.stopPropagation();
        if(!confirm("Delete this photo?")) return;
        const i=+btn.dataset.i;
        const photo=d.photos[i];
        if(window.fbStorage && photo.path){
          try{ await window.fbStorage.ref(photo.path).delete(); }catch(err){ console.warn("Storage delete failed",err); }
        }
        d.photos.splice(i,1);
        saveData();
        renderPhotos(d);
      };
    });
  }
  paint();
}

/* ============================================================ SETTINGS */
function renderSettings(){
  const a=DATA.assumptions;
  const f=(key,label,suffix)=>`<div class="field inline"><label>${label}</label><div class="prefix" style="width:130px">${suffix==='£'?'<span>£</span>':''}<input inputmode="decimal" data-a="${key}" value="${esc(a[key])}" style="${suffix==='£'?'padding-left:24px':''}">${suffix==='%'?'<span style="position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--muted);font-weight:700">%</span>':''}</div></div>`;
  const ft=(key,label)=>`<div class="field"><label>${label}</label><input data-at="${key}" value="${esc(a[key])}"></div>`;
  app.innerHTML=`
    <button class="back" id="back">← All deals</button>
    <div class="page-head"><div><span class="eyebrow">Defaults</span><br><h1 class="page">Settings</h1><div class="ul" style="width:54px"></div></div></div>
    <div class="panel">
      <h3>Deal assumptions</h3>
      <p class="hint">Set once, used on every deal. Tuned for a UK limited company (SPV).</p>
      ${f('ltvPct','Refinance LTV','%')}
      ${f('mortgageRate','Mortgage rate (company BTL)','%')}
      ${f('stressRate','Stress-test rate','%')}
      ${f('mgmtPct','Management','%')}
      ${f('moePct','Maintenance / voids','%')}
      ${f('costOfMoney','Cost of money','£')}
      ${f('solicitor','Solicitor fee','£')}
      ${f('broker','Broker fee','£')}
      ${f('corpTaxPct','Corporation tax (for portfolio)','%')}
    </div>
    <div class="panel">
      <h3>Stamp duty</h3>
      <p class="hint" style="margin:0">Calculated automatically using <b>limited-company (SPV) additional-property rates</b>: 5% on the first £125k, rising in bands, with a flat 17% over £500k. Most St&nbsp;Helens deals sit at a simple 5% of the price.</p>
    </div>
    <div class="panel">
      <h3>Borrower &amp; Guarantor details</h3>
      <p class="hint">Used when generating a loan agreement from a Finance raised entry. These don't change often.</p>
      ${ft('companyName','Company name')}
      ${ft('companyAddress','Company / Guarantor address')}
      ${ft('directorNames','Director / Guarantor names')}
    </div>
    <button class="btn ghost" id="reset">Reset to defaults</button>`;
  app.querySelector("#back").onclick=()=>go("list");
  app.querySelectorAll("[data-a]").forEach(inp=>{
    inp.addEventListener("input",()=>{ a[inp.dataset.a]=num(inp.value); saveData(); });
  });
  app.querySelectorAll("[data-at]").forEach(inp=>{
    inp.addEventListener("input",()=>{ a[inp.dataset.at]=inp.value; saveData(); });
  });
  app.querySelector("#reset").onclick=()=>{ DATA.assumptions={...DEFAULT_ASSUMPTIONS}; saveData(); renderSettings(); };
}

/* ============================================================ SHAREABLE SUMMARY */
function renderSummary(d){
  if(!d){ go("list"); return; }
  const c=computeDeal(d), a=DATA.assumptions;
  const logoSrc=document.getElementById("logo").src;
  const roiTxt = c.hasOffer ? (c.cocInf?"∞ (all cash out)":Math.round(c.coc)+"%") : "—";
  const compsRows = (d.deal.comparables||[]).filter(x=>x.addr||x.price)
      .map(x=>`<div class="bd"><span class="k">${esc(x.addr||"—")}</span><span class="v">${x.price?money(num(x.price)):""}</span></div>`).join("")
      || `<p class="hint" style="margin:0">None recorded.</p>`;
  const dateStr=new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
  app.innerHTML=`
    <div class="toolbar no-print">
      <button class="btn ghost sm" id="back">← Back</button>
      <button class="btn sm" id="print">Print / Save as PDF</button>
      <button class="btn ghost sm" id="copy">Copy summary text</button>
    </div>
    <div class="sheet">
      <img class="sh-logo" src="${logoSrc}" alt="POCO Property">
      <h2>${esc(d.address)}</h2>
      <p class="sh-sub">${esc(d.postcode||"")}${d.beds?` · ${esc(d.beds)} bed`:""}${d.price?` · listed ${money(num(d.price))}`:""}${d.source?` · ${esc(d.source)}`:""} · ${esc((PHASES.find(p=>p[0]===d.phase)||[,d.stage])[1])}</p>
      <div class="sh-hero">
        <div class="b dark"><div class="k">Max offer · MIMO</div><div class="v">${money(c.maxOffer)}</div><div class="sh-yellow"></div></div>
        <div class="b"><div class="k">Monthly cashflow</div><div class="v">${money(c.cashflow)}</div></div>
        <div class="b"><div class="k">Cash-on-cash ROI</div><div class="v">${roiTxt}</div></div>
      </div>
      <div class="sh-section">
        <h4>How the max offer is built</h4>
        <div class="bd"><span class="k">Mortgage (${a.ltvPct}% of DUV ${money(num(d.deal.duv))})</span><span class="v">${money(c.mortgage)}</span></div>
        <div class="bd"><span class="k">– Refurb</span><span class="v">${money(c.refurb)}</span></div>
        <div class="bd"><span class="k">– Solicitor &amp; broker</span><span class="v">${money(c.solicitor+c.broker)}</span></div>
        <div class="bd"><span class="k">– Cost of money</span><span class="v">${money(c.costOfMoney)}</span></div>
        <div class="bd"><span class="k">– Stamp duty (SPV)</span><span class="v">${money(c.stampDuty)}</span></div>
        <div class="bd total"><span class="k">Max offer</span><span class="v">${money(c.maxOffer)}</span></div>
        ${c.hasOffer?`<div class="bd"><span class="k">Your offer</span><span class="v">${money(c.yourOffer)}</span></div><div class="bd"><span class="k">Money left in</span><span class="v">${money(c.moneyLeftIn)}</span></div>`:""}
      </div>
      <div class="sh-section">
        <h4>Income &amp; return</h4>
        <div class="bd"><span class="k">Rent (PCM)</span><span class="v">${money(c.rent)}</span></div>
        <div class="bd"><span class="k">Monthly cashflow (@${c.mortgageRate}%)</span><span class="v">${money(c.cashflow)}</span></div>
        <div class="bd"><span class="k">Stress-tested (@${a.stressRate}%)</span><span class="v">${money(c.sCashflow)}</span></div>
        <div class="bd"><span class="k">Annual cashflow</span><span class="v">${money(c.annual)}</span></div>
        <div class="bd"><span class="k">Gross yield</span><span class="v">${c.grossYield!=null?c.grossYield.toFixed(1)+"%":"—"}</span></div>
      </div>
      <div class="sh-section">
        <h4>Comparables behind the DUV</h4>
        ${compsRows}
      </div>
      <p class="footnote" style="text-align:left;margin-top:22px">Prepared ${dateStr} · POCO Property · A rough guide for discussion, not a valuation or financial advice.</p>
    </div>`;
  app.querySelector("#back").onclick=()=>go("property",d.id);
  app.querySelector("#print").onclick=()=>window.print();
  app.querySelector("#copy").onclick=()=>{
    const t=`${d.address} (${d.stage})\nMax offer (MIMO): ${money(c.maxOffer)}\nMonthly cashflow: ${money(c.cashflow)}\nAnnual cashflow: ${money(c.annual)}\nCash-on-cash ROI: ${roiTxt}\nGross yield: ${c.grossYield!=null?c.grossYield.toFixed(1)+'%':'—'}\nRefurb: ${money(c.refurb)} · Stamp duty: ${money(c.stampDuty)}`;
    if(navigator.clipboard) navigator.clipboard.writeText(t);
    const b=app.querySelector("#copy"); b.textContent="Copied ✓"; setTimeout(()=>b.textContent="Copy summary text",1500);
  };
}

/* ============================================================ LOAN AGREEMENT */
function renderLoanAgreement(d, financeIndex){
  if(!d){ go("list"); return; }
  const p=ensurePurchase(d);
  const x=p.finance[financeIndex];
  if(!x){ go("property", d.id); return; }
  const a=DATA.assumptions;
  const interest=loanInterest(x.amount,x.rate,x.dateLoaned,x.paybackDate);
  const todayISO=new Date().toISOString().slice(0,10);
  const lenderLine=`${esc(x.name)} of ${esc(x.address)} (the 'Lender')`;
  const borrowerLine=`${esc(a.companyName)} of ${esc(a.companyAddress)} ('the Borrower')`;
  const guarantorLine=`${esc(a.directorNames)} of ${esc(a.companyAddress)} ('the Guarantor')`;
  const loanAmt=money(num(x.amount));
  const loanDate=fmtDate(x.dateLoaned);
  const repayDate=fmtDate(x.paybackDate);
  const dated=fmtDate(todayISO);
  const rateTxt=`${esc(x.rate)}%`;
  const interestTxt=interest==null?"—":money(interest);
  app.innerHTML=`
    <div class="toolbar no-print">
      <button class="btn ghost sm" id="back">← Back</button>
      <button class="btn sm" id="print">Print / Save as PDF</button>
    </div>
    <div class="sheet">
      <h2 style="margin-top:60px">Loan agreement</h2>
      <p class="sh-sub">Dated: ${dated}</p>

      <div class="sh-section" style="page-break-before:always">
        <h4>1. Definitions</h4>
        <p>These are the definitions that apply to this agreement unless the context requires a different interpretation:</p>
        <div class="bd"><span class="k">"Interest Payment"</span><span class="v">${rateTxt} GROSS (pro rata) on the principle amount (based on 12 month loan)</span></div>
        <div class="bd"><span class="k">"Loan"</span><span class="v">means the sum of ${loanAmt} or such greater sum as shall in fact have been lent by the Lender to the Borrower at any time this agreement subsists. Where the context admits, it includes interest.</span></div>
        <div class="bd"><span class="k">Loan Date</span><span class="v">${loanDate}</span></div>
        <div class="bd"><span class="k">Repayment Date</span><span class="v">${repayDate}</span></div>
        <p style="margin-top:16px">This agreement is dated: ${dated}</p>
        <p>It is made between</p>
        <p style="margin-left:20px">(1.) ${lenderLine}</p>
        <p style="margin-left:20px">AND</p>
        <p style="margin-left:20px">(2.) ${borrowerLine}</p>
        <p style="margin-left:20px">(3.) AND</p>
        <p style="margin-left:20px">${guarantorLine}</p>
        <p style="margin-top:16px"><b>The terms of this Agreement are:</b></p>
      </div>

      <div class="sh-section">
        <h4>2. Purpose of Loan and Security</h4>
        <p>The Loan shall be used to:</p>
        <p style="margin-left:20px">2.1. Fund property investment</p>
        <p style="margin-left:20px">2.2. The Borrower will secure the loan with a Personal Guarantee from ${esc(a.directorNames)} of ${esc(a.companyAddress)}</p>
      </div>

      <div class="sh-section">
        <h4>3. Sum of Loan and advances</h4>
        <p style="margin-left:20px">3.1. The total sum offered by the Lender is ${loanAmt}.</p>
        <p style="margin-left:20px">3.2. The Lender shall transfer the sum of ${loanAmt} to the Borrower's specified bank account to be cleared by the Loan Date.</p>
      </div>

      <div class="sh-section">
        <h4>4. Repayment conditions</h4>
        <p style="margin-left:20px">4.1. Subject to clause 4.2 the Loan shall be repaid in full no later than 12 months after the Loan Date unless otherwise agreed.</p>
        <p style="margin-left:20px">4.2. In the event that at the Repayment Date both parties wish to continue, the Loan will continue at the agreed rate of ${rateTxt} per annum (pro rata) until the Loan is repaid in full subject always to the right of the Lender to demand repayment of the Loan in full on 60 days prior written notice once the Repayment Date has expired.</p>
      </div>

      <div class="sh-section">
        <h4>5. Interest payable</h4>
        <p>The Interest Payment shall be paid into the Lender's chosen bank account on the Repayment Date</p>
      </div>

      <div class="sh-section">
        <h4>6. Early repayment of loan</h4>
        <p>The Borrower will repay the Loan in full, along with all interest due, no sooner than 12 months from the Loan Date and no later than the Repayment Date (if different) unless otherwise agreed by both parties</p>
      </div>

      <div class="sh-section" style="page-break-before:always">
        <h4>7. Method of payment</h4>
        <p>All payments due to the Lender of both capital and interest shall be paid in pounds sterling by bank transfer into such account and bank within the United Kingdom.</p>
      </div>

      <div class="sh-section">
        <h4>8. Default in payment of interest or repayment of capital</h4>
        <p style="margin-left:20px">8.1. An "event of default" occurs when:</p>
        <p style="margin-left:40px">8.1.1. the Borrower fails to pay in full and on the due date for payment any sum due; or</p>
        <p style="margin-left:40px">8.1.2. any step is taken in connection with any voluntary arrangement or any other compromise or arrangement for the benefit of any creditors of ${esc(a.companyName)}; or</p>
        <p style="margin-left:40px">8.1.3. a petition is presented for an order for the bankruptcy of ${esc(a.companyName)}</p>
        <p style="margin-left:20px">8.2. Where an event of default has occurred the Lender may issue a notice of default. When the Lender does so, the whole amount of the Loan then outstanding and any unpaid interest immediately fall due for payment.</p>
        <p style="margin-left:40px">8.2.1. In the event that no interest payments have yet been made, the Borrower will pay the Lender a minimum of 3 months interest OR the current accrued interest (whichever is higher).</p>
        <p style="margin-left:40px">8.2.2. In the event that some interest payments have been made but amount to less than 3 months interest on the principle amount, the Borrower will pay the Lender an amount to bring total interest paid up to the equivalent of 3 months interest OR the current accrued interest (whichever is higher)</p>
        <p style="margin-left:40px">8.2.3. In any other event, the Borrower will pay the Lender the remaining accrued interest on the principle amount.</p>
      </div>

      <div class="sh-section">
        <h4>9. Borrower's warranties</h4>
        <p>The Borrower represents and warrants:</p>
        <p style="margin-left:20px">9.1. that the borrower is authorised to enter into this agreement;</p>
        <p style="margin-left:20px">9.2. that the financial information submitted to the Lender fairly represents the financial state of the Borrower at the date of this agreement knowing that the Lender has relied on it in granting the Loan;</p>
        <p style="margin-left:20px">9.3. that the Borrower has no undisclosed contingent obligations;</p>
        <p style="margin-left:20px">9.4. that there are no material, unrealised or anticipated losses from any present commitment of the Borrower;</p>
        <p style="margin-left:20px">9.5. that the Borrower will advise the Lender of material adverse changes which occur at any time prior to the date of final repayment of the Loan.</p>
      </div>

      <div class="sh-section" style="page-break-before:always">
        <h4>10. Miscellaneous matters</h4>
        <p style="margin-left:20px">10.1. No amendment or variation to this agreement is valid unless in writing, signed by each of the parties or by an authorised representative.</p>
        <p style="margin-left:20px">10.2. So far as any time, date or period is mentioned in this agreement, time shall be of the essence.</p>
        <p style="margin-left:20px">10.3. If any term or provision of this agreement is at any time held by any jurisdiction to be void, invalid or unenforceable, then it shall be treated as changed or reduced, only to the extent minimally necessary to bring it within the laws of that jurisdiction and to prevent it from being void and it shall be binding in that changed or reduced form. Subject to that, each provision shall be interpreted as severable and shall not in any way affect any other of these terms.</p>
        <p style="margin-left:20px">10.4. The rights and obligations of the parties set out in this agreement shall pass to any permitted successor in title.</p>
        <p style="margin-left:20px">10.5. If the Borrower is in breach of any term of this agreement, the Lender may:</p>
        <p style="margin-left:40px">10.5.1. issue a claim in any court. All reasonable costs of the lender due to any breach are to be paid by the borrower</p>
        <p style="margin-left:20px">10.6. No failure or delay by any party to exercise any right, power or remedy will operate as a waiver of it nor indicate any intention to reduce that or any other right in the future.</p>
        <p style="margin-left:20px">10.7. Any communication to be served on either of the parties by the other shall be delivered by hand or sent by first class post or recorded delivery or by fax or by e-mail.</p>
        <p style="margin-left:40px">It shall be deemed to have been delivered:</p>
        <p style="margin-left:40px">if delivered by hand: on the day of delivery;</p>
        <p style="margin-left:40px">if sent by post to the correct address: within 72 hours of posting;</p>
        <p style="margin-left:40px">If sent by fax to the correct number: within 24 hours;</p>
        <p style="margin-left:40px">If sent by e-mail to the address from which the receiving party has last sent e-mail: within 24 hours if no notice of non-receipt has been received by the sender.</p>
        <p style="margin-left:20px">10.8. The validity, construction and performance of this agreement shall be governed by the laws of England and Wales and you agree that any dispute arising from it shall be litigated only in England and Wales.</p>
      </div>

      <div class="sh-section">
        <h4>Loan Schedule</h4>
        <div class="bd"><span class="k">Loan Amount</span><span class="v">${loanAmt}</span></div>
        <div class="bd"><span class="k">Loan Date</span><span class="v">${loanDate}</span></div>
        <div class="bd"><span class="k">Repayment Date</span><span class="v">${repayDate}</span></div>
        <div class="bd"><span class="k">Interest rate</span><span class="v">${rateTxt} (based on 12 month loan)</span></div>
        <div class="bd"><span class="k">Interest over full term (12 months)</span><span class="v">${interestTxt}</span></div>
      </div>

      <div class="sh-section">
        <h4>Guarantee</h4>
        <p>The Guarantor guarantees to the Lender that the Borrower shall comply with the provisions of this agreement and shall pay the Loan Sum, Interest and any other sums due in accordance with this agreement and in the event that the Borrower fails to pay the same on demand (including interest up to the actual date of payment), within 5 working days of any such demand.</p>
        <p>The Guarantor shall indemnify the Lender for any and all reasonable costs arising out of the enforcement and/or preservation of this clause 12.</p>
      </div>

      <div class="sh-section" style="page-break-before:always">
        <p><b>Signed as a deed on behalf of the Lender:</b></p>
        <p style="margin-top:50px">.............................................................. ..............................................................</p>
        <p><b>${lenderLine}</b></p>

        <p style="margin-top:30px"><b>Signed as a deed on behalf of the Borrower:</b></p>
        <p style="margin-top:50px">.............................................................. ..............................................................</p>
        <p><b>${esc(a.directorNames)}, Director, ${esc(a.companyName)} of ${esc(a.companyAddress)} (the 'Lender')</b></p>

        <p style="margin-top:30px"><b>Signed as a deed on behalf of the Guarantor:</b></p>
        <p style="margin-top:50px">.............................................................. ..............................................................</p>
        <p><b>${esc(a.directorNames)} of ${esc(a.companyAddress)}</b></p>
      </div>

      <p class="footnote" style="text-align:left;margin-top:22px">Generated ${dated} · POCO Property · This is a template loan agreement, not legal advice — review it yourself or with your solicitor before use.</p>
    </div>`;
  app.querySelector("#back").onclick=()=>go("property", d.id);
  app.querySelector("#print").onclick=()=>window.print();
}

/* ---------- router ---------- */
function render(){
  if(view==="list") renderList();
  else if(view==="property") renderProperty();
  else if(view==="settings") renderSettings();
  else if(view==="summary") renderSummary(curDeal());
  else if(view==="agreement") renderLoanAgreement(curDeal(), currentFinanceIndex);
}
document.getElementById("navSettings").onclick=()=>go("settings");
document.getElementById("logo").onclick=()=>go("list");

/* ---------- boot ---------- */
(async function(){
  if(USE_FIREBASE){
    fbInit();                       // shows the sign-in gate, then loads the shared workspace
  } else {
    await loadData(); render();     // local demo mode
    const b=document.getElementById("demobadge"); if(b) b.style.display="";
  }
})();
