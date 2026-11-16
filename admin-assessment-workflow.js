(() => {
 const ready=()=>{
  const form=document.getElementById("yadAssessmentFeeAdminForm");
  const root=document.getElementById("yadAdminAssessmentRequests");
  if(!form||!root||!window.supabase?.createClient)return;
  const cfg=window.YAD_SUPABASE_CONFIG||{};if(!cfg.url||!cfg.anonKey)return;
  const db=window.supabase.createClient(cfg.url,cfg.anonKey);
  const feeStatus=document.getElementById("yadAssessmentFeeAdminStatus");
  const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
  let authorized=false;
  async function checkAdmin(){
   const {data,error}=await db.auth.getSession();if(error||!data.session)return false;
   const {data:aal}=await db.auth.mfa.getAuthenticatorAssuranceLevel();
   const {data:profile}=await db.from("profiles").select("role").eq("id",data.session.user.id).maybeSingle();
   authorized=aal?.currentLevel==="aal2"&&profile?.role==="admin";return authorized;
  }
  async function loadFees(){
   const {data,error}=await db.rpc("admin_get_assessment_fees");if(error){feeStatus.textContent=error.message;return;}
   (data||[]).forEach(row=>{
    const id="fee"+row.assessment_type+row.currency;
    const input=document.getElementById(id);if(input)input.value=row.currency==="IRR"?Number(row.amount)/10:row.amount;
   });
   feeStatus.textContent="تعرفه‌های ثبت‌شده بارگذاری شدند. مبالغ خالی بدون تغییر باقی می‌مانند.";
  }
  form.addEventListener("submit",async e=>{
   e.preventDefault();if(!authorized){feeStatus.textContent="برای ذخیره، ورود مدیر با MFA لازم است.";return;}
   const items=[];
   for(const type of ["STIPO","SWAP"])for(const currency of ["IRR","EUR","USD","CAD"]){
    const input=document.getElementById("fee"+type+currency);const value=input?.value.trim()||"";
    if(value!=="")items.push({type,currency,amount:Number(value)*(currency==="IRR"?10:1)});
   }
   if(!items.length){feeStatus.textContent="حداقل یک مبلغ وارد کنید.";return;}
   if(items.some(x=>!Number.isSafeInteger(x.amount)||x.amount<=0)){feeStatus.textContent="مبالغ باید عدد صحیح و بیشتر از صفر باشند.";return;}
   const button=form.querySelector('button[type="submit"]');button.disabled=true;
   for(const item of items){const {error}=await db.rpc("admin_set_assessment_fee",{p_assessment_type:item.type,p_currency:item.currency,p_amount:item.amount,p_active:true});if(error){button.disabled=false;feeStatus.textContent=error.message;return;}}
   button.disabled=false;feeStatus.textContent="تعرفه‌های ارزیابی ذخیره شدند.";await loadFees();
  });
  async function loadRequests(){
   root.replaceChildren();if(!authorized){root.textContent="برای مشاهده، با حساب مدیر و ورود دومرحله‌ای وارد شوید.";return;}
   const {data,error}=await db.rpc("admin_list_assessment_requests");
   if(error){root.textContent=error.message||"بارگذاری درخواست‌ها ناموفق بود.";return;}
   if(!data?.length){root.textContent="درخواستی برای ارزیابی ثبت نشده است.";return;}
   data.forEach(item=>{
    const card=node("article","portal-card");
    card.append(node("b","",item.client_name+" · "+item.assessment_type+" · "+item.specialist_name));
    card.append(node("p","muted",new Intl.NumberFormat("fa-IR").format(item.currency==="IRR"?Number(item.amount)/10:Number(item.amount))+(item.currency==="IRR"?" تومان":" "+item.currency)+" · وضعیت: "+item.status));
    if(item.payment_reference)card.append(node("p","muted","شماره پیگیری: "+item.payment_reference));
    if(item.status==="payment_submitted"){
     const verify=node("button","button primary","تأیید دریافت وجه");verify.type="button";
     verify.addEventListener("click",async()=>{verify.disabled=true;const {error}=await db.rpc("admin_update_assessment_request",{p_request_id:item.request_id,p_status:"payment_verified"});if(error){verify.disabled=false;card.append(node("p","admin-error",error.message));return;}await loadRequests();});
     card.append(verify);
    }else if(item.status==="payment_verified"){
     const url=node("input");url.type="url";url.placeholder="لینک خصوصی Zoom یا Google Meet";
     const password=node("input");password.type="text";password.maxLength=120;password.placeholder="رمز جلسه (در صورت وجود)";
     const time=node("input");time.type="datetime-local";
     const save=node("button","button primary","ثبت زمان و لینک جلسه");save.type="button";
     save.addEventListener("click",async()=>{if(!url.value.trim()||!time.value){card.append(node("p","admin-error","لینک جلسه و زمان را وارد کنید."));return;}save.disabled=true;const {error}=await db.rpc("admin_update_assessment_request",{p_request_id:item.request_id,p_status:"scheduled",p_meeting_url:url.value.trim(),p_meeting_password:password.value.trim()||null,p_scheduled_at:new Date(time.value).toISOString()});if(error){save.disabled=false;card.append(node("p","admin-error",error.message));return;}await loadRequests();});
     card.append(url,password,time,save);
    }else if(item.status==="scheduled"){
     const done=node("button","button outline","ثبت پایان ارزیابی");done.type="button";
     done.addEventListener("click",async()=>{done.disabled=true;const {error}=await db.rpc("admin_update_assessment_request",{p_request_id:item.request_id,p_status:"completed"});if(error){done.disabled=false;card.append(node("p","admin-error",error.message));return;}await loadRequests();});
     card.append(done);
    }
    root.append(card);
   });
  }
  document.getElementById("yadRefreshAssessmentRequests")?.addEventListener("click",loadRequests);
  db.auth.getSession().then(async()=>{authorized=await checkAdmin();if(authorized){await loadFees();await loadRequests();}else{feeStatus.textContent="برای مدیریت تعرفه‌ها، ورود مدیر با MFA لازم است.";root.textContent="برای مشاهده، با حساب مدیر و ورود دومرحله‌ای وارد شوید.";}}); 
  db.auth.onAuthStateChange(async()=>{authorized=await checkAdmin();if(authorized){await loadFees();await loadRequests();}else{root.textContent="برای مشاهده، با حساب مدیر و ورود دومرحله‌ای وارد شوید.";}}); 
 };
 if(document.readyState==="complete")ready();else window.addEventListener("load",ready,{once:true});
})();