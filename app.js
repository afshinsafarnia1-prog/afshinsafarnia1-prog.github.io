(() => {
  function enforceYadshinBrand(){
    document.querySelectorAll(".brand,.side-brand").forEach(node=>{
      const title=node.querySelector("b");
      if(title)title.textContent="یادشین";
      node.setAttribute("aria-label","یادشین");
    });
  }
  enforceYadshinBrand();
  window.addEventListener("pageshow",enforceYadshinBrand);

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

  function therapistPhotoUrl(path, slug){
    if(path){
      const lower=path.toLowerCase();
      const isHttp=path.startsWith("http://")||path.startsWith("https://");
      const isLocal=path.startsWith("/")||[".jpg",".jpeg",".png",".webp"].some(ext=>lower.endsWith(ext));
      if(isHttp||isLocal)return path.startsWith("/")||isHttp?path:"/"+path;
      if(db){const {data}=db.storage.from("therapist-photos").getPublicUrl(path);return data?.publicUrl||"";}
    }
    if(slug==="foruzan-shahla")return "/therapists/foruzan-shahla.jpg";
    return "";
  }

  function createTherapistCard(t){
    const card=el("article","therapist-card");
    card.dataset.therapistSlug=t.public_slug||"";
    const photoUrl=therapistPhotoUrl(t.photo_path,t.public_slug);
    if(photoUrl){
      const img=el("img","therapist-photo");
      img.src=photoUrl;img.alt="تصویر "+(t.display_name||"درمانگر");img.loading="lazy";
      img.addEventListener("error",()=>{const fallback=el("div","therapist-photo therapist-placeholder",(t.display_name||"د").slice(0,1));img.replaceWith(fallback);},{once:true});
      card.append(img);
    }else card.append(el("div","therapist-photo therapist-placeholder",(t.display_name||"د").slice(0,1)));

    const body=el("div","therapist-card-body");
    body.append(el("h3","",t.display_name||""));
    if(t.headline){
      const parts=t.headline.split("|").map(x=>x.trim()).filter(Boolean);
      if(parts[0])body.append(el("p","therapist-headline therapist-headline-role",parts[0]));
      if(parts[1])body.append(el("p","therapist-headline therapist-headline-detail",parts[1]));
      if(parts[2]){
        const place=parts[2].replace(/\s*و?\s*آنلاین/g,"").replace(/\s*و?\s*حضوری/g,"").trim();
        if(place)body.append(el("p","therapist-meta",place));
      }
    }
    const tags=el("div","therapist-tags");
    const modalityLabels={online:"آنلاین",in_person:"حضوری",hybrid:"آنلاین و حضوری"};
    const values=[...(t.specialties||[]).slice(0,3),...(t.modalities||[]).slice(0,2).map(x=>modalityLabels[x]||x)];
    values.forEach(value=>tags.append(el("span","",value)));
    if(values.length)body.append(tags);
    const link=el("a","button primary","مشاهدهٔ پروفایل");
    link.href=t.public_slug==="foruzan-shahla"?"/therapists/foruzan-shahla.html":"therapist-profile.html?id="+encodeURIComponent(t.id);
    body.append(link);card.append(body);
    return card;
  }

  function renderDirectory(items){
    if(!directory)return;
    const displayPriority={"foruzan-shahla":0,"hediyeh-sabbaghpour":1};
    const orderedItems=[...items].sort((a,b)=>{
      const pa=displayPriority[a.public_slug]??2, pb=displayPriority[b.public_slug]??2;
      return pa-pb || String(a.display_name||"").localeCompare(String(b.display_name||""),"fa");
    });
    const cards=orderedItems.map(createTherapistCard);
    directory.replaceChildren();
    if(!cards.length){
      directory.append(el("p","directory-empty","در حال حاضر درمانگری برای نمایش وجود ندارد."));
      return;
    }
    const controls=el("nav","therapist-carousel-controls");
    controls.setAttribute("aria-label","حرکت افقی میان درمانگران");
    const prev=el("button","button outline","→ قبلی");prev.type="button";prev.setAttribute("aria-label","درمانگر قبلی");
    const next=el("button","button outline","بعدی ←");next.type="button";next.setAttribute("aria-label","درمانگر بعدی");
    const status=el("span","therapist-page-status","");
    const track=el("div","therapist-cards-track");track.setAttribute("aria-label","کارت‌های افقی درمانگران");track.setAttribute("tabindex","0");
    cards.forEach(card=>track.append(card));
    let start=0;
    const visibleCount=()=>window.matchMedia("(max-width: 620px)").matches?1:2;
    const maxStart=()=>Math.max(0,cards.length-visibleCount());
    const updateStatus=()=>{
      const bounds=track.getBoundingClientRect();
      const first=cards.findIndex(card=>{const r=card.getBoundingClientRect();return r.right>bounds.left+4&&r.left<bounds.right-4;});
      if(first>=0)start=first;
      status.textContent=(start+1)+"–"+Math.min(cards.length,start+visibleCount())+" از "+cards.length;
      prev.disabled=start<=0;next.disabled=start>=maxStart();
    };
    const goTo=index=>{start=Math.max(0,Math.min(maxStart(),index));cards[start]?.scrollIntoView({behavior:"smooth",block:"nearest",inline:"start"});updateStatus();};
    prev.addEventListener("click",()=>goTo(start-1));next.addEventListener("click",()=>goTo(start+1));
    track.addEventListener("scroll",()=>window.requestAnimationFrame(updateStatus),{passive:true});
    window.addEventListener("resize",updateStatus,{passive:true});
    controls.append(prev,status,next);directory.append(controls,track);updateStatus();
  }

  async function loadDirectory(){
    if(!directory)return;
    directory.textContent="در حال دریافت فهرست درمانگران…";
    const restRequest=async(path,method="GET")=>{
      const headers={apikey:config.anonKey,Authorization:"Bearer "+config.anonKey,Accept:"application/json"};
      const options={method,headers};
      if(method==="POST"){headers["Content-Type"]="application/json";options.body="{}";}
      const response=await fetch(config.url+"/rest/v1/"+path,options);
      const payload=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(payload?.message||payload?.hint||("HTTP "+response.status));
      return payload;
    };
    try{
      const select="id,public_slug,display_name,headline,biography,specialties,modalities,languages,photo_path";
      let data;
      if(db){
        const result=await db.from("therapists").select(select).eq("is_listed",true).eq("manager_approved",true).not("verified_at","is",null).order("display_name",{ascending:true});
        if(result.error)throw result.error;
        data=result.data;
      }else{
        const params=new URLSearchParams({select,is_listed:"eq.true",manager_approved:"eq.true",verified_at:"not.is.null",order:"display_name.asc"});
        data=await restRequest("therapists?"+params.toString());
      }
      allTherapists=(data||[]).sort((a,b)=>{
        const priority={"foruzan-shahla":0,"hediyeh-sabbaghpour":1};
        const pa=priority[a.public_slug]??2, pb=priority[b.public_slug]??2;
        return pa-pb || String(a.display_name||"").localeCompare(String(b.display_name||""),"fa");
      });
      // Render the primary directory immediately; optional public RPCs must never hide valid therapist cards.
      populateModalityFilter();
      const guideParams=new URLSearchParams(location.search);
      const guideLanguage=guideParams.get("language"),guideSpecialty=guideParams.get("specialty"),guideFormat=guideParams.get("format");
      if(guideLanguage&&document.getElementById("language"))document.getElementById("language").value=guideLanguage;
      if(guideSpecialty&&document.getElementById("specialty"))document.getElementById("specialty").value=guideSpecialty;
      if(guideFormat&&document.getElementById("modality"))document.getElementById("modality").value=guideFormat==="in-person"?"in_person":guideFormat==="online"?"online":"";
      filterDirectory();

      try{
        const publicMetadata=db
          ? await db.rpc("get_public_therapist_directory_metadata")
          : {data:await restRequest("rpc/get_public_therapist_directory_metadata","POST"),error:null};
        if(publicMetadata.error)throw publicMetadata.error;
        if(Array.isArray(publicMetadata.data)){
          const byId=new Map(publicMetadata.data.map(x=>[x.therapist_id,x]));
          allTherapists=allTherapists.map(x=>({...x,...(byId.get(x.id)||{})}));
        }
      }catch(error){console.warn("YADSHIN public therapist metadata unavailable:",error);}

      try{
        const ratingResult=db
          ? await db.rpc("get_public_therapist_rating_summary")
          : {data:await restRequest("rpc/get_public_therapist_rating_summary","POST"),error:null};
        if(ratingResult.error)throw ratingResult.error;
        if(Array.isArray(ratingResult.data)){
          const ratingById=new Map(ratingResult.data.map(x=>[x.therapist_id,x]));
          allTherapists=allTherapists.map(x=>({...x,...(ratingById.get(x.id)||{})}));
        }
      }catch(error){console.warn("YADSHIN public therapist ratings unavailable:",error);}

      filterDirectory();
      try{
        const settingsResult=db
          ? await db.rpc("get_public_site_settings")
          : {data:await restRequest("rpc/get_public_site_settings","POST"),error:null};
        if(settingsResult.error)throw settingsResult.error;
        const storedContacts=settingsResult.data?.contacts||{};
        publicContacts={...storedContacts,phone_number:storedContacts.phone_number||"09999398350",whatsapp_number:storedContacts.whatsapp_number||"09999398350",telegram_url:storedContacts.telegram_url||"",eitaa_url:storedContacts.eitaa_url||""};
        siteBranding=settingsResult.data?.branding||{};
      }catch(error){console.warn("YADSHIN public site settings unavailable:",error);}
      renderPublicBranding();renderPublicTariffs();renderPublicContacts();
      if(notice)notice.textContent=allTherapists.length
        ?"فهرست درمانگران یادشین"
        :"در حال حاضر درمانگری برای نمایش وجود ندارد.";
    }catch(error){
      console.error("YADSHIN therapist directory request failed:",error);
      allTherapists=[];
      renderDirectory([]);
      const count=document.getElementById("directoryCount");
      if(count)count.textContent="";
      if(notice)notice.textContent="دریافت فهرست درمانگران با خطا روبه‌رو شد: "+(error?.message||"خطای ارتباط با پایگاه داده");
    }
  }
  function renderPublicBranding(){
    const name="یادشین";
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
      ["instagram_url","اینستاگرام",v=>v],["telegram_url","تلگرام",v=>v],["eitaa_url","ایتا",v=>v],
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
    directoryPage=0;
    const items=allTherapists.filter(t=>{
      const langOk=!language||(t.languages||[]).includes(language);
      const specOk=!specialty||(t.specialties||[]).some(s=>s.toLocaleLowerCase().includes(specialty.toLocaleLowerCase()));
      const modalityOk=!modality||(t.modalities||[]).some(x=>x.toLocaleLowerCase()===modality.toLocaleLowerCase());
      const haystack=[t.display_name,t.headline,t.biography,...(t.specialties||[]),...(t.modalities||[])].filter(Boolean).join(" ").toLocaleLowerCase();
      const keywordOk=!keyword||haystack.includes(keyword);
      const acceptingOk=!acceptingOnly||t.accepting_new_clients===true;
      return langOk&&specOk&&modalityOk&&keywordOk&&acceptingOk;
    });
    renderDirectory(items);
    const count=document.getElementById("directoryCount");
    if(count)count.textContent=(i18n().directoryCount||"{shown} از {total} درمانگر").replace("{shown}",String(items.length)).replace("{total}",String(allTherapists.length));
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

  if(config.url&&config.anonKey){loadDirectory();if(db)loadWorkshops();}
  document.addEventListener("yad:languagechange",()=>{filterDirectory();loadWorkshops();});
  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
  }
})();