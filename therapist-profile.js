(() => {
  const root=document.getElementById("therapistProfile");
  if(!root)return;
  const config=window.YAD_SUPABASE_CONFIG||{};
  const db=window.supabase?.createClient&&config.url&&config.anonKey
    ?window.supabase.createClient(config.url,config.anonKey):null;
  const params=new URLSearchParams(window.location.search);
  const id=params.get("id");
  const canonical=document.querySelector('link[rel="canonical"]')||document.head.appendChild(Object.assign(document.createElement("link"),{rel:"canonical"}));
  if(id)canonical.href=location.origin+location.pathname+"?id="+encodeURIComponent(id);
  const names={fa:"فارسی",ku:"کوردی",en:"English",tr:"ترکی",ar:"العربية",es:"Español",de:"Deutsch",fr:"Français"};
  const locale=()=>document.documentElement.lang==="ku"?"en-GB":(document.documentElement.lang||"en");
  const t=(key)=>window.YAD_I18N?.translations?.[document.documentElement.lang]?.[key]||window.YAD_I18N?.translations?.fa?.[key]||key;
  const node=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!=null)n.textContent=value;return n;};
  const list=(value)=>Array.isArray(value)?value:(typeof value==="string"?value.split(/[,،؛]/).map(x=>x.trim()).filter(Boolean):[]);
  function section(title,values){
    if(!values.length)return null;
    const box=node("section","profile-section");
    box.append(node("h2","",title));
    const wrap=node("div","profile-tags");
    values.forEach(value=>wrap.append(node("span","",value)));
    box.append(wrap);return box;
  }
  async function load(){
    if(!db){root.textContent=t("profileConnectionError");return;}
    if(!id){root.textContent=t("profileMissingId");return;}
    root.textContent=t("profileLoading");
    const {data,error}=await db.from("therapists")
      .select("id,public_slug,display_name,headline,biography,qualifications,specialties,languages,modalities,photo_path")
      .eq("id",id).eq("is_listed",true).not("verified_at","is",null).maybeSingle();
    if(error||!data){root.textContent=t("profileNotFound");return;}
    const {data:metaRows}=await db.rpc("get_public_therapist_public_metadata",{p_therapist_id:id});
    const publicMeta=metaRows?.[0]||{};
    const {data:feedbackRows}=await db.rpc("get_public_therapist_feedback",{p_therapist_id:id});
    const feedback=feedbackRows||[];
    document.title=(data.display_name||"درمانگر")+" | پروفایل متخصص | یادسنتر";
    const description=document.querySelector('meta[name="description"]');
    if(description)description.content="اطلاعات عمومی و تأییدشدهٔ "+(data.display_name||"درمانگر")+" شامل تحصیلات، حوزه‌های تخصصی، رویکرد و زبان‌های ارائهٔ خدمت در یادسنتر.";
    const ogTitle=document.querySelector('meta[property="og:title"]');if(ogTitle)ogTitle.content=document.title;
    const ogDescription=document.querySelector('meta[property="og:description"]');if(ogDescription&&description)ogDescription.content=description.content;
    root.replaceChildren();
    const hero=node("div","profile-hero");
    if(data.photo_path){
      const {data:photo}=db.storage.from("therapist-photos").getPublicUrl(data.photo_path);
      if(photo?.publicUrl){const img=node("img","profile-photo");img.src=photo.publicUrl;img.alt=t("profilePhotoAlt");img.loading="lazy";hero.append(img);}
    } else {
      const mark=node("div","profile-monogram","ی");
      mark.setAttribute("aria-hidden","true");
      hero.append(mark);
    }
    const intro=node("div","profile-intro");
    intro.append(node("span","eyebrow",t("profileVerified")));
    intro.append(node("h1","",data.display_name||t("profileNoName")));
    if(data.headline)intro.append(node("p","profile-headline",data.headline));
    if(typeof publicMeta.accepting_new_clients==="boolean")intro.append(node("span",publicMeta.accepting_new_clients?"availability-open":"availability-closed",t(publicMeta.accepting_new_clients?"profileAcceptingYes":"profileAcceptingNo")));
    intro.append(node("p","profile-session",t("profileSession")));
    hero.append(intro);root.append(hero);
    const grid=node("div","profile-content-grid");
    const main=node("div","profile-main");
    if(data.biography){const bio=node("section","profile-section");bio.append(node("h2","",t("profileAbout")),node("p","profile-biography",data.biography));main.append(bio);}
    const qualifications=list(data.qualifications);
    if(qualifications.length)main.append(section(t("profileQualifications"),qualifications));
    const specialties=list(data.specialties);
    if(specialties.length)main.append(section(t("profileSpecialties"),specialties));
    const modalities=list(data.modalities);
    if(modalities.length)main.append(section(t("profileModalities"),modalities));
    const languages=list(data.languages).map(x=>names[x]||x);
    if(languages.length)main.append(section(t("profileLanguages"),languages));
    if(publicMeta.years_experience!=null)main.append(section(t("profileYearsExperience"),[String(publicMeta.years_experience)]));
    const regionNames=new Intl.DisplayNames([locale()],{type:"region"});
    const jurisdictions=list(publicMeta.practice_jurisdictions).map(code=>{try{return regionNames.of(code)||code;}catch{return code;}});
    if(jurisdictions.length)main.append(section(t("profileJurisdictions"),jurisdictions));
    if(feedback.length){const reviews=node("section","profile-section");reviews.append(node("h2","",t("profileReviews")));feedback.forEach(item=>{const review=node("article","public-review");review.append(node("b","","★".repeat(item.rating)+" · "+t("profileVerifiedReview")));if(item.feedback)review.append(node("p","",item.feedback));review.append(node("small","profile-muted",new Intl.DateTimeFormat(locale(),{dateStyle:"medium"}).format(new Date(item.created_at))));reviews.append(review);});main.append(reviews);}
    const aside=node("aside","profile-aside");
    const price=node("section","profile-section");
    price.append(node("h2","",t("profileFee")));
    let tariffs=[];
    const {data:settings,error:settingsError}=await db.rpc("get_public_site_settings");
    if(!settingsError)tariffs=settings?.tariffs||[];
    const labels=[["iran","IRR","profileIran"],["international","EUR","profileEuro"],["international","USD","profileDollar"]];
    labels.forEach(([market,currency,key])=>{
      const item=tariffs.find(x=>x.market===market&&x.currency===currency);
      const amount=item?new Intl.NumberFormat(locale()).format(currency==="IRR"?Number(item.amount)/10:Number(item.amount))+(currency==="IRR"?t("profileToman"):" "+currency):t("profileSetting");
      price.append(node("p","profile-price",t(key)+" · "+amount));
    });
    price.append(node("small","profile-muted",t("profile45min")));
    aside.append(price);
    const cta=node("a","button primary full-button",t("profileChoose"));
    cta.href="client.html?therapist="+encodeURIComponent(data.id);
    aside.append(cta);
    aside.append(node("p","profile-muted",t("profileBookingNote")));
    grid.append(main,aside);root.append(grid);
  }
  load();
  document.addEventListener("yad:languagechange",load);
})();