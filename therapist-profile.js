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
  function localizedNikoText(value){if(!value||typeof value!=="string")return value||"";const lang=document.documentElement.lang||"fa";const fields=value.split("||").map(part=>part.trim());if(fields.length<3)return value;const pick=prefix=>fields.find(part=>part.startsWith(prefix))?.slice(prefix.length).trim()||"";return lang==="en"?pick("EN:"):lang==="ar"?pick("AR:"):pick("FA:");}
  const nikoTranslations={en:{qualifications:["PhD in Health Psychology","University lecturer","Member, Iranian Psychology and Counselling Organization","Member, Iranian Psychological Association","Member, Iranian Health Psychology Association","Reported professional licence number: 1594616"],specialties:["Adult psychotherapy","Individual psychotherapy","Couples therapy","Premarital counselling","Schema therapy","MMPI assessment","Schema assessment","Life-skills workshops: stress management, anger management, decision-making, problem-solving, assertiveness, critical and creative thinking, empathy, self-awareness, and conflict resolution"]},ar:{qualifications:["دكتوراه في علم النفس الصحي","محاضِرة جامعية","عضوة في منظمة علم النفس والإرشاد الإيرانية","عضوة في الجمعية الإيرانية لعلم النفس","عضوة في الجمعية الإيرانية لعلم النفس الصحي","رقم الترخيص المهني المُعلن: 1594616"],specialties:["العلاج النفسي للبالغين","العلاج النفسي الفردي","العلاج الزواجي","الإرشاد قبل الزواج","العلاج بالمخططات","تقييم MMPI","تقييم المخططات","مدرّبة ورش مهارات الحياة: إدارة التوتر، ضبط الغضب، اتخاذ القرار، حل المشكلات، التوكيدية، التفكير النقدي والإبداعي، التعاطف، الوعي بالذات، وحل النزاعات"]}};
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
      .eq("id",id).eq("is_listed",true).or("verified_at.not.is.null,manager_approved.eq.true").maybeSingle();
    if(error||!data){root.textContent=t("profileNotFound");return;}
    const {data:metaRows}=await db.rpc("get_public_therapist_public_metadata",{p_therapist_id:id});
    const publicMeta=metaRows?.[0]||{};
    const {data:feedbackRows}=await db.rpc("get_public_therapist_feedback",{p_therapist_id:id});
    const feedback=feedbackRows||[];
    document.title=(data.display_name||"درمانگر")+" | پروفایل متخصص | یادشین";
    const description=document.querySelector('meta[name="description"]');
    if(description)description.content="اطلاعات عمومی و تأییدشدهٔ "+(data.display_name||"درمانگر")+" شامل تحصیلات، حوزه‌های تخصصی، رویکرد و زبان‌های ارائهٔ خدمت در یادشین.";
    const ogTitle=document.querySelector('meta[property="og:title"]');if(ogTitle)ogTitle.content=document.title;
    const ogDescription=document.querySelector('meta[property="og:description"]');if(ogDescription&&description)ogDescription.content=description.content;
    root.replaceChildren();
    const hero=node("div","profile-hero");
    const profilePhoto=data.photo_path
      ?(String(data.photo_path).startsWith("http")?data.photo_path:(db.storage.from("therapist-photos").getPublicUrl(data.photo_path).data?.publicUrl||""))
      :(data.public_slug==="foruzan-shahla"?"/therapists/foruzan-shahla.jpg":data.public_slug==="niko-ghasemi"?"/therapists/niko-ghasemi.jpg":"");
    if(profilePhoto){
      const img=node("img","profile-photo");img.src=profilePhoto;img.alt=t("profilePhotoAlt");img.loading="lazy";hero.append(img);
    } else {
      const mark=node("div","profile-monogram",data.public_slug==="niko-ghasemi"?"ن":"ی");
      mark.setAttribute("aria-hidden","true");
      hero.append(mark);
    }
    const intro=node("div","profile-intro");
    intro.append(node("span","eyebrow",data.verified_at?t("profileVerified"):"تأییدشده توسط مدیریت یادشین"));
    intro.append(node("h1","",data.display_name||t("profileNoName")));
    if(data.headline)intro.append(node("p","profile-headline",data.public_slug==="niko-ghasemi"?localizedNikoText(data.headline):data.headline));
    if(data.public_slug!=="niko-ghasemi"&&typeof publicMeta.accepting_new_clients==="boolean")intro.append(node("span",publicMeta.accepting_new_clients?"availability-open":"availability-closed",t(publicMeta.accepting_new_clients?"profileAcceptingYes":"profileAcceptingNo")));
    intro.append(node("p","profile-session",data.public_slug==="niko-ghasemi"?(document.documentElement.lang==="en"?"45-minute session":document.documentElement.lang==="ar"?"جلسة لمدة ٤٥ دقيقة":"جلسهٔ ۴۵ دقیقه‌ای"):t("profileSession")));
    hero.append(intro);root.append(hero);
    const grid=node("div","profile-content-grid");
    const main=node("div","profile-main");
    if(data.biography){const bio=node("section","profile-section");bio.append(node("h2","",t("profileAbout")),node("p","profile-biography",data.public_slug==="niko-ghasemi"?localizedNikoText(data.biography):data.biography));main.append(bio);}
    const qualifications=data.public_slug==="niko-ghasemi"?(nikoTranslations[document.documentElement.lang]?.qualifications||list(data.qualifications)):list(data.qualifications);
    if(qualifications.length)main.append(section(t("profileQualifications"),qualifications));
    const specialties=data.public_slug==="niko-ghasemi"?(nikoTranslations[document.documentElement.lang]?.specialties||list(data.specialties)):list(data.specialties);
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
    const cta=node("a","button primary full-button",t("profileChoose"));
    cta.href="client.html?therapist="+encodeURIComponent(data.id);
    aside.append(cta);
    aside.append(node("p","profile-muted",t("profileBookingNote")));
    grid.append(main,aside);root.append(grid);
  }
  load();
  document.addEventListener("yad:languagechange",load);
})();