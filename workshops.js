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
        card.append(el("h2","user-content",event.title));
        if(event.summary)card.append(el("p","workshop-summary user-content",event.summary));
        if(event.description)card.append(el("p","user-content",event.description));
        const presenter=el("p","workshop-meta");presenter.append(document.createTextNode((tr.workshopPresenter||"ارائه‌دهنده")+": "),el("span","user-content",event.presenter_name||""));card.append(presenter);
        const when=new Intl.DateTimeFormat(document.documentElement.lang==="fa"?"fa-IR":document.documentElement.lang,{dateStyle:"full",timeStyle:"short",timeZone:event.timezone||undefined}).format(new Date(event.starts_at));
        card.append(el("p","workshop-meta",(tr.workshopDate||"زمان شروع")+": "+when+" · "+(event.timezone||"")));
        if(event.ends_at){const endWhen=new Intl.DateTimeFormat(document.documentElement.lang==="fa"?"fa-IR":document.documentElement.lang,{dateStyle:"medium",timeStyle:"short",timeZone:event.timezone||undefined}).format(new Date(event.ends_at));card.append(el("p","workshop-meta","زمان پایان: "+endWhen));}
        if(event.platform){const platform=el("p","workshop-meta");platform.append(document.createTextNode("بستر برگزاری: "),el("span","user-content",event.platform));card.append(platform);}
        if(event.registration_deadline){const deadline=new Intl.DateTimeFormat(document.documentElement.lang==="fa"?"fa-IR":document.documentElement.lang,{dateStyle:"medium",timeStyle:"short",timeZone:event.timezone||undefined}).format(new Date(event.registration_deadline));card.append(el("p","workshop-meta","مهلت ثبت‌نام: "+deadline));}
        card.append(el("p","workshop-meta",(tr.workshopLanguages||"زبان")+": "+(event.languages||[]).join("، ")));
        if(event.venue){const venue=el("p","workshop-meta");venue.append(document.createTextNode((tr.workshopVenue||"مکان")+": "),el("span","user-content",event.venue));card.append(venue);}
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