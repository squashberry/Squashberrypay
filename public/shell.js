"use strict";
/* SquashberryPay — Noir shell. Loads AFTER merchant.js. Overrides a few render
   functions and adds the command palette. All API calls stay in merchant.js. */
(function(){
  const reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Greeting by time of day */
  const gh=new Date().getHours(),gw=document.getElementById("greetWord");
  if(gw)gw.textContent=gh<12?"Good morning":gh<18?"Good afternoon":"Good evening";

  /* Count-up that also works after every refresh (the old one stuck at 0) */
  window.animateMetric=function(el,target,isMoney){
    if(!el)return;
    const end=Number(target||0),f=v=>isMoney?money(v):String(Math.round(v));
    cancelAnimationFrame(el._raf||0);
    if(reduce){el.textContent=f(end);return}
    const t0=performance.now(),d=750;
    const tick=n=>{const p=Math.min(1,(n-t0)/d),e=1-Math.pow(1-p,3);el.textContent=f(end*e);if(p<1)el._raf=requestAnimationFrame(tick)};
    el._raf=requestAnimationFrame(tick);
  };

  /* Breadcrumb + scroll reset on navigation */
  const label=b=>[...b.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join("").trim();
  const _show=window.show;
  window.show=function(n){
    _show(n);
    const b=document.querySelector('.side-link[data-section="'+n+'"]'),c=document.getElementById("crumb");
    if(c&&b)c.textContent=label(b);
    window.scrollTo(0,0);
  };

  /* Hide empty count badges on the rail */
  const sb=document.getElementById("merchantSidebar");
  const sync=()=>document.querySelectorAll(".side-link em").forEach(e=>{e.hidden=!Number(e.textContent)});
  if(sb){new MutationObserver(sync).observe(sb,{childList:true,subtree:true,characterData:true});sync()}

  /* Verify payments: queue on the left, receipt + actions on the right */
  let sel=null;
  window.renderPaymentRequests=function(){
    const host=document.getElementById("paymentRequestsList");
    if(!host||!dashboard)return;
    const rows=dashboard.payment_requests||[];
    if(!rows.length){host.innerHTML=empty("Nothing to verify","New customer receipts will appear here.");return}
    if(!rows.some(r=>r.id===sel))sel=rows[0].id;
    const title=p=>p.donation_campaigns?.name||p.products?.name||"Payment";
    const who=p=>p.customer_email||p.service_users?.email||p.customer?.email||"Customer";
    const p=rows.find(r=>r.id===sel);
    host.innerHTML='<div class="vq"><div class="vq-list">'+rows.map(r=>
      '<button type="button" class="vq-item'+(r.id===sel?" active":"")+'" data-vq="'+esc(r.id)+'"><span class="payment-icon">'+esc(title(r).charAt(0))+'</span><span><strong>'+esc(title(r))+'</strong><small>'+esc(who(r))+'</small></span><b>'+money(r.amount,r.currency)+'</b></button>').join("")+
      '</div><div class="vq-detail"><span class="status-badge pending">Awaiting verification</span><div class="vq-amount">'+money(p.amount,p.currency)+'</div><p class="vq-title">'+esc(title(p))+'</p>'+
      '<div class="vq-facts"><div><span>Customer</span><strong>'+esc(who(p))+'</strong></div><div><span>Reference</span><strong>'+esc(p.payment_reference||"—")+'</strong></div><div><span>Application</span><strong>'+esc(p.services?.name||"Donation")+'</strong></div><div><span>Submitted</span><strong>'+esc(fmt(p.receipt_uploaded_at||p.created_at))+'</strong></div></div>'+
      '<div class="vq-actions"><button class="button" type="button" data-open-receipt="'+esc(p.id)+'">View receipt</button><button class="button primary" type="button" data-approve-payment="'+esc(p.id)+'">Confirm payment</button><button class="button reject" type="button" data-reject-payment="'+esc(p.id)+'">Reject</button></div></div></div>';
  };
  document.addEventListener("click",e=>{const b=e.target.closest("[data-vq]");if(b){sel=b.dataset.vq;window.renderPaymentRequests()}});

  /* Command palette: press / or Ctrl/Cmd+K */
  const pal=document.createElement("div");
  pal.className="pal";pal.hidden=true;
  pal.innerHTML='<div class="pal-box" role="dialog" aria-modal="true" aria-label="Command menu"><input id="palInput" placeholder="Search payments, customers, or jump to…" autocomplete="off" spellcheck="false"><div class="pal-list" id="palList"></div><div class="pal-foot"><span>↑↓ move</span><span>↵ open</span><span>esc close</span></div></div>';
  document.body.appendChild(pal);
  const input=pal.querySelector("#palInput"),list=pal.querySelector("#palList");
  let items=[],idx=0;
  const ACTIONS=[
    ["+","Create payment link",()=>openPaymentLinkCreator()],
    ["+","Create product",()=>openProductCreator()],
    ["+","Add payment method",()=>openMethodCreator()],
    ["+","Add application",()=>openAppWizard()],
    ["↓","Export payments (CSV)",()=>exportCsv("squashberrypay-payments.csv",dashboard?.payments||[])],
    ["↪","Sign out",()=>openSignOutConfirm()]
  ];
  function build(q){
    q=q.trim().toLowerCase();const out=[];
    const hit=s=>!q||s.toLowerCase().includes(q);
    document.querySelectorAll(".dashboard-nav .side-link[data-section],.sidebar-bottom .side-link[data-section]").forEach(b=>{
      const t=label(b);if(hit(t))out.push({g:"Go to",i:b.querySelector("span")?.textContent||"→",t,run:()=>show(b.dataset.section)});
    });
    ACTIONS.forEach(a=>{if(hit(a[1]))out.push({g:"Actions",i:a[0],t:a[1],run:a[2]})});
    if(q.length>=2&&typeof dashboard!=="undefined"&&dashboard){
      (dashboard.payments||[]).filter(p=>[p.payment_reference,p.customer?.email,p.product?.name].join(" ").toLowerCase().includes(q)).slice(0,5)
        .forEach(p=>out.push({g:"Payments",i:"↗",t:(p.payment_reference||p.id)+" · "+money(p.amount,p.currency),s:p.customer?.email||"Guest",run:()=>{show("payments");const s=document.getElementById("paymentSearch");if(s){s.value=p.payment_reference||"";s.dispatchEvent(new Event("input"))}}}));
      (dashboard.customers||[]).filter(c=>[c.email,c.external_user_id].join(" ").toLowerCase().includes(q)).slice(0,4)
        .forEach(c=>out.push({g:"Customers",i:"♙",t:c.email||c.id,run:()=>{show("customers");const s=document.getElementById("customerSearch");if(s){s.value=c.email||"";s.dispatchEvent(new Event("input"))}}}));
    }
    return out;
  }
  function paint(){
    if(!items.length){list.innerHTML='<div class="pal-empty">Nothing matches. Try a payment reference or a customer email.</div>';return}
    let g="",h="";
    items.forEach((it,n)=>{
      if(it.g!==g){g=it.g;h+='<div class="pal-group">'+esc(g)+'</div>'}
      h+='<button type="button" class="pal-item'+(n===idx?" on":"")+'" data-n="'+n+'"><span>'+esc(it.i)+'</span>'+esc(it.t)+(it.s?'<small>'+esc(it.s)+'</small>':"")+'</button>';
    });
    list.innerHTML=h;list.querySelector(".on")?.scrollIntoView({block:"nearest"});
  }
  const open=()=>{pal.hidden=false;input.value="";items=build("");idx=0;paint();setTimeout(()=>input.focus(),10)};
  const close=()=>{pal.hidden=true};
  const go=n=>{const it=items[n];if(!it)return;close();it.run()};
  input.addEventListener("input",()=>{items=build(input.value);idx=0;paint()});
  input.addEventListener("keydown",e=>{
    if(e.key==="ArrowDown"){e.preventDefault();idx=Math.min(items.length-1,idx+1);paint()}
    else if(e.key==="ArrowUp"){e.preventDefault();idx=Math.max(0,idx-1);paint()}
    else if(e.key==="Enter"){e.preventDefault();go(idx)}
    else if(e.key==="Escape")close();
  });
  list.addEventListener("click",e=>{const b=e.target.closest("[data-n]");if(b)go(Number(b.dataset.n))});
  pal.addEventListener("mousedown",e=>{if(e.target===pal)close()});
  document.getElementById("openPalette")?.addEventListener("click",open);
  document.addEventListener("keydown",e=>{
    const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||"");
    if((e.key==="k"&&(e.ctrlKey||e.metaKey))||(e.key==="/"&&!typing)){e.preventDefault();pal.hidden?open():close()}
    else if(e.key==="Escape"&&!pal.hidden)close();
  });
})();
