(()=>{const p=location.pathname;const prefix=p.includes("/articles/")?"../":"";const links=[["خانه","index.html","⌂"],["خدمات و درمانگران","index.html#services","✳"],["راهنمای پاسخ‌گو","assistant.html","؟"],["پنل مراجع","client.html","◉"],["مدیریت","admin.html","⚙"],["مقالات تحلیلی","articles/index.html","▤"],["قوانین سایت","rules.html","§"]];const aside=document.createElement("aside");aside.className="side-nav";aside.innerHTML='<a class="side-brand" href="'+prefix+'index.html"><span class="brandmark">ی</span><b>یادسنتر</b></a><small>منوی اصلی</small>'+links.map(([n,h,i])=>'<a href="'+prefix+h+'"><i>'+i+'</i>'+n+'</a>').join("")+'<div class="side-note">همراهی حرفه‌ای<br>با احترام به پیچیدگی انسان</div>';document.body.appendChild(aside);document.body.classList.add("with-sidebar");const css=document.createElement("style");css.textContent='.side-nav{position:fixed;z-index:30;right:0;top:0;bottom:0;width:235px;padding:24px 16px;background:#123f46;color:#eaf7f2;display:flex;flex-direction:column;gap:8px;box-shadow:-8px 0 30px #123f4610}.side-brand{display:flex;align-items:center;gap:10px;color:white;font-size:19px;margin-bottom:22px}.side-brand .brandmark{display:grid;place-items:center;background:#35c6b0;color:#123f46;width:42px;height:42px;border-radius:14px}.side-nav>small{color:#8fbab0;padding:0 10px;margin-bottom:5px}.side-nav>a:not(.side-brand){padding:10px;border-radius:11px;color:#e1f1eb;font-size:13px}.side-nav>a:hover{background:#ffffff18}.side-nav i{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:8px;background:#ffffff15;font-style:normal;margin-left:9px}.side-note{margin-top:auto;background:#ffffff12;padding:14px;border-radius:13px;color:#b8d9d0;font-size:11px}.with-sidebar{padding-right:235px}.portal-main{min-height:100vh;padding:65px 0;background:#fffdfa}.portal-wrap{width:min(980px,90%);margin:auto}.portal-wrap h1{font-size:clamp(30px,4vw,44px);color:#123f46;margin:10px 0}.portal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:28px 0}.portal-card{background:white;border:1px solid #e5ece8;border-radius:18px;padding:23px;box-shadow:0 12px 35px #123f4608}.portal-card b{color:#123f46}.portal-card p{font-size:13px;color:#687b7c}.status-pending{font-size:11px;color:#9a6d31;background:#fff4dc;border-radius:20px;padding:5px 10px}.bank-card{margin:28px 0}.bank-card label{display:block;margin-top:14px;font-size:12px;color:#687b7c}.bank-card input,.bank-card select{display:block;width:100%;padding:11px;border:1px solid #e5ece8;border-radius:10px;margin-top:5px;background:#f5f6f5}.legal h2{color:#123f46;margin-top:30px}.legal p{line-height:2.2;color:#52696a}.assistant-shell{background:white;border:1px solid #e5ece8;border-radius:20px;padding:20px;box-shadow:0 20px 50px #123f4610;margin:28px 0}.assistant-messages{min-height:180px;max-height:340px;overflow:auto;background:#f4faf7;border-radius:14px;padding:15px}.bot-msg,.user-msg{max-width:85%;padding:12px 15px;border-radius:14px;margin:8px 0;font-size:13px;line-height:2}.bot-msg{background:white;color:#345052;border:1px solid #e4efea}.user-msg{background:#123f46;color:white;margin-right:auto}.quick-questions{display:flex;gap:8px;flex-wrap:wrap;margin:15px 0}.quick-questions button{border:1px solid #dcebe5;background:#f7fbf9;color:#17685f;padding:8px 12px;border-radius:20px;font:inherit;font-size:11px;cursor:pointer}.assistant-form{display:flex;gap:9px}.assistant-form input{flex:1;min-width:0;border:1px solid #dce8e3;border-radius:12px;padding:12px;font:inherit}.assistant-form .button{border:0;cursor:pointer}.with-sidebar footer{margin-right:0}@media(max-width:760px){.side-nav{width:64px;padding:12px 7px;align-items:center}.side-brand b,.side-nav>small,.side-nav>a:not(.side-brand){font-size:0}.side-nav>a:not(.side-brand){width:48px;height:45px;padding:8px;text-align:center}.side-nav i{font-size:17px;margin:0}.side-note{display:none}.with-sidebar{padding-right:64px}.portal-main{padding:35px 0}.portal-grid{grid-template-columns:1fr}.assistant-form{flex-wrap:wrap}.assistant-form input{flex-basis:100%}}';document.head.appendChild(css);const answers=[[/شروع|درمان|جلسه/,'برای شروع، ابتدا حوزهٔ نیاز و زبان گفت‌وگو را مشخص کن و اطلاعات حرفه‌ای درمانگر را بخوان. جلسهٔ اول معمولاً فرصتی برای شناخت مسئله و توافق دربارهٔ چارچوب کار است.'],[/روان.?پزشک|روان.?شناس/,'روان‌شناس در ارزیابی و مداخلات روان‌شناختی فعالیت می‌کند؛ روان‌پزشک پزشک متخصص است و می‌تواند ارزیابی پزشکی و در صورت نیاز دارودرمانی انجام دهد. انتخاب مناسب به نیاز فرد بستگی دارد.'],[/انتخاب|درمانگر/,'به تحصیلات، مجوز معتبر، تجربه، حوزهٔ تخصص، رویکرد درمانی، زبان و امکان ارتباط توجه کن. هیچ عنوان یا امتیازی به‌تنهایی تضمین‌کنندهٔ تناسب درمانگر نیست.'],[/نوبت|رزرو/,'سامانهٔ رزرو آنلاین هنوز فعال نشده است. پس از تکمیل زیرساخت امن، زمان‌های آزاد و شرایط پرداخت نمایش داده می‌شود.'],[/قانون|حریم|محرمان/,'قوانین و اصول حریم خصوصی را از بخش «قوانین سایت» در منوی کناری بخوان.'],[/اضطرار|خودکشی|آسیب|خطر/,'اگر خطر فوری برای خودت یا فرد دیگری وجود دارد، همین حالا با اورژانس یا خدمات بحران محل زندگی تماس بگیر؛ این راهنما جایگزین کمک فوری نیست.']];function reply(q){const box=document.getElementById("assistantMessages");if(!box)return;const u=document.createElement("div");u.className="user-msg";u.textContent=q;box.append(u);const match=answers.find(([re])=>re.test(q));const b=document.createElement("div");b.className="bot-msg";b.textContent=match?match[1]:"می‌توانم درباره خدمات، انتخاب درمانگر، روند شروع درمان و قوانین سایت راهنمایی عمومی بدهم. برای پرسش‌های بالینی شخصی، ارزیابی متخصص لازم است.";box.append(b);box.scrollTop=box.scrollHeight;}document.getElementById("assistantForm")?.addEventListener("submit",e=>{e.preventDefault();const input=document.getElementById("assistantInput");if(input.value.trim()){reply(input.value.trim());input.value="";}});document.querySelectorAll("[data-q]").forEach(b=>b.addEventListener("click",()=>reply(b.dataset.q)));})();
/* YAD Center: language foundation + secure admin data views */
(()=> {
  const translations = {
    fa: {
      menu:"منوی اصلی", links:["خانه","خدمات و درمانگران","راهنمای پاسخ‌گو","پنل مراجع","مدیریت","مقالات تحلیلی","قوانین سایت"],
      language:"زبان", adminEyebrow:"مدیریت متمرکز یادسنتر",adminTitle:"پنل مدیریت یادسنتر",
      adminLead:"مدیریت درمانگران، مراجعان، نوبت‌ها و پرداخت‌ها از طریق مدیریت مرکزی یادسنتر انجام می‌شود.",
      opsTitle:"عملیات و وضعیت سامانه",loading:"در حال اتصال امن…",appointmentsTitle:"نوبت‌ها",
      appointmentsHelp:"فهرست نوبت‌های ثبت‌شده در سامانه.",paymentsTitle:"پرداخت‌ها",
      paymentsHelp:"بررسی رسیدهای پرداخت و ثبت نتیجه.",refresh:"به‌روزرسانی",client:"مراجع",phone:"تلفن",
      therapist:"درمانگر",sessionTime:"زمان جلسه",market:"بازار",status:"وضعیت",paymentsReviewHelp:"رسیدهای انتقال دستی را بررسی و تأیید یا رد کن.",
      amount:"مبلغ",reference:"شماره پیگیری",createdAt:"تاریخ ثبت",action:"اقدام",
      therapistManagement:"مدیریت درمانگران",therapistWorkflow:"درمانگر اطلاعات، عکس و مدارک حرفه‌ای خود را فقط برای مدیر ارسال می‌کند. مدیر پس از بررسی، پروفایل عمومی را ثبت و منتشر می‌کند. ثبت و بارگذاری امن مدارک در پنل مدیریت هنوز در حال تکمیل است؛ تا آن زمان اطلاعات حساس را در این صفحه یا پیام عمومی وارد نکن.",
      therapistSecurity:"حساب درمانگر و امکان ورود مستقل برای او در این مدل فعال نیست. تأیید هویت و انتشار پروفایل فقط با تصمیم مدیر انجام می‌شود.",
      financialRules:"قواعد مالی یادسنتر",financialHelp:"پرداخت ابتدا به یادسنتر انجام می‌شود. پس از تأیید واقعی دریافت وجه، مدیر اتصال مراجع به درمانگر و ثبت سهم هر طرف را انجام می‌دهد. تأیید در این پنل صرفاً وضعیت داخلی را تغییر می‌دهد و جایگزین تأیید بانکی نیست.",workflowWarning:"هشدار نسخهٔ آزمایشی: گردش فعلی دیتابیس هنوز درمانگر را پیش از پرداخت به نوبت متصل می‌کند و تأیید پرداخت، نوبت را قطعی می‌کند. تا اصلاح این فرایند، برای مراجع واقعی از دکمه‌های تأیید یا رد استفاده نکن.",
      noRows:"موردی برای نمایش وجود ندارد.",approve:"تأیید پرداخت",reject:"رد پرداخت",reviewConfirm:"آیا از ثبت این تصمیم مطمئنی؟",
      approved:"پرداخت تأیید شد.",rejected:"پرداخت رد شد.",refreshError:"دریافت اطلاعات ناموفق بود. دوباره تلاش کن.",
      noAdmin:"این بخش فقط برای حساب مدیر در دسترس است.",connecting:"در حال اتصال به اطلاعات سامانه…",
      requested:"در انتظار پرداخت",confirmed:"تأییدشده",completed:"انجام‌شده",cancelled:"لغوشده",
      pending:"در انتظار بررسی",paid:"پرداخت‌شده",failed:"ناموفق",refunded:"بازپرداخت‌شده",
      iran:"ایران",international:"بین‌المللی",unknown:"نامشخص",reviewing:"در حال ثبت…",genericError:"عملیات انجام نشد."
    },
    en: {
      menu:"Main menu", links:["Home","Services & therapists","Help guide","Client area","Admin","Articles","Site policies"],
      language:"Language", adminEyebrow:"Central YAD Center administration",adminTitle:"YAD Center Admin",
      adminLead:"Therapists, clients, appointments and payments are managed centrally by YAD Center.",
      opsTitle:"Operations and system status",loading:"Connecting securely…",appointmentsTitle:"Appointments",
      appointmentsHelp:"Appointments recorded in the platform.",paymentsTitle:"Payments",
      paymentsHelp:"Review payment references and record the decision.",refresh:"Refresh",client:"Client",phone:"Phone",
      therapist:"Therapist",sessionTime:"Session time",market:"Market",status:"Status",paymentsReviewHelp:"Review manual-transfer references and approve or reject them.",
      amount:"Amount",reference:"Payment reference",createdAt:"Created at",action:"Action",
      therapistManagement:"Therapist management",therapistWorkflow:"Therapists send their profile details, photo and professional documents to the administrator only. After verification, the administrator creates and publishes the public profile. Secure document intake and profile editing are still being built; do not enter sensitive documents on this page or in public messages.",
      therapistSecurity:"Therapists do not receive independent self-registration or profile-publishing access in this model. Verification and publication remain administrator-controlled.",
      financialRules:"YAD Center payment workflow",financialHelp:"Clients pay YAD Center first. After the funds are actually verified, the administrator assigns the client to a therapist and records each party’s share. This panel updates the internal payment status only; it does not verify a bank transfer.",workflowWarning:"Staging warning: the current database flow assigns a therapist before payment, and payment approval confirms the appointment. Do not use the approve/reject buttons for real clients until this workflow is redesigned.",
      noRows:"There are no records to display.",approve:"Approve payment",reject:"Reject payment",reviewConfirm:"Are you sure you want to record this decision?",
      approved:"Payment approved.",rejected:"Payment rejected.",refreshError:"Could not load the data. Please try again.",
      noAdmin:"This area is available to administrators only.",connecting:"Connecting to platform data…",
      requested:"Awaiting payment",confirmed:"Confirmed",completed:"Completed",cancelled:"Cancelled",
      pending:"Pending review",paid:"Paid",failed:"Failed",refunded:"Refunded",
      iran:"Iran",international:"International",unknown:"Unknown",reviewing:"Saving…",genericError:"The action could not be completed."
    }
  };
  const pageText = (lang) => {
    const t=translations[lang]||translations.fa;
    document.documentElement.lang=lang;
    document.documentElement.dir=lang==="fa"?"rtl":"ltr";
    document.querySelectorAll("[data-i18n]").forEach(el=>{
      const key=el.getAttribute("data-i18n");
      if(t[key]) el.textContent=t[key];
    });
    const aside=document.querySelector(".side-nav");
    if(aside){
      const small=aside.querySelector("small"); if(small) small.textContent=t.menu;
      aside.querySelectorAll("a:not(.side-brand)").forEach((a,i)=>{
        const icon=a.querySelector("i"); const label=t.links[i];
        if(label){a.textContent="";if(icon)a.append(icon);a.append(document.createTextNode(label));}
      });
      const note=aside.querySelector(".side-note");
      if(note) note.textContent=lang==="en"?"Professional support, respecting human complexity":"همراهی حرفه‌ای با احترام به پیچیدگی انسان";
    }
  };
  const aside=document.querySelector(".side-nav");
  if(aside && /(?:admin|client|therapist)\.html$/.test(location.pathname) && !document.getElementById("yadLanguagePicker")){
    const wrap=document.createElement("label");
    wrap.className="yad-language-switch";
    wrap.textContent="🌐 ";
    const select=document.createElement("select");
    select.id="yadLanguagePicker";
    select.setAttribute("aria-label","Language");
    [["fa","فارسی"],["en","English"]].forEach(([v,label])=>{
      const option=document.createElement("option");option.value=v;option.textContent=label;select.append(option);
    });
    wrap.append(select);
    const note=aside.querySelector(".side-note");
    aside.insertBefore(wrap,note||null);
    const saved=(()=>{try{return localStorage.getItem("yad-language")==="en"?"en":"fa";}catch(_){return "fa";}})();
    select.value=saved;pageText(saved);
    select.addEventListener("change",()=>{
      const lang=select.value;pageText(lang);
      try{localStorage.setItem("yad-language",lang);}catch(_){}
    });
    const style=document.createElement("style");
    style.textContent=".yad-language-switch{display:flex;align-items:center;gap:7px;padding:10px 8px;margin-top:8px;color:#d7eeea;font-size:12px}.yad-language-switch select{min-width:0;width:100%;padding:7px;border:1px solid #ffffff35;border-radius:9px;background:#174c52;color:white;font:inherit}.side-nav{overflow-y:auto}";
    document.head.append(style);
  }
  const adminPage=document.getElementById("yadAppointmentsBody");
  if(!adminPage) return;
  const start=async()=>{
    const status=document.getElementById("yadAdminStatus");
    const t=()=>translations[document.documentElement.lang]||translations.fa;
    const setStatus=(msg,bad=false)=>{status.textContent=msg;status.classList.toggle("admin-error",bad);};
    const config=window.YAD_SUPABASE_CONFIG||{};
    if(!window.supabase?.createClient||!config.url||!config.anonKey){setStatus(t().genericError,true);return;}
    const db=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    setStatus(t().connecting);
    const {data:sessionData,error:sessionError}=await db.auth.getSession();
    if(sessionError||!sessionData.session){setStatus(t().noAdmin,true);return;}
    const {data:profile,error:profileError}=await db.from("profiles").select("role").eq("id",sessionData.session.user.id).maybeSingle();
    if(profileError||profile?.role!=="admin"){setStatus(t().noAdmin,true);return;}
    const formatDate=(value)=>value?new Intl.DateTimeFormat(document.documentElement.lang==="fa"?"fa-IR":"en-GB",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value)):t().unknown;
    const formatAmount=(amount,currency)=>new Intl.NumberFormat(document.documentElement.lang==="fa"?"fa-IR":"en-GB").format(Number(amount||0))+" "+(currency||"");
    const makeCell=(row,value)=>{const td=document.createElement("td");td.textContent=value??"—";row.append(td);return td;};
    async function loadAppointments(){
      const body=document.getElementById("yadAppointmentsBody");body.replaceChildren();
      const {data,error}=await db.rpc("admin_list_appointments",{p_limit:50,p_offset:0});
      if(error){const tr=document.createElement("tr");makeCell(tr,t().refreshError);body.append(tr);setStatus(t().refreshError,true);return;}
      document.getElementById("yadAppointmentCount").textContent=String(data?.length||0);
      if(!data?.length){const tr=document.createElement("tr");const td=makeCell(tr,t().noRows);td.colSpan=6;body.append(tr);return;}
      data.forEach(item=>{
        const tr=document.createElement("tr");
        makeCell(tr,item.client_name);makeCell(tr,item.client_phone);
        makeCell(tr,item.therapist_name);makeCell(tr,formatDate(item.starts_at));
        makeCell(tr,t()[item.market]||item.market);makeCell(tr,t()[item.appointment_status]||item.appointment_status);
        body.append(tr);
      });
    }
    async function loadPayments(){
      const body=document.getElementById("yadPaymentsBody");body.replaceChildren();
      const {data,error}=await db.rpc("admin_list_payments",{p_limit:50,p_offset:0});
      if(error){const tr=document.createElement("tr");const td=makeCell(tr,t().refreshError);td.colSpan=6;body.append(tr);setStatus(t().refreshError,true);return;}
      document.getElementById("yadPaymentCount").textContent=String(data?.length||0);
      if(!data?.length){const tr=document.createElement("tr");const td=makeCell(tr,t().noRows);td.colSpan=6;body.append(tr);return;}
      data.forEach(item=>{
        const tr=document.createElement("tr");
        makeCell(tr,item.client_name);makeCell(tr,formatAmount(item.amount,item.currency));
        makeCell(tr,item.provider_reference);makeCell(tr,formatDate(item.created_at));
        makeCell(tr,t()[item.payment_status]||item.payment_status);
        const td=document.createElement("td");
        if(item.payment_status==="pending"&&item.provider_reference){
          const actions=document.createElement("div");actions.className="admin-actions";
          [[true,t().approve],[false,t().reject]].forEach(([approve,label])=>{
            const button=document.createElement("button");button.type="button";button.className="button "+(approve?"primary":"outline");button.textContent=label;
            button.addEventListener("click",async()=>{
              if(!window.confirm(t().reviewConfirm))return;
              button.disabled=true;button.textContent=t().reviewing;
              const {error:reviewError}=await db.rpc("admin_review_manual_payment",{p_payment_id:item.payment_id,p_approve:approve});
              if(reviewError){button.disabled=false;button.textContent=label;setStatus(t().genericError,true);return;}
              setStatus(approve?t().approved:t().rejected);
              await Promise.all([loadPayments(),loadAppointments()]);
            });
            actions.append(button);
          });
          td.append(actions);
        }else{td.textContent="—";}
        tr.append(td);body.append(tr);
      });
    }
    document.getElementById("yadRefreshAppointments")?.addEventListener("click",loadAppointments);
    document.getElementById("yadRefreshPayments")?.addEventListener("click",loadPayments);
    await Promise.all([loadAppointments(),loadPayments()]);
    setStatus(t().connecting);
  };
  window.addEventListener("load",start,{once:true});if(document.readyState==="complete")start();
})();
