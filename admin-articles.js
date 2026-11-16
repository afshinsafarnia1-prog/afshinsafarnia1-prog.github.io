(() => {
 const ready=()=>{
  const root=document.getElementById("yadAdminArticles");
  if(!root||!window.supabase?.createClient)return;
  const cfg=window.YAD_SUPABASE_CONFIG||{};if(!cfg.url||!cfg.anonKey)return;
  const db=window.supabase.createClient(cfg.url,cfg.anonKey);
  const status=document.getElementById("yadAdminArticlesStatus");
  const node=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!=null)e.textContent=value;return e;};
  async function load(){
   root.replaceChildren();status.textContent="در حال دریافت مقاله‌های ارسالی…";
   const {data:session}=await db.auth.getSession();
   if(!session.session){status.textContent="برای بررسی مقاله‌ها وارد حساب مدیر شوید.";return;}
   const {data:aal}=await db.auth.mfa.getAuthenticatorAssuranceLevel();
   const {data:profile}=await db.from("profiles").select("role").eq("id",session.session.user.id).maybeSingle();
   if(aal?.currentLevel!=="aal2"||profile?.role!=="admin"){status.textContent="دسترسی به بررسی مقاله‌ها فقط برای مدیر با ورود دومرحله‌ای فعال است.";return;}
   const {data,error}=await db.rpc("admin_list_therapist_articles");
   if(error){status.textContent=error.message||"بارگذاری مقاله‌ها ناموفق بود.";return;}
   if(!data?.length){status.textContent="مقاله‌ای برای بررسی ارسال نشده است.";return;}
   status.textContent="تعداد مقاله‌ها: "+data.length;
   data.forEach(a=>{
    const card=node("article","portal-card");card.append(node("h3","",a.title));
    card.append(node("p","muted","نویسنده: "+a.therapist_name+" · زبان: "+a.language+" · وضعیت: "+a.status));
    card.append(node("p","",a.excerpt));
    const preview=node("details","");const summary=node("summary","", "مشاهده متن کامل");preview.append(summary,node("pre","article-submission-body",a.body));card.append(preview);
    const note=node("textarea","");note.rows=2;note.maxLength=2000;note.placeholder="یادداشت ویرایشی برای نویسنده (اختیاری)";note.value=a.editor_note||"";card.append(note);
    const actions=node("div","filter-actions");
    const publish=node("button","button primary","تأیید و انتشار");publish.type="button";
    const revise=node("button","button outline","درخواست اصلاح");revise.type="button";
    const reject=node("button","button outline","رد مقاله");reject.type="button";
    publish.addEventListener("click",async()=>{const slug="therapist-article-"+a.id.slice(0,8);await review(a,"published",note.value,slug,publish);});
    revise.addEventListener("click",async()=>review(a,"revision_requested",note.value,null,revise));
    reject.addEventListener("click",async()=>review(a,"rejected",note.value,null,reject));
    actions.append(publish,revise,reject);card.append(actions);root.append(card);
   });
  }
  async function review(a,state,note,slug,button){
   button.disabled=true;
   const {error}=await db.rpc("admin_review_therapist_article",{p_article_id:a.id,p_status:state,p_editor_note:note.trim()||null,p_slug:slug});
   if(error){button.disabled=false;status.textContent=error.message||"ثبت تصمیم مدیر ناموفق بود.";return;}
   await load();
  }
  document.getElementById("yadRefreshArticles")?.addEventListener("click",load);
  db.auth.getSession().then(load);db.auth.onAuthStateChange(()=>load());
 };
 if(document.readyState==="complete")ready();else window.addEventListener("load",ready,{once:true});
})();