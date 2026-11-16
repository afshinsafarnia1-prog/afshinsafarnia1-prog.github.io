(() => {
 const ready=()=>{
  const form=document.getElementById("yadAssessmentForm");
  if(!form||!window.supabase?.createClient)return;
  const cfg=window.YAD_SUPABASE_CONFIG||{};
  if(!cfg.url||!cfg.anonKey)return;
  const db=window.supabase.createClient(cfg.url,cfg.anonKey);
  const type=document.getElementById("yadAssessmentType");
  const currency=document.getElementById("yadAssessmentCurrency");
  const specialist=document.getElementById("yadAssessmentSpecialist");
  const fee=document.getElementById("yadAssessmentFee");
  const status=document.getElementById("yadAssessmentStatus");
  const requests=document.getElementById("yadAssessmentRequests");
  let catalog=[];
  let activeUser=null;
  const fmt=(amount,cur)=>new Intl.NumberFormat("fa-IR").format(cur==="IRR"?Number(amount)/10:Number(amount))+(cur==="IRR"?" تومان":" "+cur);
  const setStatus=(v,bad=false)=>{status.textContent=v;status.dataset.error=bad?"true":"false";};
  function refreshOptions(){
   const selected=specialist.value;
   const rows=catalog.filter(x=>x.assessment_type===type.value&&x.currency===currency.value);
   specialist.replaceChildren(new Option(rows.length?"متخصص ارزیابی را انتخاب کنید":"برای این نوع ارزیابی و ارز، متخصص یا تعرفه فعالی ثبت نشده است",""));
   rows.forEach(x=>specialist.add(new Option(x.specialist_name+(x.headline?" — "+x.headline:""),x.specialist_id)));
   if(rows.some(x=>x.specialist_id===selected))specialist.value=selected;
   updateFee();
  }
  function updateFee(){
   const row=catalog.find(x=>x.assessment_type===type.value&&x.currency===currency.value&&x.specialist_id===specialist.value);
   fee.textContent=row?"هزینه مستقل ارزیابی: "+fmt(row.amount,row.currency):"پس از انتخاب متخصص دارای تعرفه، هزینه نمایش داده می‌شود.";
  }
  async function loadCatalog(){
   const {data,error}=await db.rpc("get_public_assessment_catalog");
   if(error){setStatus("دریافت فهرست ارزیابی‌ها ممکن نشد؛ لطفاً بعداً تلاش کنید.",true);return;}
   catalog=data||[];
   refreshOptions();
   setStatus(catalog.length?"متخصصان ارزیابی تأییدشده و تعرفه‌های فعال نمایش داده شده‌اند.":"هنوز متخصص ارزیابی یا تعرفه فعالی برای رزرو ثبت نشده است.");
  }
  async function loadRequests(){
   if(!activeUser){requests.textContent="برای مشاهده درخواست‌ها وارد حساب مراجع شوید.";return;}
   const {data,error}=await db.rpc("client_list_assessment_requests");
   requests.replaceChildren();
   if(error){requests.textContent=error.message||"بارگذاری درخواست‌ها ناموفق بود.";return;}
   if(!data?.length){requests.textContent="هنوز درخواست ارزیابی ثبت نکرده‌اید.";return;}
   data.forEach(item=>{
    const card=document.createElement("article");card.className="portal-card";
    const title=document.createElement("b");title.textContent=(item.assessment_type==="STIPO"?"STIPO / STIPO-R":"SWAP-200")+" · "+item.specialist_name;
    const amount=document.createElement("p");amount.textContent=fmt(item.amount,item.currency)+" · وضعیت: "+item.status;
    card.append(title,amount);
    if(item.status==="awaiting_payment"){
     const hint=document.createElement("p");hint.textContent="هزینه این ارزیابی جداگانه است. اطلاعات پرداخت را از مدیریت یادسنتر دریافت کنید؛ پس از پرداخت، شماره پیگیری را ثبت کنید.";
     const input=document.createElement("input");input.maxLength=120;input.placeholder="شماره پیگیری پرداخت";
     const button=document.createElement("button");button.type="button";button.className="button primary";button.textContent="ارسال شماره پیگیری";
     button.addEventListener("click",async()=>{button.disabled=true;const {error}=await db.rpc("client_submit_assessment_payment_reference",{p_request_id:item.request_id,p_reference:input.value.trim()});button.disabled=false;if(error){setStatus(error.message||"ثبت شماره پیگیری ناموفق بود.",true);return;}setStatus("شماره پیگیری برای بررسی ارسال شد.");await loadRequests();});
     card.append(hint,input,button);
    }
    if(item.status==="payment_submitted")card.append(Object.assign(document.createElement("p"),{textContent:"شماره پیگیری ثبت شده و در انتظار بررسی مدیریت است."}));
    if(item.meeting_url){const a=document.createElement("a");a.href=item.meeting_url;a.target="_blank";a.rel="noopener noreferrer";a.className="button primary";a.textContent="ورود به جلسه ارزیابی";card.append(a);if(item.meeting_password)card.append(Object.assign(document.createElement("p"),{textContent:"رمز جلسه: "+item.meeting_password}));}
    if(item.recommendations){const rec=document.createElement("p");rec.textContent="پیشنهاد متخصص: "+item.recommendations;card.append(rec);}
    if(item.recommended_therapist_ids?.length){const p=document.createElement("p");p.textContent="شناسه پروفایل‌های پیشنهادی: "+item.recommended_therapist_ids.join("، ");card.append(p);}
    requests.append(card);
   });
  }
  form.addEventListener("submit",async e=>{
   e.preventDefault();
   if(!activeUser){setStatus("برای ثبت درخواست ابتدا وارد حساب مراجع شوید.",true);return;}
   const row=catalog.find(x=>x.assessment_type===type.value&&x.currency===currency.value&&x.specialist_id===specialist.value);
   if(!row){setStatus("برای انتخاب فعلی تعرفه فعالی وجود ندارد.",true);return;}
   const button=form.querySelector('button[type="submit"]');button.disabled=true;
   const {error}=await db.rpc("client_create_assessment_request",{p_assessment_type:type.value,p_specialist_id:specialist.value,p_currency:currency.value});
   button.disabled=false;
   if(error){setStatus(error.message||"ثبت درخواست ناموفق بود.",true);return;}
   setStatus("درخواست ارزیابی ثبت شد. هزینه آن جداگانه دریافت می‌شود؛ اطلاعات پرداخت را از مدیریت دریافت کنید.");
   await loadRequests();
  });
  type.addEventListener("change",refreshOptions);currency.addEventListener("change",refreshOptions);specialist.addEventListener("change",updateFee);
  db.auth.getSession().then(async({data})=>{activeUser=data.session?.user?.id||null;await loadCatalog();await loadRequests();});
  db.auth.onAuthStateChange(async(_event,session)=>{activeUser=session?.user?.id||null;await loadRequests();});
  loadCatalog();
 };
 if(document.readyState==="complete")ready();else window.addEventListener("load",ready,{once:true});
})();