(() => {
 const ready=()=>{
  const form=document.getElementById("yadTherapistArticleForm");
  const root=document.getElementById("yadTherapistArticleStatusList");
  if(!form||!root||!window.supabase?.createClient)return;
  const cfg=window.YAD_SUPABASE_CONFIG||{};if(!cfg.url||!cfg.anonKey)return;
  const db=window.supabase.createClient(cfg.url,cfg.anonKey);
  const status=document.getElementById("yadTherapistArticleStatus");
  const btn=form.querySelector('button[type="submit"]');
  const label={pending_review:"در انتظار بررسی مدیر",revision_requested:"نیازمند اصلاح",rejected:"پذیرفته نشد",published:"منتشرشده"};
  async function load(){
   root.replaceChildren();
   const {data,error}=await db.rpc("therapist_list_my_articles");
   if(error){root.textContent=error.message||"دریافت وضعیت مقاله‌ها ناموفق بود.";return;}
   if(!data?.length){root.textContent="هنوز مقاله‌ای ارسال نکرده‌اید.";return;}
   data.forEach(a=>{
    const card=document.createElement("article");card.className="portal-card";
    const h=document.createElement("h4");h.textContent=a.title;card.append(h);
    const p=document.createElement("p");p.className="muted";p.textContent=label[a.status]||"وضعیت نامشخص";card.append(p);
    if(a.submitted_at){const date=document.createElement("small");date.className="muted";date.textContent="تاریخ ارسال: "+new Intl.DateTimeFormat("fa-IR",{dateStyle:"medium"}).format(new Date(a.submitted_at));card.append(date);}
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
   if(error){const messages={verified_therapist_profile_required:"ارسال مقاله فقط برای درمانگری فعال است که پروفایل حرفه‌ای او تأیید و منتشر شده باشد.",therapist_only:"برای ارسال مقاله باید با حساب درمانگر وارد شوید.",invalid_article_content:"عنوان، خلاصه، متن یا زبان مقاله با شرایط ارسال مطابقت ندارد."};status.textContent=messages[error.message]||"ارسال مقاله انجام نشد. لطفاً اطلاعات را بررسی کنید و دوباره تلاش کنید.";return;}
   status.textContent="مقاله با موفقیت دریافت شد. تا پایان بررسی علمی و اخلاقی و تأیید مدیر، در سایت عمومی نمایش داده نخواهد شد."
   form.reset();await load();
  });
  const init=async()=>{const {data}=await db.auth.getSession();if(data?.session?.user){const {data:p}=await db.from("profiles").select("role").eq("id",data.session.user.id).maybeSingle();if(p?.role==="therapist")await load();else root.textContent="این بخش فقط برای حساب درمانگر است.";}else root.textContent="برای ارسال مقاله وارد حساب درمانگر شوید.";};
  init();db.auth.onAuthStateChange(()=>init());
 };
 if(document.readyState==="complete")ready();else window.addEventListener("load",ready,{once:true});
})();