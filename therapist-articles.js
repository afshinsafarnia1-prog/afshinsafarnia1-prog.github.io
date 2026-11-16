(() => {
 const ready=()=>{
  const form=document.getElementById("yadTherapistArticleForm");
  const root=document.getElementById("yadTherapistArticleStatusList");
  if(!form||!root||!window.supabase?.createClient)return;
  const cfg=window.YAD_SUPABASE_CONFIG||{};if(!cfg.url||!cfg.anonKey)return;
  const db=window.supabase.createClient(cfg.url,cfg.anonKey);
  const status=document.getElementById("yadTherapistArticleStatus");
  const btn=form.querySelector('button[type="submit"]');
  const label={pending_review:"در انتظار بررسی مدیر",revision_requested:"نیازمند اصلاح",rejected:"منتشر نخواهد شد",published:"منتشرشده"};
  async function load(){
   root.replaceChildren();
   const {data,error}=await db.rpc("therapist_list_my_articles");
   if(error){root.textContent=error.message||"دریافت وضعیت مقاله‌ها ناموفق بود.";return;}
   if(!data?.length){root.textContent="هنوز مقاله‌ای ارسال نکرده‌اید.";return;}
   data.forEach(a=>{
    const card=document.createElement("article");card.className="portal-card";
    const h=document.createElement("h4");h.textContent=a.title;card.append(h);
    const p=document.createElement("p");p.className="muted";p.textContent=label[a.status]||a.status;card.append(p);
    if(a.editor_note){const note=document.createElement("p");note.textContent="یادداشت مدیر: "+a.editor_note;card.append(note);}
    if(a.slug&&a.status==="published"){const link=document.createElement("a");link.href="/articles/?slug="+encodeURIComponent(a.slug);link.textContent="مشاهده مقاله منتشرشده";card.append(link);}
    root.append(card);
   });
  }
  form.addEventListener("submit",async e=>{
   e.preventDefault();btn.disabled=true;status.textContent="در حال ارسال برای بررسی مدیر…";
   const {error}=await db.rpc("therapist_submit_article",{
    p_title:document.getElementById("yadArticleTitle").value.trim(),
    p_excerpt:document.getElementById("yadArticleExcerpt").value.trim(),
    p_body:document.getElementById("yadArticleBody").value.trim(),
    p_language:document.getElementById("yadArticleLanguage").value
   });
   btn.disabled=false;
   if(error){status.textContent=error.message==="verified_therapist_profile_required"?"ارسال مقاله فقط برای درمانگر دارای پروفایل تأییدشده و منتشرشده فعال است.":error.message||"ارسال مقاله ناموفق بود.";return;}
   status.textContent="مقاله ثبت شد و تا زمان تأیید مدیر در سایت عمومی نمایش داده نمی‌شود.";
   form.reset();await load();
  });
  const init=async()=>{const {data}=await db.auth.getSession();if(data?.session?.user){const {data:p}=await db.from("profiles").select("role").eq("id",data.session.user.id).maybeSingle();if(p?.role==="therapist")await load();else root.textContent="این بخش فقط برای حساب درمانگر است.";}else root.textContent="برای ارسال مقاله وارد حساب درمانگر شوید.";};
  init();db.auth.onAuthStateChange(()=>init());
 };
 if(document.readyState==="complete")ready();else window.addEventListener("load",ready,{once:true});
})();