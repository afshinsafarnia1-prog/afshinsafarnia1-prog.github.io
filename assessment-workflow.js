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
  let policyVersion="";
  const msg=key=>window.YAD_I18N?.translations?.[document.documentElement.lang]?.[key]||window.YAD_I18N?.translations?.fa?.[key]||key;
  const fmt=(amount,cur)=>new Intl.NumberFormat(document.documentElement.lang||"fa").format(cur==="IRR"?Number(amount)/10:Number(amount))+(cur==="IRR"?" تومان":" "+cur);
  const setStatus=(v,bad=false)=>{status.textContent=v;status.dataset.error=bad?"true":"false";};
  function refreshOptions(){
   const selected=specialist.value;
   const rows=catalog.filter(x=>x.assessment_type===type.value&&x.currency===currency.value);
   specialist.replaceChildren(new Option(rows.length?msg("assessmentSelectSpecialist"):msg("assessmentNoSpecialist"),""));
   rows.forEach(x=>specialist.add(new Option(x.specialist_name+(x.headline?" — "+x.headline:""),x.specialist_id)));
   if(rows.some(x=>x.specialist_id===selected))specialist.value=selected;
   updateFee();
  }
  function updateFee(){
   const row=catalog.find(x=>x.assessment_type===type.value&&x.currency===currency.value&&x.specialist_id===specialist.value);
   fee.textContent=row?msg("assessmentFeePrefix")+fmt(row.amount,row.currency):msg("assessmentFeeAfterSelect");
  }
  async function loadCatalog(){
   const {data:settings,error:settingsError}=await db.rpc("get_public_site_settings");
   if(settingsError){setStatus("وضعیت پذیرش خدمات قابل تأیید نیست.",true);return;}
   policyVersion=settings?.client_policy_version||"";
   const {data,error}=await db.rpc("get_public_assessment_catalog");
   if(error){setStatus(msg("assessmentCatalogError"),true);return;}
   catalog=data||[];
   refreshOptions();
   setStatus(catalog.length?msg("assessmentCatalogReady"):msg("assessmentCatalogEmpty"));
  }
  async function loadRequests(){
   if(!activeUser){requests.textContent=msg("assessmentLoginRequired");return;}
   const {data,error}=await db.rpc("client_list_assessment_requests");
   requests.replaceChildren();
   if(error){requests.textContent=error.message||msg("assessmentHistoryError");return;}
   if(!data?.length){requests.textContent=msg("assessmentHistoryEmpty");return;}
   for(const item of data){
    const card=document.createElement("article");card.className="portal-card";
    const title=document.createElement("b");title.textContent=(item.assessment_type==="STIPO"?"STIPO / STIPO-R":"SWAP-200")+" · "+item.specialist_name;
    const amount=document.createElement("p");amount.textContent=fmt(item.amount,item.currency)+" · وضعیت: "+item.status;
    card.append(title,amount);
    if(item.status==="awaiting_payment"){
     const hint=document.createElement("p");hint.textContent=msg("assessmentPaymentHelp");
     const input=document.createElement("input");input.maxLength=120;input.placeholder=msg("assessmentReferencePlaceholder");
     const button=document.createElement("button");button.type="button";button.className="button primary";button.textContent=msg("assessmentSendReference");
     button.addEventListener("click",async()=>{button.disabled=true;const {error}=await db.rpc("client_submit_assessment_payment_reference",{p_request_id:item.request_id,p_reference:input.value.trim()});button.disabled=false;if(error){setStatus(error.message||"ثبت شماره پیگیری ناموفق بود.",true);return;}setStatus(msg("assessmentReferenceSent"));await loadRequests();});
     card.append(hint,input,button);
    }
    if(item.status==="payment_submitted")card.append(Object.assign(document.createElement("p"),{textContent:msg("assessmentPaymentReview")}));
    if(item.meeting_url){const a=document.createElement("a");a.href=item.meeting_url;a.target="_blank";a.rel="noopener noreferrer";a.className="button primary";a.textContent=msg("assessmentJoinMeeting");card.append(a);if(item.meeting_password)card.append(Object.assign(document.createElement("p"),{textContent:msg("assessmentPasswordLabel")+item.meeting_password}));}
    if(item.recommendations){const rec=document.createElement("p");rec.textContent=msg("assessmentRecommendationLabel")+item.recommendations;card.append(rec);}
    if(item.recommended_therapist_ids?.length){
     const {data:recommended}=await db.from("therapists").select("id,display_name").in("id",item.recommended_therapist_ids).eq("is_listed",true).not("verified_at","is",null);
     if(recommended?.length){const wrap=document.createElement("div");wrap.append(Object.assign(document.createElement("b"),{textContent:msg("assessmentRecommendedTherapists")}));recommended.forEach(t=>{const a=document.createElement("a");a.href="therapist-profile.html?id="+encodeURIComponent(t.id);a.textContent=t.display_name;a.className="button outline";wrap.append(a);});card.append(wrap);}
    }
    requests.append(card);
   }
  }
  form.addEventListener("submit",async e=>{
   e.preventDefault();
   if(!activeUser){setStatus(msg("assessmentLoginRequired"),true);return;}
   if(!document.getElementById("yadAssessmentAdultConfirm").checked){setStatus(msg("assessmentAdultRequired"),true);return;}
   if(!document.getElementById("yadAssessmentConsent").checked){setStatus(msg("assessmentConsentRequired"),true);return;}
   if(!policyVersion||/draft|test|preview/i.test(policyVersion)){setStatus(msg("assessmentPolicyUnavailable"),true);return;}
   const row=catalog.find(x=>x.assessment_type===type.value&&x.currency===currency.value&&x.specialist_id===specialist.value);
   if(!row){setStatus(msg("assessmentNoFeeSelected"),true);return;}
   const button=form.querySelector('button[type="submit"]');button.disabled=true;
   const {error}=await db.rpc("client_create_assessment_request",{p_assessment_type:type.value,p_specialist_id:specialist.value,p_currency:currency.value,p_policy_version:policyVersion,p_adult_confirmation:true});
   button.disabled=false;
   if(error){const raw=error.message||"";setStatus(raw.includes("client_intake_paused")?"پذیرش خدمات هنوز فعال نشده است.":raw.includes("current_policy_version_required")?"نسخه نهایی قوانین هنوز فعال نشده است.":raw.includes("assessment_fee_not_configured")?"تعرفه این ارزیابی هنوز ثبت نشده است.":raw||"ثبت درخواست ناموفق بود.",true);return;}
   setStatus(msg("assessmentRequestCreated"));
   await loadRequests();
  });
  type.addEventListener("change",refreshOptions);currency.addEventListener("change",refreshOptions);specialist.addEventListener("change",updateFee);
  db.auth.getSession().then(async({data})=>{activeUser=data.session?.user?.id||null;await loadCatalog();await loadRequests();});
  db.auth.onAuthStateChange(async(_event,session)=>{activeUser=session?.user?.id||null;await loadRequests();});
 };
 if(document.readyState==="complete")ready();else window.addEventListener("load",ready,{once:true});
})();