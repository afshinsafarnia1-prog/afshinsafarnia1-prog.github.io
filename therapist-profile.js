(() => {
  const root=document.getElementById("therapistProfile");
  if(!root)return;
  const config=window.YAD_SUPABASE_CONFIG||{};
  const db=window.supabase?.createClient&&config.url&&config.anonKey
    ?window.supabase.createClient(config.url,config.anonKey):null;
  const params=new URLSearchParams(window.location.search);
  const id=params.get("id");
  const names={fa:"فارسی",ku:"کوردی",en:"English",tr:"ترکی",ar:"عربی",es:"اسپانیایی",de:"آلمانی",fr:"فرانسوی"};
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
    if(!db){root.textContent="اتصال به سامانه در دسترس نیست. لطفاً بعداً دوباره تلاش کنید.";return;}
    if(!id){root.textContent="نشانی پروفایل کامل نیست.";return;}
    root.textContent="در حال دریافت اطلاعات متخصص…";
    const {data,error}=await db.from("therapists")
      .select("id,public_slug,display_name,headline,biography,qualifications,specialties,languages,modalities,photo_path")
      .eq("id",id).eq("is_listed",true).not("verified_at","is",null).maybeSingle();
    if(error||!data){root.textContent="این پروفایل در دسترس نیست یا هنوز برای نمایش تأیید نشده است.";return;}
    root.replaceChildren();
    const hero=node("div","profile-hero");
    if(data.photo_path){
      const {data:photo}=db.storage.from("therapist-photos").getPublicUrl(data.photo_path);
      if(photo?.publicUrl){const img=node("img","profile-photo");img.src=photo.publicUrl;img.alt="تصویر "+(data.display_name||"درمانگر");img.loading="lazy";hero.append(img);}
    }
    const intro=node("div","profile-intro");
    intro.append(node("span","eyebrow","درمانگر تأییدشدهٔ یادسنتر"));
    intro.append(node("h1","",data.display_name||""));
    if(data.headline)intro.append(node("p","profile-headline",data.headline));
    intro.append(node("p","profile-session","جلسهٔ ۴۵ دقیقه‌ای · تعرفهٔ یکسان مرکزی"));
    hero.append(intro);root.append(hero);
    const grid=node("div","profile-content-grid");
    const main=node("div","profile-main");
    if(data.biography){const bio=node("section","profile-section");bio.append(node("h2","","دربارهٔ درمانگر"),node("p","profile-biography",data.biography));main.append(bio);}
    const qualifications=list(data.qualifications);
    if(qualifications.length)main.append(section("تحصیلات و سوابق حرفه‌ای",qualifications));
    const specialties=list(data.specialties);
    if(specialties.length)main.append(section("حوزه‌های تخصصی",specialties));
    const modalities=list(data.modalities);
    if(modalities.length)main.append(section("رویکردها و شیوه‌های کار",modalities));
    const languages=list(data.languages).map(x=>names[x]||x);
    if(languages.length)main.append(section("زبان‌های گفت‌وگو",languages));
    const aside=node("aside","profile-aside");
    const price=node("section","profile-section");
    price.append(node("h2","","تعرفهٔ جلسه"));
    const {data:settings}=await db.rpc("get_public_site_settings");
    const tariffs=settings?.tariffs||[];
    const labels=[["iran","IRR","داخل ایران"],["international","EUR","بین‌المللی · یورو"],["international","USD","بین‌المللی · دلار"]];
    labels.forEach(([market,currency,label])=>{
      const item=tariffs.find(x=>x.market===market&&x.currency===currency);
      price.append(node("p","profile-price",label+" · "+(item?new Intl.NumberFormat("fa-IR").format(currency==="IRR"?Number(item.amount)/10:Number(item.amount))+(currency==="IRR"?" تومان":" "+currency):"در حال تنظیم")));
    });
    price.append(node("small","profile-muted","همهٔ تعرفه‌ها برای جلسهٔ ۴۵ دقیقه‌ای است."));
    aside.append(price);
    const cta=node("a","button primary full-button","انتخاب این درمانگر و ثبت درخواست");
    cta.href="client.html?therapist="+encodeURIComponent(data.id);
    aside.append(cta);
    const note=node("p","profile-muted","ثبت درخواست به‌تنهایی به معنای قطعی‌شدن نوبت نیست؛ هماهنگی پس از طی مراحل پرداخت و تأیید انجام می‌شود.");
    aside.append(note);
    grid.append(main,aside);root.append(grid);
  }
  load();
})();