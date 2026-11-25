(() => {
  const ready = () => {
    const panel = document.getElementById("therapistPrivatePortal");
    if (!panel || !window.supabase?.createClient) return;
    const cfg = window.YAD_SUPABASE_CONFIG || {};
    if (!cfg.url || !cfg.anonKey) return;
    const db = window.supabase.createClient(cfg.url, cfg.anonKey);
    const sessionsRoot = document.getElementById("yadTherapistSessions");
    const slotsRoot = document.getElementById("yadTherapistAvailabilityList");
    const form = document.getElementById("yadTherapistAvailabilityForm");
    const status = document.getElementById("yadTherapistAvailabilityStatus");
    const start = document.getElementById("yadTherapistAvailabilityStart");
    const end = document.getElementById("yadTherapistAvailabilityEnd");
    const zone = document.getElementById("yadTherapistAvailabilityTimezone");
    const feeForm=document.getElementById("yadTherapistFeeForm");
    const feeStatus=document.getElementById("yadTherapistFeeStatus");
    const assessmentRoot=document.getElementById("yadTherapistAssessmentRequests");
    let activeUser = null;
    const node = (tag, cls, value) => {
      const el = document.createElement(tag);
      if (cls) el.className = cls;
      if (value != null) el.textContent = value;
      return el;
    };
    const setStatus = (value,bad=false) => {
      status.textContent=value;
      status.dataset.error=bad?"true":"false";
    };
    const date = (value,tz) => value ? new Intl.DateTimeFormat(document.documentElement.lang==="fa"?"fa-IR":"en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:tz||undefined}).format(new Date(value)) : "—";
    const localDateTimeInZone = (value,timeZone) => {
      const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value||"");
      if(!match) throw new Error("فرمت تاریخ و ساعت معتبر نیست.");
      const target=Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]),Number(match[4]),Number(match[5]));
      let guess=target;
      const formatter=new Intl.DateTimeFormat("en-GB",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
      for(let i=0;i<5;i++){
        const parts=Object.fromEntries(formatter.formatToParts(new Date(guess)).map(x=>[x.type,x.value]));
        const represented=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute));
        const delta=target-represented;
        if(!delta)break;
        guess+=delta;
      }
      const parts=Object.fromEntries(formatter.formatToParts(new Date(guess)).map(x=>[x.type,x.value]));
      const finalValue=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute));
      if(finalValue!==target)throw new Error("این ساعت در منطقهٔ زمانی انتخاب‌شده وجود ندارد؛ زمان دیگری انتخاب کنید.");
      return new Date(guess);
    };
    async function loadSessions(){
      const {data,error}=await db.rpc("therapist_list_appointments");
      sessionsRoot.replaceChildren();
      if(error){sessionsRoot.append(node("p","notice",error.message||"بارگذاری جلسات ناموفق بود."));return;}
      if(!data?.length){sessionsRoot.append(node("p","muted","هنوز جلسه‌ای برای این حساب ثبت نشده است. اگر پروفایل شما تأیید شده، از مدیریت بخواهید حساب را به پروفایل درمانگر متصل کند."));return;}
      data.forEach(item=>{
        const card=node("article","portal-card");
        card.append(node("h3","",item.client_name));
        card.append(node("p","muted",date(item.starts_at,item.timezone)+" تا "+date(item.ends_at,item.timezone)+" · "+item.timezone));
        card.append(node("span","status-chip",item.appointment_status));
        if(item.meeting_url){
          const link=node("a","button primary","ورود به جلسه");link.href=item.meeting_url;link.target="_blank";link.rel="noopener noreferrer";card.append(link);
          if(item.meeting_password)card.append(node("p","muted","رمز جلسه: "+item.meeting_password));
        }else if(item.appointment_status==="confirmed"){
          card.append(node("p","muted","لینک جلسه پس از ثبت توسط مدیریت در این قسمت نمایش داده می‌شود."));
        }
        sessionsRoot.append(card);
      });
    }
    async function loadSlots(){
      const {data,error}=await db.rpc("therapist_list_availability_slots");
      slotsRoot.replaceChildren();
      if(error){slotsRoot.append(node("p","notice",error.message||"بارگذاری زمان‌های آزاد ناموفق بود."));return;}
      if(!data?.length){slotsRoot.append(node("p","muted","زمان آزادی ثبت نشده است."));return;}
      data.forEach(slot=>{
        const card=node("article","portal-card");
        card.append(node("b","",date(slot.starts_at,slot.timezone)+" · "+slot.timezone));
        card.append(node("p","muted",date(slot.ends_at,slot.timezone)));
        const remove=node("button","button outline","حذف زمان آزاد");remove.type="button";
        remove.addEventListener("click",async()=>{
          if(!window.confirm("این زمان آزاد حذف شود؟"))return;
          remove.disabled=true;
          const {error:removeError}=await db.rpc("therapist_delete_availability_slot",{p_slot_id:slot.slot_id});
          if(removeError){remove.disabled=false;setStatus(removeError.message||"حذف زمان ناموفق بود.",true);return;}
          setStatus("زمان آزاد حذف شد.");
          await loadSlots();
        });
        card.append(remove);slotsRoot.append(card);
      });
    }
    async function loadAssessmentRequests(){
      if(!assessmentRoot)return;
      const {data,error}=await db.rpc("therapist_list_assessment_requests");
      assessmentRoot.replaceChildren();
      if(error){assessmentRoot.append(node("p","notice",error.message||"بارگذاری درخواست‌های ارزیابی ناموفق بود."));return;}
      if(!data?.length){assessmentRoot.append(node("p","muted","درخواست ارزیابی زمان‌بندی‌شده‌ای برای این حساب وجود ندارد."));return;}
      const {data:therapists, error:directoryError}=await db.from("therapists").select("id,display_name").eq("is_listed",true).not("verified_at","is",null).order("display_name");
      if(directoryError){assessmentRoot.append(node("p","notice","دریافت فهرست درمانگران پیشنهادی ناموفق بود."));return;}
      data.forEach(item=>{
        const card=node("article","portal-card");
        card.append(node("b","",item.client_name+" · "+(item.assessment_type==="STIPO"?"STIPO / STIPO-R":"SWAP-200")));
        card.append(node("p","muted",date(item.scheduled_at)+" · وضعیت: "+item.status));
        const textarea=document.createElement("textarea");textarea.rows=4;textarea.maxLength=5000;textarea.placeholder="جمع‌بندی و پیشنهاد بالینی برای انتخاب آگاهانه درمانگر (حداقل ۱۰ نویسه)";textarea.value=item.recommendations||"";
        const select=document.createElement("select");select.multiple=true;select.size=Math.min(6,Math.max(3,(therapists||[]).length));
        (therapists||[]).forEach(t=>{const option=new Option(t.display_name,t.id);if((item.recommended_therapist_ids||[]).includes(t.id))option.selected=true;select.add(option);});
        const save=node("button","button primary","ذخیره بازخورد و درمانگران پیشنهادی");save.type="button";
        save.addEventListener("click",async()=>{
          const ids=[...select.selectedOptions].map(x=>x.value);
          if(textarea.value.trim().length<10){setStatus("برای ثبت پیشنهاد، جمع‌بندی بالینی کافی وارد کنید.",true);return;}
          save.disabled=true;
          const {error:saveError}=await db.rpc("assessment_specialist_add_recommendations",{p_request_id:item.request_id,p_recommendations:textarea.value.trim(),p_recommended_therapist_ids:ids});
          save.disabled=false;
          if(saveError){setStatus(saveError.message||"ذخیره پیشنهادها ناموفق بود.",true);return;}
          setStatus("بازخورد و فهرست درمانگران پیشنهادی ذخیره شد.");
        });
        card.append(node("label","muted","بازخورد و توضیح بالینی"),textarea,node("label","muted","درمانگران پیشنهادی (انتخاب چندگانه)"),select,save);
        assessmentRoot.append(card);
      });
    }
    async function loadMyFees(){
      if(!feeForm)return;
      const {data,error}=await db.rpc("therapist_get_my_fees");
      if(error){feeStatus.textContent=error.message||"بارگذاری تعرفه‌ها ناموفق بود.";return;}
      const map=Object.fromEntries((data||[]).map(x=>[x.currency,x.amount]));
      document.getElementById("yadTherapistFeeIRR").value=map.IRR?Number(map.IRR)/10:"";
      document.getElementById("yadTherapistFeeEUR").value=map.EUR||"";
      document.getElementById("yadTherapistFeeUSD").value=map.USD||"";
      document.getElementById("yadTherapistFeeCAD").value=map.CAD||"";
    }
    feeForm?.addEventListener("submit",async event=>{
      event.preventDefault();
      if(!activeUser){feeStatus.textContent="ابتدا وارد حساب درمانگر شوید.";return;}
      const fields=[["IRR","yadTherapistFeeIRR",10],["EUR","yadTherapistFeeEUR",1],["USD","yadTherapistFeeUSD",1],["CAD","yadTherapistFeeCAD",1]];
      const values=fields.map(([currency,id,multiplier])=>({currency,id,multiplier,value:document.getElementById(id).value.trim()})).filter(x=>x.value!=="");
      if(!values.length){feeStatus.textContent="حداقل یک تعرفه وارد کنید.";return;}
      if(values.some(x=>!Number.isSafeInteger(Number(x.value))||Number(x.value)<=0)){feeStatus.textContent="همه مبالغ باید عدد صحیح و بیشتر از صفر باشند.";return;}
      
      const button=feeForm.querySelector('button[type="submit"]');button.disabled=true;feeStatus.textContent="در حال ذخیره تعرفه‌ها…";
      for(const item of values){
        const {error}=await db.rpc("therapist_set_my_fee",{p_currency:item.currency,p_amount:Number(item.value)*item.multiplier});
        if(error){button.disabled=false;feeStatus.textContent=error.message||"ذخیره یکی از تعرفه‌ها ناموفق بود.";return;}
      }
      button.disabled=false;feeStatus.textContent="تعرفه‌ها ذخیره شدند و در پروفایل عمومی شما نمایش داده می‌شوند.";
      await loadMyFees();
    });
    async function init(session){
      if(!session?.user||activeUser===session.user.id)return;
      activeUser=session.user.id;
      const {data:profile,error}=await db.from("profiles").select("role").eq("id",activeUser).maybeSingle();
      if(error||profile?.role!=="therapist"){
        panel.hidden=true;
        setStatus("این پنل فقط برای حساب درمانگر فعال است.",true);
        return;
      }
      zone.value=Intl.DateTimeFormat().resolvedOptions().timeZone||"Asia/Tehran";
      await Promise.all([loadSessions(),loadSlots(),loadMyFees(),loadAssessmentRequests()]);
    }
    form.addEventListener("submit",async event=>{
      event.preventDefault();
      if(!activeUser){setStatus("ابتدا وارد حساب درمانگر شوید.",true);return;}
      let starts,ends;
      try{
        starts=localDateTimeInZone(start.value,zone.value.trim());
        ends=localDateTimeInZone(end.value,zone.value.trim());
      }catch(error){setStatus(error.message,true);return;}
      if(ends.getTime()-starts.getTime()!==45*60000){setStatus("هر زمان آزاد باید دقیقاً ۴۵ دقیقه باشد.",true);return;}
      const button=form.querySelector('button[type="submit"]');button.disabled=true;
      const {error}=await db.rpc("therapist_create_availability_slot",{p_starts_at:starts.toISOString(),p_ends_at:ends.toISOString(),p_timezone:zone.value.trim()});
      button.disabled=false;
      if(error){setStatus(error.message==="availability_overlap"?"این زمان با یک زمان دیگر هم‌پوشانی دارد.":error.message||"ثبت زمان آزاد ناموفق بود.",true);return;}
      form.reset();zone.value=Intl.DateTimeFormat().resolvedOptions().timeZone||"Asia/Tehran";
      setStatus("زمان آزاد ۴۵ دقیقه‌ای ثبت شد.");
      await loadSlots();
    });
    db.auth.getSession().then(({data})=>init(data.session));
    db.auth.onAuthStateChange((_event,session)=>{
      if(session)init(session);
      else{activeUser=null;panel.hidden=true;sessionsRoot.replaceChildren(node("p","muted","برای مشاهدهٔ جلسات وارد حساب شوید."));}
    });
  };
  if(document.readyState==="complete")ready();
  else window.addEventListener("load",ready,{once:true});
})();
