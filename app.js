(() => {
  const menu=document.getElementById("menuToggle");
  const nav=document.getElementById("mainNav");
  menu?.addEventListener("click",()=>{
    const open=nav.classList.toggle("open");
    menu.setAttribute("aria-expanded",String(open));
  });
  nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>nav.classList.remove("open")));

  const config=window.YAD_SUPABASE_CONFIG||{};
  let db=null, allTherapists=[], allFees=[], publicContacts={}, siteBranding={};
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
      const hasFilters=Boolean(document.getElementById("language")?.value||document.getElementById("specialty")?.value||document.getElementById("modality")?.value||document.getElementById("therapistKeyword")?.value.trim());
      directory.append(el("p","directory-empty",hasFilters
        ?"با فیلترهای انتخاب‌شده درمانگری پیدا نشد؛ فیلترها را تغییر دهید یا همهٔ گزینه‌ها را انتخاب کنید."
        :(i18n().directoryEmpty||"در حال حاضر درمانگر تأییدشده‌ای برای نمایش وجود ندارد.")));
      return;
    }
    items.forEach(t=>{
      const card=el("article","therapist-card");
      if(t.photo_path && db){
        const {data}=db.storage.from("therapist-photos").getPublicUrl(t.photo_path);
        if(data?.publicUrl){const img=el("img","therapist-photo");img.src=data.publicUrl;img.alt="تصویر "+t.display_name;img.loading="lazy";card.append(img);}
      } else if(t.public_slug==="foruzan-shahla"){const img=el("img","therapist-photo");img.src="/therapists/foruzan-shahla.jpg";img.alt="تصویر "+t.display_name;img.loading="lazy";card.append(img);}
      else card.append(el("div","therapist-photo therapist-placeholder","ی"));
      const body=el("div","therapist-card-body");
      body.append(el("h3","",t.display_name||""));
      if(t.manager_approved===true&&!t.verified_at)body.append(el("span","therapist-meta","تأییدشده توسط مدیریت ردیاد؛ احراز حرفه‌ای مستقل هنوز ثبت نشده است"));
      if(t.headline)body.append(el("p","therapist-headline",t.headline));
      if(t.years_experience!=null)body.append(el("p","therapist-meta",(i18n().yearsExperience||"سابقهٔ حرفه‌ای: {years} سال").replace("{years}",String(t.years_experience))));
      if(typeof t.accepting_new_clients==="boolean")body.append(el("span",t.accepting_new_clients?"availability-open":"availability-closed",t.accepting_new_clients?(i18n().acceptingYes||"پذیرش مراجع جدید"):(i18n().acceptingNo||"فعلاً پذیرش مراجع جدید ندارد")));
      const tags=el("div","therapist-tags");
      (t.specialties||[]).slice(0,3).forEach(x=>tags.append(el("span","",x)));
      (t.modalities||[]).slice(0,3).forEach(x=>tags.append(el("span","modality-tag",x)));
      (t.languages||[]).forEach(code=>tags.append(el("span","language-tag",languageNames[code]||code)));
      if(Number(t.review_count)>0)tags.append(el("span","rating-tag","★ "+Number(t.average_rating).toFixed(1)+" ("+t.review_count+")"));
      body.append(tags);
      const market=document.getElementById("marketSelect")?.value||"iran";
      const currency=market==="iran"?"IRR":(document.getElementById("internationalCurrency")?.value||"EUR");
      const chosen=(t.fees||[]).find(x=>x.currency===currency);
      const priceText=chosen?new Intl.NumberFormat(document.documentElement.lang==="fa"?"fa-IR":"en-GB").format(currency==="IRR"?Number(chosen.amount)/10:Number(chosen.amount))+(currency==="IRR"?" تومان":" "+currency):"تعرفهٔ این ارز هنوز ثبت نشده است";
      const meta=el("p","therapist-meta","۴۵ دقیقه · "+priceText);
      body.append(meta);
      const link=el("a","button primary",i18n().chooseTherapist||"مشاهدهٔ پروفایل و انتخاب");
      link.href="therapist-profile.html?id="+encodeURIComponent(t.id);
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
      .select("id,public_slug,display_name,headline,biography,specialties,modalities,languages,photo_path,manager_approved,verified_at")
      .eq("is_listed",true).or("verified_at.not.is.null,manager_approved.eq.true")
      .order("display_name",{ascending:true});
    if(error){directory.textContent="دریافت فهرست درمانگران با خطا روبه‌رو شد. لطفاً بعداً دوباره تلاش کنید.";return;}
    allTherapists=data||[];
    const {data:feeRows, error:feeError}=await db.rpc("get_public_therapist_fee_directory");
    if(feeError){directory.textContent="دریافت تعرفهٔ درمانگران با خطا روبه‌رو شد.";return;}
    const feesByTherapist=new Map();
    (feeRows||[]).forEach(row=>{if(!feesByTherapist.has(row.therapist_id))feesByTherapist.set(row.therapist_id,[]);feesByTherapist.get(row.therapist_id).push(row);});
    allTherapists=allTherapists.map(t=>({...t,fees:feesByTherapist.get(t.id)||[]}));
    const {data:publicMetadata}=await db.rpc("get_public_therapist_directory_metadata");
    if(Array.isArray(publicMetadata)){const byId=new Map(publicMetadata.map(x=>[x.therapist_id,x]));allTherapists=allTherapists.map(x=>({...x,...(byId.get(x.id)||{})}));}
    const {data:ratingRows}=await db.rpc("get_public_therapist_rating_summary");
    if(Array.isArray(ratingRows)){const ratingById=new Map(ratingRows.map(x=>[x.therapist_id,x]));allTherapists=allTherapists.map(x=>({...x,...(ratingById.get(x.id)||{})}));}
    populateModalityFilter();
    const guideParams=new URLSearchParams(location.search);
    const guideLanguage=guideParams.get("language");
    const guideSpecialty=guideParams.get("specialty");
    const guideFormat=guideParams.get("format");
    if(guideLanguage&&document.getElementById("language"))document.getElementById("language").value=guideLanguage;
    if(guideSpecialty&&document.getElementById("specialty"))document.getElementById("specialty").value=guideSpecialty;
    if(guideFormat&&document.getElementById("modality"))document.getElementById("modality").value=guideFormat==="in-person"?"in_person":guideFormat==="online"?"online":"";
    const {data:settings,error:settingsError}=await db.rpc("get_public_site_settings");
    if(settingsError){directory.textContent="دریافت تنظیمات عمومی سایت با خطا روبه‌رو شد.";return;}
    
    const storedContacts=settings?.contacts||{};
    publicContacts={...storedContacts,phone_number:storedContacts.phone_number||"09999398350",whatsapp_number:storedContacts.whatsapp_number||"09999398350"};
    siteBranding=settings?.branding||{};
    renderPublicBranding();
    renderPublicTariffs();
    renderPublicContacts();
    filterDirectory();
    if(notice)notice.textContent=allTherapists.length
      ?"پروفایل‌های زیر توسط مدیریت ردیاد بررسی و برای نمایش تأیید شده‌اند."
      :"فهرست درمانگران پس از تأیید مدارک و مجوزها منتشر می‌شود؛ هیچ پروفایل تأییدنشده‌ای نمایش داده نمی‌شود.";
  }

  function renderPublicBranding(){
    const savedName=String(siteBranding.brand_name||"").trim(); const name=(!savedName||savedName==="یادسنتر"||savedName.toLowerCase()==="yad center")?"ردیاد":savedName;
    document.querySelectorAll(".brand").forEach(node=>{
      const title=node.querySelector("b");if(title)title.textContent=name;
      const mark=node.querySelector(".brandmark");
      if(mark&&siteBranding.logo_path&&db){
        const {data}=db.storage.from("site-assets").getPublicUrl(siteBranding.logo_path);
        if(data?.publicUrl){const img=el("img","yad-brand-logo");img.src=data.publicUrl;img.alt=name+" لوگو";mark.replaceChildren(img);}
      }
    });
    const topTagline=document.getElementById("yadBrandTopTagline");
    if(topTagline&&siteBranding.tagline)topTagline.textContent=siteBranding.tagline;
    const aboutTitle=document.getElementById("yadBrandAboutTitle");
    const aboutText=document.getElementById("yadBrandAboutText");
    const manager=document.getElementById("yadPublicManager");
    if(aboutTitle&&siteBranding.tagline)aboutTitle.textContent=siteBranding.tagline;
    if(manager&&siteBranding.manager_name){
      document.getElementById("yadPublicManagerName").textContent=siteBranding.manager_name;
      document.getElementById("yadPublicManagerTitle").textContent=siteBranding.manager_title||"";
      document.getElementById("yadPublicManagerBio").textContent=siteBranding.manager_bio||"";
      if(siteBranding.manager_photo_path&&db){
        const {data}=db.storage.from("site-assets").getPublicUrl(siteBranding.manager_photo_path);
        if(data?.publicUrl){const img=document.getElementById("yadPublicManagerPhoto");img.src=data.publicUrl;img.alt=siteBranding.manager_name;}
      }else document.getElementById("yadPublicManagerPhoto").hidden=true;
      manager.hidden=false;
    }
  }
  function renderPublicTariffs(){
    const target=document.getElementById("yadPublicTariffs");if(!target)return;
    target.replaceChildren();
    target.append(el("p","", "تعرفهٔ هر درمانگر به‌صورت مستقل تعیین می‌شود و در پروفایل همان متخصص قابل مشاهده است. جلسهٔ استاندارد ۴۵ دقیقه است."));
    const updated=document.getElementById("yadTariffUpdated");
    if(updated)updated.textContent="";
  }
  function renderPublicContacts(){
    const target=document.getElementById("yadPublicContacts");if(!target)return;
    target.replaceChildren();
    const links=[
      ["phone_number","تلفن",v=>"tel:"+v],
      ["whatsapp_number","واتساپ",v=>"https://wa.me/"+(v.replace(/[^0-9]/g,"").replace(/^0/,"98"))],
      ["instagram_url","اینستاگرام",v=>v],["telegram_url","تلگرام",v=>v],
      ["youtube_url","یوتیوب",v=>v],["linkedin_url","لینکدین",v=>v],["facebook_url","فیسبوک",v=>v]
    ];
    links.forEach(([key,label,url])=>{const value=publicContacts[key];if(!value)return;const visibleLabel=(key==="phone_number"||key==="whatsapp_number")?label+": "+value:label;const a=el("a","",visibleLabel);a.href=url(value);if(key!=="phone_number"){a.target="_blank";a.rel="noopener noreferrer";}target.append(a);});
    if(publicContacts.contact_email){const a=el("a","","ایمیل");a.href="mailto:"+publicContacts.contact_email;target.append(a);}
    if(!target.children.length)target.textContent="راه‌های ارتباطی رسمی پس از ثبت توسط مدیریت نمایش داده می‌شوند.";
  }
  document.getElementById("marketSelect")?.addEventListener("change",filterDirectory);
  document.getElementById("internationalCurrency")?.addEventListener("change",filterDirectory);
  function populateModalityFilter(){
    const select=document.getElementById("modality");if(!select)return;
    const current=select.value;
    const values=[...new Set(allTherapists.flatMap(t=>t.modalities||[]).map(x=>String(x).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,document.documentElement.lang||"fa"));
    select.replaceChildren(el("option","",i18n().modalityAll||"همه رویکردها"));select.options[0].value="";
    values.forEach(value=>{const option=el("option","",value);option.value=value;select.append(option);});
    if(values.includes(current))select.value=current;
  }
  function filterDirectory(){
    const language=document.getElementById("language")?.value||"";
    const specialty=document.getElementById("specialty")?.value||"";
    const modality=document.getElementById("modality")?.value||"";
    const acceptingOnly=!!document.getElementById("acceptingOnly")?.checked;
    const keyword=(document.getElementById("therapistKeyword")?.value||"").trim().toLocaleLowerCase();
    const items=allTherapists.filter(t=>{
      const langOk=!language||(t.languages||[]).includes(language);
      const specOk=!specialty||(t.specialties||[]).some(s=>s.toLocaleLowerCase().includes(specialty.toLocaleLowerCase()));
      const modalityOk=!modality||(t.modalities||[]).some(x=>x.toLocaleLowerCase()===modality.toLocaleLowerCase());
      const haystack=[t.display_name,t.headline,t.biography,...(t.specialties||[]),...(t.modalities||[])].filter(Boolean).join(" ").toLocaleLowerCase();
      const keywordOk=!keyword||haystack.includes(keyword);
      const acceptingOk=!acceptingOnly||t.accepting_new_clients===true;
      return langOk&&specOk&&modalityOk&&keywordOk&&acceptingOk;
    });
    const count=document.getElementById("directoryCount");if(count)count.textContent=(i18n().directoryCount||"{shown} از {total}").replace("{shown}",String(items.length)).replace("{total}",String(allTherapists.length));
    renderDirectory(items);
  }

  document.getElementById("searchForm")?.addEventListener("submit",e=>{
    e.preventDefault();filterDirectory();
    directory?.scrollIntoView({behavior:"smooth",block:"nearest"});
  });
  document.getElementById("language")?.addEventListener("change",filterDirectory);
  document.getElementById("specialty")?.addEventListener("change",filterDirectory);
  document.getElementById("modality")?.addEventListener("change",filterDirectory);
  document.getElementById("therapistKeyword")?.addEventListener("input",filterDirectory);
  document.getElementById("acceptingOnly")?.addEventListener("change",filterDirectory);
  document.getElementById("clearTherapistFilters")?.addEventListener("click",()=>{["language","specialty","modality","therapistKeyword"].forEach(id=>{const node=document.getElementById(id);if(node)node.value="";});const accepting=document.getElementById("acceptingOnly");if(accepting)accepting.checked=false;filterDirectory();});

  const marketSelect=document.getElementById("marketSelect");
  marketSelect?.addEventListener("change",()=>{
    const international=marketSelect.value==="international";
    if(notice)notice.textContent=international
      ?"مسیر بین‌المللی انتخاب شد؛ واحد پول و شرایط پرداخت بر اساس بازار مربوط نمایش داده می‌شود."
      :"مسیر ایران انتخاب شد؛ تعرفهٔ اختصاصی درمانگر به تومان نمایش داده می‌شود." ;
    document.documentElement.dataset.market=marketSelect.value;
    filterDirectory();
  });


  async function loadWorkshops(){
    const root=document.getElementById("yadWorkshopDirectory");
    if(!root)return;
    const t=i18n();
    if(!db){root.textContent=t.workshopUnavailable||"برنامهٔ کارگاه‌ها در دسترس نیست.";return;}
    root.textContent=t.workshopLoading||"در حال دریافت برنامهٔ کارگاه‌ها…";
    const {data,error}=await db.from("workshops")
      .select("id,slug,title,summary,presenter_name,languages,topics,format,platform,venue,starts_at,ends_at,timezone,fee_amount,currency,registration_deadline")
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
      card.append(el("p","workshop-meta",event.presenter_name+" · شروع: "+when));
      if(event.ends_at){const endWhen=new Intl.DateTimeFormat(document.documentElement.lang||"fa",{dateStyle:"medium",timeStyle:"short",timeZone:event.timezone||undefined}).format(new Date(event.ends_at));card.append(el("p","workshop-meta","پایان: "+endWhen));}
      if(event.platform)card.append(el("p","workshop-meta","بستر برگزاری: "+event.platform));
      if(event.registration_deadline){const deadline=new Intl.DateTimeFormat(document.documentElement.lang||"fa",{dateStyle:"medium",timeStyle:"short",timeZone:event.timezone||undefined}).format(new Date(event.registration_deadline));card.append(el("p","workshop-meta","مهلت ثبت‌نام: "+deadline));}
      const fee=Number(event.fee_amount)===0?(t.workshopFree||"رایگان"):new Intl.NumberFormat(document.documentElement.lang==="fa"?"fa-IR":"en-GB").format(Number(event.fee_amount))+" "+event.currency;
      card.append(el("p","workshop-meta","هزینه: "+fee));
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
  style.textContent=".therapist-directory{grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-top:12px}.therapist-card{display:flex;gap:14px;align-items:flex-start;background:#fff;border:1px solid #e5ece8;border-radius:17px;padding:15px;box-shadow:0 10px 25px #123f4608;min-width:0}.therapist-photo{width:82px;height:92px;object-fit:cover;border-radius:13px;background:#e8f7f2;flex-shrink:0}.therapist-placeholder{display:grid;place-items:center;color:#123f46;font-size:34px;font-weight:800}.therapist-card-body{min-width:0;flex:1}.therapist-card h3{margin:0;color:#123f46;font-size:16px}.therapist-headline,.therapist-meta{font-size:11px;color:#687b7c;margin:4px 0}.therapist-tags{display:flex;gap:5px;flex-wrap:wrap;margin:8px 0}.therapist-tags span{font-size:10px;padding:3px 7px;border-radius:20px;background:#eff8f4;color:#24665d}.therapist-tags .modality-tag{background:#fff3ec;color:#92513f}.therapist-card .button{padding:8px 12px;font-size:11px;margin-top:5px}.directory-empty{grid-column:1/-1;color:#687b7c;font-size:13px}.directory-count{grid-column:1/-1;color:#687b7c;font-size:12px;margin:0}.therapist-filters{grid-template-columns:repeat(auto-fit,minmax(170px,1fr));align-items:end}.therapist-filters label{min-width:0}.filter-keyword input{width:100%;min-width:0;padding:10px;border:1px solid #dce8e3;border-radius:10px;font:inherit}.filter-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.filter-accepting{display:flex!important;grid-auto-flow:column;justify-content:start;align-items:center;gap:8px!important}.filter-accepting input{width:auto}.availability-open,.availability-closed{display:inline-block;margin-top:5px;padding:4px 9px;border-radius:20px;font-size:10px}.availability-open{background:#e7f7ee;color:#176b48}.availability-closed{background:#f2f3f2;color:#687b7c}.language-switch select{max-width:110px}@media(max-width:620px){.therapist-card{padding:12px}.therapist-photo{width:68px;height:80px}.filter-actions>*{flex:1}}";
  document.head.append(style);
})();