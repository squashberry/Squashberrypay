(function(global){
  "use strict";

  const API_BASE=String(
    global.SQUASHBERRYPAY_API_BASE ||
    "https://squashberrypay.squashberrypay.workers.dev"
  ).replace(/\/+$/,"");

  const VERSION="3.0.0";
  let config={
    clientId:"",
    externalUserId:"",
    email:"",
    packageId:"",
    returnUrl:"",
    environment:"live"
  };

  const esc=value=>String(value??"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");

  const uid=()=>(
    global.crypto?.randomUUID
      ? global.crypto.randomUUID()
      : "sbp_"+Date.now()+"_"+Math.random().toString(36).slice(2)
  );

  const storageKey=()=>[
    "sbp-payment",
    config.clientId,
    config.externalUserId
  ].join(":");

  const saveCurrent=payment=>{
    try{
      sessionStorage.setItem(storageKey(),JSON.stringify(payment));
    }catch{}
  };

  const loadCurrent=()=>{
    try{
      const raw=sessionStorage.getItem(storageKey());
      return raw?JSON.parse(raw):null;
    }catch{return null}
  };

  async function request(path,options){
    const headers=Object.assign(
      {
        "Content-Type":"application/json",
        "X-SquashberryPay-Client-ID":config.clientId
      },
      config.packageId
        ? {"X-SquashberryPay-Package-ID":config.packageId}
        : {},
      options?.headers||{}
    );

    const response=await fetch(API_BASE+path,Object.assign({},options||{},{headers}));
    let data={};
    try{data=await response.json()}catch{}
    if(!response.ok){
      const error=new Error(data.error||"SquashberryPay request failed.");
      error.status=response.status;
      error.data=data;
      throw error;
    }
    return data;
  }

  function ensureConfig(overrides){
    if(overrides)config=Object.assign({},config,overrides);
    if(!config.clientId)throw new Error("SquashberryPay clientId is required.");
    if(!config.externalUserId)throw new Error("SquashberryPay externalUserId is required.");
    if(!config.email)throw new Error("SquashberryPay email is required.");
    return config;
  }

  async function createPayment(options={}){
    ensureConfig(options);
    const body={
      external_user_id:config.externalUserId,
      email:config.email,
      product_code:String(options.productCode||"").trim(),
      amount:options.amount,
      customer_reference:
        options.customerReference
          ? String(options.customerReference).trim().slice(0,160)
          : null,
      return_url:
        options.returnUrl ||
        config.returnUrl ||
        global.location?.href ||
        null
    };

    if(!body.product_code){
      throw new Error("SquashberryPay productCode is required.");
    }

    const data=await request("/api/v1/public/payments",{
      method:"POST",
      headers:{
        "Idempotency-Key":
          String(options.idempotencyKey||("sbp_"+uid()))
      },
      body:JSON.stringify(body)
    });

    saveCurrent({
      paymentId:data.payment?.id,
      payment:data.payment,
      createdAt:Date.now()
    });

    return data;
  }

  async function getPayment(paymentId){
    ensureConfig();
    return request(
      "/api/v1/public/payments/"+encodeURIComponent(paymentId)
    );
  }

  async function cancelPayment(paymentId){
    ensureConfig();
    return request(
      "/api/v1/public/payments/"+encodeURIComponent(paymentId)+"/cancel",
      {
        method:"POST",
        headers:{
          "Idempotency-Key":"sbp_cancel_"+paymentId
        },
        body:"{}"
      }
    );
  }

  async function redeemPayment(paymentId,code){
    ensureConfig();
    return request(
      "/api/v1/public/payments/"+encodeURIComponent(paymentId)+"/redeem",
      {
        method:"POST",
        headers:{
          "Idempotency-Key":"sbp_redeem_"+paymentId+"_"+String(code||"")
        },
        body:JSON.stringify({
          external_user_id:config.externalUserId,
          token:String(code||"").trim().toUpperCase()
        })
      }
    );
  }

  function makeModal(payment,onClosed){
    const modal=document.createElement("div");
    modal.style.cssText=[
      "position:fixed","inset:0","z-index:2147483000",
      "display:flex","align-items:center","justify-content:center",
      "padding:18px","background:rgba(0,0,0,.56)",
      "backdrop-filter:blur(12px)"
    ].join(";");

    const panel=document.createElement("div");
    panel.style.cssText=[
      "width:min(720px,100%)","height:min(860px,92vh)",
      "background:#fff","border-radius:26px","overflow:hidden",
      "box-shadow:0 24px 80px rgba(0,0,0,.28)",
      "display:flex","flex-direction:column"
    ].join(";");

    const top=document.createElement("div");
    top.style.cssText=[
      "height:58px","display:flex","align-items:center",
      "justify-content:space-between","padding:0 16px 0 20px",
      "border-bottom:1px solid #ecece7","font:700 15px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif"
    ].join(";");

    const title=document.createElement("span");
    title.textContent="SquashberryPay";
    const close=document.createElement("button");
    close.type="button";
    close.textContent="Close";
    close.style.cssText=[
      "border:0","background:#f3f3ef","border-radius:999px",
      "padding:9px 14px","font:700 13px inherit","cursor:pointer"
    ].join(";");

    const frame=document.createElement("iframe");
    frame.src=payment.payment_url;
    frame.title="SquashberryPay payment";
    frame.style.cssText="border:0;flex:1;width:100%;background:#fff";

    top.append(title,close);
    panel.append(top,frame);
    modal.append(panel);

    const closeModal=()=>{
      modal.remove();
      document.body.style.overflow="";
      if(onClosed)onClosed();
    };

    close.onclick=closeModal;
    modal.addEventListener("click",event=>{
      if(event.target===modal)closeModal();
    });

    document.body.append(modal);
    document.body.style.overflow="hidden";
    return {modal,close:closeModal};
  }

  function styleButton(button,options){
    if(options.applyDefaultStyle===false)return;
    if(!button.dataset.sbpStyled){
      button.dataset.sbpStyled="1";
      button.style.cssText+=[
        "appearance:none","border:0","border-radius:14px",
        "padding:13px 18px","background:#111",
        "color:#fff","font:700 14px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
        "cursor:pointer","transition:transform .16s ease,opacity .16s ease"
      ].join(";");
    }
  }

  function mountPayButton(target,options={}){
    ensureConfig(options);
    const button=typeof target==="string"
      ? document.querySelector(target)
      : target;

    if(!button)throw new Error("SquashberryPay button target was not found.");

    styleButton(button,options);
    const originalText=button.textContent||"Pay";
    const listener=async()=>{
      if(button.disabled)return;
      button.disabled=true;
      button.style.opacity=".65";
      button.textContent=options.loadingText||"Preparing payment…";
      try{
        const payment=await createPayment(options);
        if(options.onCreated)await options.onCreated(payment);
        if(options.openCheckout!==false){
          makeModal(payment,options.onCheckoutClosed);
        }
        if(options.onReadyForCode){
          options.onReadyForCode(payment.payment);
        }
      }catch(error){
        if(options.onError)options.onError(error);
        else global.console?.error(error);
      }finally{
        button.disabled=false;
        button.style.opacity="";
        button.textContent=originalText;
      }
    };

    button.addEventListener("click",listener);

    return {
      element:button,
      destroy(){
        button.removeEventListener("click",listener);
      },
      click:listener
    };
  }

  function mountCodeBox(target,options={}){
    ensureConfig(options);
    const host=typeof target==="string"
      ? document.querySelector(target)
      : target;

    if(!host)throw new Error("SquashberryPay code-box target was not found.");

    const current=options.paymentId
      ? {paymentId:options.paymentId}
      : loadCurrent();

    const state={
      paymentId:current?.paymentId||null,
      timer:null,
      busy:false
    };

    host.innerHTML="";
    const root=document.createElement("div");
    root.style.cssText=[
      "border:1px solid #e4e4df","border-radius:22px",
      "padding:18px","background:#fff",
      "font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif"
    ].join(";");

    const title=document.createElement("div");
    title.textContent=options.title||"Enter your SquashberryPay code";
    title.style.cssText="font-weight:800;font-size:16px";

    const description=document.createElement("p");
    description.textContent=
      options.description||
      "After the merchant confirms your payment, the one-time code is sent to your email.";
    description.style.cssText="margin:8px 0 14px;color:#6d6d67;font-size:13px;line-height:1.5";

    const row=document.createElement("div");
    row.style.cssText="display:flex;gap:8px";

    const input=document.createElement("input");
    input.type="text";
    input.inputMode="text";
    input.autocomplete="one-time-code";
    input.maxLength=64;
    input.placeholder="SBP-XXXX-XXXX";
    input.style.cssText=[
      "flex:1","min-width:0","height:48px",
      "border:1px solid #d9d9d3","border-radius:13px",
      "padding:0 14px","font:800 16px ui-monospace,SFMono-Regular,Menlo,monospace",
      "letter-spacing:1px","outline:none","text-transform:uppercase"
    ].join(";");

    const verify=document.createElement("button");
    verify.type="button";
    verify.textContent="Verify";
    verify.style.cssText=[
      "height:48px","border:0","border-radius:13px",
      "padding:0 16px","background:#111","color:#fff",
      "font-weight:800","cursor:pointer"
    ].join(";");

    const status=document.createElement("div");
    status.setAttribute("role","status");
    status.style.cssText="margin-top:12px;font-size:13px;color:#666";

    row.append(input,verify);
    root.append(title,description,row,status);
    host.append(root);

    const setStatus=(text,kind)=>{
      status.textContent=text||"";
      status.style.color=
        kind==="success"?"#16803a":
        kind==="error"?"#c53c2d":
        "#666";
    };

    const stop=()=>{
      if(state.timer){
        clearInterval(state.timer);
        state.timer=null;
      }
    };

    const reportPaid=payload=>{
      stop();
      input.disabled=true;
      verify.disabled=true;
      setStatus(
        options.successText||
        "Payment verified. Your purchase is now unlocked.",
        "success"
      );
      if(options.onPaid)options.onPaid(payload);
    };

    const readStatus=async()=>{
      if(!state.paymentId)return;
      try{
        const result=await getPayment(state.paymentId);
        const p=result.payment||{};
        if(["completed","redeemed"].includes(
          String(p.payment_state||"").toLowerCase()
        )){
          reportPaid({
            paymentId:p.id,
            payment:p,
            unlocked:true,
            source:"status"
          });
          return;
        }
        if(
          ["approved","code_issued"].includes(
            String(p.payment_state||"").toLowerCase()
          )
        ){
          setStatus(
            "Payment confirmed. Check your email for the one-time code."
          );
        }else if(
          p.payment_state==="awaiting_verification"||
          p.status==="awaiting_verification"
        ){
          setStatus("Receipt received. Waiting for merchant confirmation.");
        }else if(
          ["rejected","cancelled","expired"].includes(
            String(p.payment_state||p.status||"").toLowerCase()
          )
        ){
          stop();
          setStatus(
            "This payment is "+String(p.payment_state||p.status)+".",
            "error"
          );
        }
      }catch(error){
        if(options.onError)options.onError(error);
      }
    };

    const doVerify=async()=>{
      if(state.busy||!state.paymentId)return;
      const code=String(input.value||"").trim().toUpperCase();
      if(!code){
        setStatus("Enter the payment code first.","error");
        return;
      }
      state.busy=true;
      verify.disabled=true;
      verify.textContent="Checking…";
      try{
        const result=await redeemPayment(state.paymentId,code);
        if(result?.verified||result?.unlocked){
          reportPaid({
            ...result,
            paymentId:state.paymentId,
            unlocked:true,
            source:"code"
          });
        }else{
          setStatus("The code could not be verified.","error");
        }
      }catch(error){
        setStatus(
          error?.data?.reason==="TOO_MANY_ATTEMPTS"
            ? "Too many attempts. Please try again later."
            : (error.message||"The code could not be verified."),
          "error"
        );
        if(options.onError)options.onError(error);
      }finally{
        state.busy=false;
        if(!input.disabled){
          verify.disabled=false;
          verify.textContent="Verify";
        }
      }
    };

    verify.onclick=doVerify;
    input.addEventListener("keydown",event=>{
      if(event.key==="Enter")doVerify();
    });

    if(state.paymentId){
      setStatus("Payment created. Complete payment, then enter the code sent by email.");
      readStatus();
      state.timer=setInterval(readStatus,5000);
    }else{
      setStatus("Start a payment to activate code verification.");
    }

    return {
      setPayment(payment){
        state.paymentId=
          typeof payment==="string"
            ? payment
            : payment?.id||payment?.paymentId||null;
        if(state.paymentId){
          saveCurrent({paymentId:state.paymentId,payment});
          stop();
          setStatus("Payment created. Complete payment, then enter the code sent by email.");
          readStatus();
          state.timer=setInterval(readStatus,5000);
        }
      },
      getPaymentId:()=>state.paymentId,
      verify:doVerify,
      destroy(){
        stop();
        host.innerHTML="";
      }
    };
  }

  function mount(target,options={}){
    ensureConfig(options);
    const host=typeof target==="string"
      ? document.querySelector(target)
      : target;

    if(!host)throw new Error("SquashberryPay mount target was not found.");

    host.innerHTML="";
    host.style.fontFamily="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";

    const payButton=document.createElement("button");
    payButton.type="button";
    payButton.textContent=options.buttonText||"Pay with SquashberryPay";

    const codeHost=document.createElement("div");
    codeHost.style.marginTop="12px";

    host.append(payButton,codeHost);

    const codeBox=mountCodeBox(codeHost,options);

    const button=mountPayButton(payButton,Object.assign({},options,{
      onCreated:async payment=>{
        codeBox.setPayment(payment.payment);
        if(options.onCreated)await options.onCreated(payment);
      }
    }));

    return {
      button,
      codeBox,
      destroy(){
        button.destroy();
        codeBox.destroy();
        host.innerHTML="";
      }
    };
  }

  function bind(button,options){
    return mountPayButton(button,options);
  }

  const api={
    version:VERSION,
    url:API_BASE,
    init(overrides={}){
      config=Object.assign({},config,overrides);
      ensureConfig();
      return Object.assign({},config);
    },
    createPayment,
    getPayment,
    redeemPayment,
    cancelPayment,
    mount,
    mountPayButton,
    mountCodeBox,
    bind,
    checkoutUrl(slug){
      return API_BASE+"/checkout/"+encodeURIComponent(slug);
    },
    openPayment(payment){
      if(!payment?.payment_url)throw new Error("payment_url is required.");
      return makeModal(payment);
    }
  };

  global.SquashberryPay=api;
})(window);
