(() => {
  const menu=document.getElementById("menuToggle");
  const nav=document.getElementById("mainNav");
  menu?.addEventListener("click",()=>{
    const open=nav.classList.toggle("open");
    menu.setAttribute("aria-expanded",String(open));
  });
  nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>nav.classList.remove("open")));

  const config=window.YAD_SUPABASE_CONFIG||{};
  let db=null, allTherapists=[], allPrices=[], publicContacts={};
  if(window.supabase?.createClient && config.url && config.anonKey){
    db=window.supabase.createClient(config.url,config.anonKey);
  }
  const directory=document.getElementById("therapistDirectory");
  const notice=document.getElementById("directoryNotice");
  const languageNames={fa:"فارسی",ku:"کوردی",en:"English",tr:"Türkçe",ar:"العربية",es:"Español",de:"Deutsch",fr:"Français"};
  const i18n=()=>window.YAD_I18N?.translations?.[document.documentElement.lang]||window.YAD_I18N?.translations?.fa||{};
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;};

  function renderDirectory(items){
    if(!directory)return;
    directory.replaceChildren();
    if(!items.length){
      directory.append(el("p","directory-empty",i18n().directoryEmpty||"در حال حاضر درمانگر تأییدشده‌ای برای نمایش وجود ندارد."));
      return;
    }
    items.forEach(t=>{
      const card=el("article","therapist-card");
      if(t.photo_path && db){
        const {data}=db.storage.from("therapist-photos").getPublicUrl(t.photo_path);
        if(data?.publicUrl){const img=el("img","therapist-photo");img.src=data.publicUrl;img.alt="تصویر "+t.display_name;img.loading="lazy";card.append(img);}
      } else card.append(el("div","therapist-photo therapist-placeholder","ی"));
      const body=el("div","therapist-card-body");
      body.append(el("h3","",t.display_name||""));
      if(t.headline)body.append(el("p","therapist-headline",t.headline));
      const tags=el("div","therapist-tags");
      (t.specialties||[]).slice(0,4).forEach(x=>tags.append(el("span","",x)));
      (t.languages||[]).forEach(code=>tags.append(el("span","language-tag",languageNames[code]||code)));
      body.append(tags);
      const market=document.getElementById("marketSelect")?.value||"iran";
      const currency=market==="iran"?"IRR":(document.getElementById("internationalCurrency")?.value||"EUR");
      const chosen=allPrices.find(x=>x.market===market&&x.currency===currency);
      const priceText=chosen?new Intl.NumberFormat(document.documentElement.lang==="fa"?"fa-IR":"en-GB").format(chosen.currency==="IRR"?Number(chosen.amount)/10:Number(chosen.amount))+(chosen.currency==="IRR"?" تومان":" "+chosen.currency):"تعرفه در حال تنظیم است";
      const meta=el("p","therapist-meta","۴۵ دقیقه · "+priceText);
      body.append(meta);
      const link=el("a","button primary",i18n().chooseTherapist||"مشاهده و انتخاب");
      link.href="client.html?therapist="+encodeURIComponent(t.id);
      body.append(link);
      card.append(body);
      directory.append(card);
    });
  }

  async function loadDirectory(){
    if(!directory)return;
    if(!db){directory.textContent="اتصال فهرست درمانگران در دسترس نیست.";return;}
    directory.textContent="در حال دریافت فهرست درمانگران…";
    const {data,error}=await db.from("therapists")
      .select("id,public_slug,display_name,headline,biography,qualifications,specialties,languages,modalities,session_duration_minutes,fee_amount,fee_currency,photo_path")
      .eq("is_listed",true).not("verified_at","is",null)
      .order("display_name",{ascending:true});
    if(error){directory.textContent="دریافت فهرست درمانگران با خطا روبه‌رو شد. لطفاً بعداً دوباره تلاش کنید.";return;}
    allTherapists=data||[];
    const {data:settings,error:settingsError}=await db.rpc("get_public_site_settings");
    if(settingsError){directory.textContent="دریافت تعرفه‌های مرکزی با خطا روبه‌رو شد.";return;}
    allPrices=settings?.tariffs||[];
    publicContacts=settings?.contacts||{};
    renderPublicTariffs();
    renderPublicContacts();
    filterDirectory();
    if(notice)notice.textContent=allTherapists.length
      ?"پروفایل‌های زیر توسط مدیریت یادسنتر بررسی و برای نمایش تأیید شده‌اند."
      :"فهرست درمانگران پس از تأیید مدارک و مجوزها منتشر می‌شود؛ هیچ پروفایل تأییدنشده‌ای نمایش داده نمی‌شود.";
  }

  function renderPublicTariffs(){
    const target=document.getElementById("yadPublicTariffs");if(!target)return;
    target.replaceChildren();
    const labels=[["iran","IRR","تعرفه داخل ایران"],["international","EUR","تعرفه بین‌المللی (یورو)"],["international","USD","تعرفه بین‌المللی (دلار)"]];
    labels.forEach(([market,currency,label])=>{
      const item=allPrices.find(x=>x.market===market&&x.currency===currency);
      const card=el("div","tariff-item");
      card.append(el("b","",label));
      card.append(el("strong","",item?new Intl.NumberFormat("fa-IR").format(currency==="IRR"?Number(item.amount)/10:Number(item.amount))+(currency==="IRR"?" تومان":" "+currency):"به‌زودی"));
      card.append(el("small","","جلسه ۴۵ دقیقه‌ای"));
      target.append(card);
    });
    const updated=document.getElementById("yadTariffUpdated");
    const latest=allPrices.map(x=>new Date(x.effective_from)).sort((a,b)=>b-a)[0];
    if(updated)updated.textContent=latest?"آخرین به‌روزرسانی: "+latest.toLocaleDateString(document.documentElement.lang==="fa"?"fa-IR":"en-GB"):"تعرفه‌ها به‌زودی اعلام می‌شوند.";
  }
  function renderPublicContacts(){
    const target=document.getElementById("yadPublicContacts");if(!target)return;
    target.replaceChildren();
    const links=[
      ["whatsapp_number","واتساپ",v=>"https://wa.me/"+v.replace(/[^0-9]/g,"")],
      ["instagram_url","اینستاگرام",v=>v],["telegram_url","تلگرام",v=>v],
      ["youtube_url","یوتیوب",v=>v],["linkedin_url","لینکدین",v=>v],["facebook_url","فیسبوک",v=>v]
    ];
    links.forEach(([key,label,url])=>{const value=publicContacts[key];if(!value)return;const a=el("a","",label);a.href=url(value);a.target="_blank";a.rel="noopener noreferrer";target.append(a);});
    if(publicContacts.contact_email){const a=el("a","","ایمیل");a.href="mailto:"+publicContacts.contact_email;target.append(a);}
    if(!target.children.length)target.textContent="راه‌های ارتباطی رسمی پس از ثبت توسط مدیریت نمایش داده می‌شوند.";
  }
  document.getElementById("marketSelect")?.addEventListener("change",filterDirectory);
  document.getElementById("internationalCurrency")?.addEventListener("change",filterDirectory);
  function filterDirectory(){
    const language=document.getElementById("language")?.value||"";
    const specialty=document.getElementById("specialty")?.value||"";
    const items=allTherapists.filter(t=>{
      const langOk=!language||(t.languages||[]).includes(language);
      const specOk=!specialty||(t.specialties||[]).some(s=>s.toLocaleLowerCase().includes(specialty.toLocaleLowerCase()));
      return langOk&&specOk;
    });
    renderDirectory(items);
  }

  document.getElementById("searchForm")?.addEventListener("submit",e=>{
    e.preventDefault();filterDirectory();
    directory?.scrollIntoView({behavior:"smooth",block:"nearest"});
  });
  document.getElementById("language")?.addEventListener("change",filterDirectory);
  document.getElementById("specialty")?.addEventListener("change",filterDirectory);

  const marketSelect=document.getElementById("marketSelect");
  marketSelect?.addEventListener("change",()=>{
    const international=marketSelect.value==="international";
    if(notice)notice.textContent=international
      ?"مسیر بین‌المللی انتخاب شد؛ واحد پول و شرایط پرداخت بر اساس بازار مربوط نمایش داده می‌شود."
      :"مسیر ایران انتخاب شد؛ هزینه‌ها بر اساس تعرفهٔ ریالی درمانگر نمایش داده می‌شوند.";
    document.documentElement.dataset.market=marketSelect.value;
    renderDirectory(allTherapists.filter(t=>{
      const language=document.getElementById("language")?.value||"";
      const specialty=document.getElementById("specialty")?.value||"";
      return (!language||(t.languages||[]).includes(language))&&(!specialty||(t.specialties||[]).some(s=>s.toLocaleLowerCase().includes(specialty.toLocaleLowerCase())));
    }));
  });


  async function loadWorkshops(){
    const root=document.getElementById("yadWorkshopDirectory");
    if(!root)return;
    const t=i18n();
    if(!db){root.textContent=t.workshopUnavailable||"برنامهٔ کارگاه‌ها در دسترس نیست.";return;}
    root.textContent=t.workshopLoading||"در حال دریافت برنامهٔ کارگاه‌ها…";
    const {data,error}=await db.from("workshops")
      .select("id,slug,title,summary,presenter_name,languages,topics,format,platform,venue,starts_at,ends_at,timezone,fee_amount,currency")
      .eq("status","published").gt("starts_at",new Date().toISOString()).order("starts_at",{ascending:true}).limit(12);
    root.replaceChildren();
    if(error){root.textContent=t.workshopLoadError||"دریافت برنامهٔ کارگاه‌ها با خطا روبه‌رو شد.";return;}
    if(!data?.length){root.textContent=t.workshopEmpty||"در حال حاضر کارگاه یا نشست منتشرشده‌ای وجود ندارد.";return;}
    data.forEach(event=>{
      const card=el("article","workshop-card");
      const when=new Intl.DateTimeFormat(document.documentElement.lang||"fa",{dateStyle:"medium",timeStyle:"short",timeZone:event.timezone||undefined}).format(new Date(event.starts_at));
      const format=event.format==="online"?(t.workshopOnline||"آنلاین"):event.format==="hybrid"?(t.workshopHybrid||"حضوری و آنلاین"):(t.workshopInPerson||"حضوری");
      card.append(el("span","workshop-format",format));
      card.append(el("h3","",event.title));
      card.append(el("p","workshop-summary",event.summary||""));
      card.append(el("p","workshop-meta",event.presenter_name+" · "+when));
      const fee=Number(event.fee_amount)===0?(t.workshopFree||"رایگان"):new Intl.NumberFormat(document.documentElement.lang==="fa"?"fa-IR":"en-GB").format(Number(event.fee_amount))+" "+event.currency;
      card.append(el("p","workshop-meta",event.platform+" · "+fee));
      const a=el("a","button primary",t.workshopRegister||"ثبت‌نام و مشاهده جزئیات");
      a.href="client.html?workshop="+encodeURIComponent(event.id);
      card.append(a);root.append(card);
    });
  }

  if(db){loadDirectory();loadWorkshops();}
  document.addEventListener("yad:languagechange",()=>{filterDirectory();loadWorkshops();});
  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
  }
  const style=document.createElement("style");
  style.textContent=".therapist-directory{grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-top:12px}.therapist-card{display:flex;gap:14px;align-items:flex-start;background:#fff;border:1px solid #e5ece8;border-radius:17px;padding:15px;box-shadow:0 10px 25px #123f4608;min-width:0}.therapist-photo{width:82px;height:92px;object-fit:cover;border-radius:13px;background:#e8f7f2;flex-shrink:0}.therapist-placeholder{display:grid;place-items:center;color:#123f46;font-size:34px;font-weight:800}.therapist-card-body{min-width:0;flex:1}.therapist-card h3{margin:0;color:#123f46;font-size:16px}.therapist-headline,.therapist-meta{font-size:11px;color:#687b7c;margin:4px 0}.therapist-tags{display:flex;gap:5px;flex-wrap:wrap;margin:8px 0}.therapist-tags span{font-size:10px;padding:3px 7px;border-radius:20px;background:#eff8f4;color:#24665d}.therapist-card .button{padding:8px 12px;font-size:11px;margin-top:5px}.directory-empty{grid-column:1/-1;color:#687b7c;font-size:13px}.language-switch select{max-width:110px}@media(max-width:620px){.therapist-card{padding:12px}.therapist-photo{width:68px;height:80px}}";
  document.head.append(style);
})();