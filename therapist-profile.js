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
      .select("id,public_slug,display_name,headline,biography,qualifications,specialties,languages,modalities,photo_path,manager_approved,verified_at")
      .eq("id",id).eq("is_listed",true).eq("manager_approved",true).maybeSingle();
    if(error||!data){root.textContent=t("profileNotFound");return;}
    const {data:metaRows}=await db.rpc("get_public_therapist_public_metadata",{p_therapist_id:id});
    const publicMeta=metaRows?.[0]||{};
    const {data:feedbackRows}=await db.rpc("get_public_therapist_feedback",{p_therapist_id:id});
    const feedback=feedbackRows||[];
    document.title=(data.display_name||"درمانگر")+" | پروفایل متخصص | ردیاد";
    const description=document.querySelector('meta[name="description"]');
    if(description)description.content="اطلاعات عمومی و تأییدشدهٔ "+(data.display_name||"درمانگر")+" شامل تحصیلات، حوزه‌های تخصصی، رویکرد و زبان‌های ارائهٔ خدمت در ردیاد.";
    const ogTitle=document.querySelector('meta[property="og:title"]');if(ogTitle)ogTitle.content=document.title;
    const ogDescription=document.querySelector('meta[property="og:description"]');if(ogDescription&&description)ogDescription.content=description.content;
    root.replaceChildren();
    const hero=node("div","profile-hero");
    if(data.photo_path){
      const isDirect=data.photo_path.startsWith("/")||data.photo_path.includes(".jpg")||data.photo_path.includes(".jpeg")||data.photo_path.includes(".png")||data.photo_path.includes(".webp")||data.photo_path.startsWith("http");
      const photoUrl=isDirect?(data.photo_path.startsWith("/")?data.photo_path:"/"+data.photo_path.replace(/^\/+/, "")):db.storage.from("therapist-photos").getPublicUrl(data.photo_path).data?.publicUrl;
      if(photoUrl){const img=node("img","profile-photo");img.src=photoUrl;img.alt=t("profilePhotoAlt");img.loading="lazy";hero.append(img);}
    } else if(data.public_slug==="foruzan-shahla"){
      const img=node("img","profile-photo");img.src="/therapists/foruzan-shahla.jpg";img.alt=t("profilePhotoAlt");img.loading="lazy";hero.append(img);
    } else {
      const mark=node("div","profile-monogram","ی");mark.setAttribute("aria-hidden","true");hero.append(mark);
    }
    const intro=node("div","profile-intro");
    if(data.manager_approved===true||data.verified_at)intro.append(node("span","eyebrow","تأییدشده توسط مدیریت ردیاد"));
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
    const {data:feeRows,error:feeError}=await db.rpc("get_public_therapist_fees",{p_therapist_id:id});
    const currencyLabels={IRR:t("profileIran")+" · "+t("profileToman"),EUR:t("profileEuro"),USD:t("profileDollar"),CAD:"دلار کانادا"};
    if(!feeError&&feeRows?.length){
      feeRows.forEach(item=>{
        const amount=new Intl.NumberFormat(locale()).format(item.currency==="IRR"?Number(item.amount)/10:Number(item.amount))+(item.currency==="IRR"?" تومان":" "+item.currency);
        price.append(node("p","profile-price",(currencyLabels[item.currency]||item.currency)+" · "+amount));
      });
    }else{
      price.append(node("p","profile-muted","تعرفهٔ این درمانگر هنوز برای نمایش ثبت نشده است."));
    }
    price.append(node("small","profile-muted",t("profile45min")));
    aside.append(price);
    const contactActions=node("div","profile-contact-actions");
    const whatsappMessage="سلام، برای دریافت اطلاعات و هماهنگی جلسه با درمانگر "+(data.display_name||"منتخب")+" از طریق ردیاد پیام می‌دهم.";
    const contactLinks=[["https://wa.me/989999398350?text="+encodeURIComponent(whatsappMessage),"پیام در واتساپ","primary"],["https://t.me/RADYAD","پیام در تلگرام","outline"],["https://eitaa.com/RADYAD","پیام در ایتا","outline"]];
    contactLinks.forEach(([href,label,style])=>{const link=node("a","button "+style+" full-button",label);link.href=href;link.target="_blank";link.rel="noopener noreferrer";contactActions.append(link);});
    aside.append(contactActions);
    aside.append(node("p","profile-muted","زمان جلسه ابتدا با مدیریت و درمانگر هماهنگ می‌شود؛ پس از اعلام مبلغ و تأیید پرداخت، نوبت قطعی خواهد شد."));
    grid.append(main,aside);root.append(grid);
  }
  load();
  document.addEventListener("yad:languagechange",load);
})();