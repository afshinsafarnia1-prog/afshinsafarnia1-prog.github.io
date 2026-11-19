(() => {
 const ready=()=>{
  const form=document.getElementById("yadTherapistArticleForm");
  const root=document.getElementById("yadTherapistArticleStatusList");
  if(!form||!root||!window.supabase?.createClient)return;
  const cfg=window.YAD_SUPABASE_CONFIG||{};if(!cfg.url||!cfg.anonKey)return;
  const db=window.supabase.createClient(cfg.url,cfg.anonKey);
  const status=document.getElementById("yadTherapistArticleStatus");
  const btn=form.querySelector('button[type="submit"]');
  const labels={pending_review:"در انتظار بررسی مدیر",revision_requested:"نیازمند اصلاح",rejected:"پذیرفته نشد",published:"منتشرشده"};
  const languages={fa:"فارسی",ku:"کوردی",en:"English",tr:"ترکی",ar:"عربی",es:"اسپانیایی",de:"آلمانی",fr:"فرانسوی"};
  const messageFor=error=>({
   verified_therapist_profile_required:"ارسال مقاله فقط برای درمانگری فعال است که پروفایل حرفه‌ای او به‌طور رسمی تأیید و منتشر شده باشد.",
   therapist_only:"برای این کار باید با حساب درمانگر وارد شوید.",
   invalid_article_content:"عنوان، خلاصه، متن یا زبان مقاله با شرایط ارسال مطابقت ندارد.",
   article_not_available_for_revision:"این مقاله در حال حاضر در وضعیت اصلاح نیست یا به حساب شما تعلق ندارد."
  }[error?.message]||"عملیات انجام نشد. لطفاً دوباره تلاش کنید.");
  const make=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!=null)e.textContent=value;return e;};
  async function openRevision(article,card,button){
   button.disabled=true;
   const {data,error}=await db.rpc("therapist_get_article_for_revision",{p_article_id:article.id});
   button.disabled=false;
   if(error){status.textContent=messageFor(error);return;}
   const a=Array.isArray(data)?data[0]:data;
   if(!a){status.textContent="نسخهٔ قابل اصلاح پیدا نشد.";return;}
   card.querySelector(".article-revision-form")?.remove();
   const editor=make("form","yad-admin-form article-revision-form");
   const add=(labelText,tag,value,attrs={})=>{
    const label=make("label","",labelText);const field=document.createElement(tag);
    Object.assign(field,attrs);field.value=value??"";label.append(field);editor.append(label);return field;
   };
   const title=add("عنوان مقاله","input",a.title,{required:true,minLength:5,maxLength:180});
   const excerpt=add("خلاصه مقاله","textarea",a.excerpt,{required:true,minLength:30,maxLength:500,rows:3});
   const body=add("متن کامل مقاله","textarea",a.body,{required:true,minLength:500,maxLength:20000,rows:10});
   const languageLabel=make("label","","زبان مقاله");const language=document.createElement("select");
   Object.entries(languages).forEach(([value,label])=>{const option=make("option","",label);option.value=value;language.append(option);});
   language.value=a.language;languageLabel.append(language);editor.append(languageLabel);
   if(a.editor_note)editor.append(make("p","notice","یادداشت مدیر: "+a.editor_note));
   const submit=make("button","button primary","ارسال نسخهٔ اصلاح‌شده برای بررسی دوباره");submit.type="submit";editor.append(submit);
   editor.addEventListener("submit",async e=>{
    e.preventDefault();submit.disabled=true;status.textContent="در حال ثبت نسخهٔ اصلاح‌شده…";
    const {error:saveError}=await db.rpc("therapist_resubmit_article",{p_article_id:a.id,p_title:title.value.trim(),p_excerpt:excerpt.value.trim(),p_body:body.value.trim(),p_language:language.value});
    submit.disabled=false;
    if(saveError){status.textContent=messageFor(saveError);return;}
    status.textContent="نسخهٔ اصلاح‌شده دریافت شد و دوباره در صف بررسی مدیر قرار گرفت.";
    await load();
   });
   card.append(editor);editor.scrollIntoView?.({behavior:"smooth",block:"nearest"});
  }
  async function load(){
   root.replaceChildren();
   const {data,error}=await db.rpc("therapist_list_my_articles");
   if(error){root.textContent=messageFor(error);return;}
   if(!data?.length){root.textContent="هنوز مقاله‌ای ارسال نکرده‌اید.";return;}
   data.forEach(a=>{
    const card=make("article","portal-card");card.append(make("h4","",a.title));
    card.append(make("p","muted",labels[a.status]||"وضعیت نامشخص"));
    if(a.submitted_at)card.append(make("small","muted","تاریخ ارسال: "+new Intl.DateTimeFormat("fa-IR",{dateStyle:"medium"}).format(new Date(a.submitted_at))));
    if(a.editor_note)card.append(make("p","","یادداشت مدیر: "+a.editor_note));
    if(a.status==="revision_requested"){
     const edit=make("button","button outline","ویرایش و ارسال دوباره");edit.type="button";
     edit.addEventListener("click",()=>openRevision(a,card,edit));card.append(edit);
    }
    if(a.slug&&a.status==="published"){const link=make("a","","مشاهده مقاله منتشرشده");link.href="/articles/?slug="+encodeURIComponent(a.slug);card.append(link);}
    root.append(card);
   });
  }
  form.addEventListener("submit",async e=>{
   e.preventDefault();btn.disabled=true;status.textContent="در حال ارسال برای بررسی مدیر…";
   let result;
   try{result=await db.rpc("therapist_submit_article",{
    p_title:document.getElementById("yadArticleTitle").value.trim(),
    p_excerpt:document.getElementById("yadArticleExcerpt").value.trim(),
    p_body:document.getElementById("yadArticleBody").value.trim(),
    p_language:document.getElementById("yadArticleLanguage").value
   });}catch(error){result={error};}
   btn.disabled=false;
   if(result?.error){status.textContent=messageFor(result.error);return;}
   status.textContent="مقاله با موفقیت دریافت شد. تا پایان بررسی علمی و اخلاقی و تأیید مدیر، در سایت عمومی نمایش داده نخواهد شد.";
   form.reset();await load();
  });
  const init=async()=>{
   const {data}=await db.auth.getSession();
   if(data?.session?.user){const {data:p}=await db.from("profiles").select("role").eq("id",data.session.user.id).maybeSingle();if(p?.role==="therapist")await load();else root.textContent="این بخش فقط برای حساب درمانگر است.";}
   else root.textContent="برای ارسال مقاله وارد حساب درمانگر شوید.";
  };
  init();db.auth.onAuthStateChange(()=>init());
 };
 if(document.readyState==="complete")ready();else window.addEventListener("load",ready,{once:true});
})();