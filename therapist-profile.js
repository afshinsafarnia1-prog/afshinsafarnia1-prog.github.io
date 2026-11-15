(() => {
  const root=document.getElementById("therapistProfile");
  if(!root)return;
  const config=window.YAD_SUPABASE_CONFIG||{};
  const db=window.supabase?.createClient&&config.url&&config.anonKey
    ?window.supabase.createClient(config.url,config.anonKey):null;
  const params=new URLSearchParams(window.location.search);
  const id=params.get("id");
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