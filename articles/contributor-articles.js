(() => {
 const ready=()=>{
  const root=document.getElementById("yadContributorArticles");
  const detail=document.getElementById("yadContributorArticleDetail");
  if(!root||!window.supabase?.createClient)return;
  const cfg=window.YAD_SUPABASE_CONFIG||{};if(!cfg.url||!cfg.anonKey)return;
  const db=window.supabase.createClient(cfg.url,cfg.anonKey);
  const node=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!=null)e.textContent=value;return e;};
  const slug=new URLSearchParams(location.search).get("slug");
  if(slug&&detail){
   root.hidden=true;detail.hidden=false;
   db.rpc("public_get_therapist_article",{p_slug:slug}).then(({data,error})=>{
    detail.replaceChildren();
    if(error||!data?.length){detail.append(node("p","notice","این مقاله در دسترس نیست یا منتشر نشده است."));return;}
    const a=data[0];detail.append(node("p","eyebrow","مقالات درمانگران ردیاد"),node("h1","user-content",a.title),node("p","muted","نویسنده: "+a.therapist_name+" · "+({fa:"فارسی",ku:"کوردی",en:"English",tr:"ترکی",ar:"عربی",es:"اسپانیایی",de:"آلمانی",fr:"فرانسوی"}[a.language]||a.language)));
    if(a.published_at){detail.append(node("p","muted","تاریخ انتشار: "+new Intl.DateTimeFormat("fa-IR",{dateStyle:"long"}).format(new Date(a.published_at))));}
    const back=node("a","textlink","بازگشت به مجلهٔ ردیاد ←");back.href="/articles/";detail.append(back);
    document.title=a.title+" | مقالات درمانگران ردیاد";
    const description=document.querySelector('meta[name="description"]');if(description)description.content=a.title+"؛ نوشته‌ای از "+a.therapist_name+" در مجلهٔ ردیاد.";
    const canonical=document.querySelector('link[rel="canonical"]');if(canonical)canonical.href=location.origin+location.pathname+"?slug="+encodeURIComponent(slug);
    const body=node("div","article-reader user-content",a.body);detail.append(body);
   });
  }else{
   db.rpc("public_list_therapist_articles").then(({data,error})=>{
    root.replaceChildren();
    if(error){root.append(node("p","notice","دریافت مقاله‌ها در حال حاضر ممکن نیست."));return;}
    if(!data?.length){root.append(node("p","muted","هنوز مقاله‌ای از درمانگران ردیاد منتشر نشده است."));return;}
    data.forEach(a=>{
     const card=node("article","article-card");card.append(node("span","", "مقالهٔ درمانگر"),node("h2","user-content",a.title),node("p","user-content",a.excerpt),node("small","muted","نویسنده: "+a.therapist_name+" · "+({fa:"فارسی",ku:"کوردی",en:"English",tr:"ترکی",ar:"عربی",es:"اسپانیایی",de:"آلمانی",fr:"فرانسوی"}[a.language]||a.language)));
     const link=node("a","", "مطالعه مقاله ←");link.href="?slug="+encodeURIComponent(a.slug);card.append(link);root.append(card);
    });
   });
  }
 };
 if(document.readyState==="complete")ready();else window.addEventListener("load",ready,{once:true});
})();