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
    const a=data[0];detail.append(node("h1","",a.title),node("p","muted","نویسنده: "+a.therapist_name));
    const body=node("div","article-reader",a.body);detail.append(body);
   });
  }else{
   db.rpc("public_list_therapist_articles").then(({data,error})=>{
    root.replaceChildren();
    if(error){root.append(node("p","notice","دریافت مقاله‌ها در حال حاضر ممکن نیست."));return;}
    if(!data?.length){root.append(node("p","muted","مقاله‌ای از درمانگران یادسنتر هنوز منتشر نشده است."));return;}
    data.forEach(a=>{
     const card=node("article","article-card");card.append(node("span","", "نوشتهٔ درمانگران یادسنتر"),node("h2","",a.title),node("p","",a.excerpt),node("small","muted","نویسنده: "+a.therapist_name));
     const link=node("a","", "مطالعه مقاله ←");link.href="?slug="+encodeURIComponent(a.slug);card.append(link);root.append(card);
    });
   });
  }
 };
 if(document.readyState==="complete")ready();else window.addEventListener("load",ready,{once:true});
})();