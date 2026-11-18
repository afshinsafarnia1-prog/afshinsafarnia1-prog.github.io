(() => {
  const ready=()=>{
    const root=document.getElementById("yadWorkshopPageList");
    const status=document.getElementById("yadWorkshopPageStatus");
    if(!root||!window.supabase?.createClient)return;
    const cfg=window.YAD_SUPABASE_CONFIG||{};
    if(!cfg.url||!cfg.anonKey){status.textContent="اتصال برنامهٔ کارگاه‌ها پیکربندی نشده است.";return;}
    const db=window.supabase.createClient(cfg.url,cfg.anonKey);
    const t=()=>window.YAD_I18N?.translations?.[document.documentElement.lang]||window.YAD_I18N?.translations?.fa||{};
    const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n;};
    async function load(){
      const tr=t();status.textContent=tr.workshopLoading||"در حال دریافت برنامهٔ کارگاه‌ها…";
      const {data,error}=await db.from("workshops")
        .select("id,slug,title,summary,description,presenter_name,presenter_bio,languages,topics,format,platform,venue,starts_at,ends_at,timezone,capacity,fee_amount,currency,registration_deadline")
        .eq("status","published").gt("starts_at",new Date().toISOString())
        .order("starts_at",{ascending:true}).limit(100);
      root.replaceChildren();
      if(error){status.textContent=tr.workshopLoadError||"دریافت برنامهٔ کارگاه‌ها با خطا روبه‌رو شد.";return;}
      if(!data?.length){status.textContent=tr.workshopEmpty||"در حال حاضر رویداد منتشرشده‌ای وجود ندارد.";return;}
      status.hidden=true;
      data.forEach(event=>{
        const card=el("article","workshop-card");
        const format=event.format==="online"?(tr.workshopOnline||"Online"):event.format==="hybrid"?(tr.workshopHybrid||"Hybrid"):(tr.workshopInPerson||"In person");
        card.append(el("span","workshop-format",format));
        card.append(el("h2","",event.title));
        if(event.summary)card.append(el("p","workshop-summary",event.summary));
        if(event.description)card.append(el("p","",event.description));
        card.append(el("p","workshop-meta",(tr.workshopPresenter||"ارائه‌دهنده")+": "+event.presenter_name));
        const when=new Intl.DateTimeFormat(document.documentElement.lang==="fa"?"fa-IR":document.documentElement.lang,{dateStyle:"full",timeStyle:"short",timeZone:event.timezone||undefined}).format(new Date(event.starts_at));
        card.append(el("p","workshop-meta",(tr.workshopDate||"زمان شروع")+": "+when+" · "+(event.timezone||"")));\n        if(event.ends_at){const endWhen=new Intl.DateTimeFormat(document.documentElement.lang==="fa"?"fa-IR":document.documentElement.lang,{dateStyle:"medium",timeStyle:"short",timeZone:event.timezone||undefined}).format(new Date(event.ends_at));card.append(el("p","workshop-meta","زمان پایان: "+endWhen));}\n        if(event.platform)card.append(el("p","workshop-meta","بستر برگزاری: "+event.platform));\n        if(event.registration_deadline){const deadline=new Intl.DateTimeFormat(document.documentElement.lang==="fa"?"fa-IR":document.documentElement.lang,{dateStyle:"medium",timeStyle:"short",timeZone:event.timezone||undefined}).format(new Date(event.registration_deadline));card.append(el("p","workshop-meta","مهلت ثبت‌نام: "+deadline));}
        card.append(el("p","workshop-meta",(tr.workshopLanguages||"زبان")+": "+(event.languages||[]).join("، ")));
        if(event.venue)card.append(el("p","workshop-meta",(tr.workshopVenue||"مکان")+": "+event.venue));
        const fee=Number(event.fee_amount)===0?(tr.workshopFree||"رایگان"):new Intl.NumberFormat(document.documentElement.lang==="fa"?"fa-IR":"en-GB").format(Number(event.fee_amount))+" "+event.currency;
        card.append(el("p","workshop-meta",(tr.workshopFee||"هزینه")+": "+fee));
        if(event.capacity)card.append(el("p","workshop-meta",(tr.workshopCapacity||"ظرفیت محدود")+": "+event.capacity));
        const register=el("a","button primary",tr.workshopRegister||"ثبت‌نام");
        register.href="client.html?workshop="+encodeURIComponent(event.id);
        card.append(register);root.append(card);
      });
    }
    load();
    document.addEventListener("yad:languagechange",load);
  };
  if(document.readyState==="complete")ready();else window.addEventListener("load",ready,{once:true});
})();