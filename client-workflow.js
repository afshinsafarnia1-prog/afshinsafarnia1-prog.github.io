(() => {
  const ready = () => {
    const form = document.getElementById("yadClientRequestForm");
    if (!form || !window.supabase?.createClient) return;
    const cfg = window.YAD_SUPABASE_CONFIG || {};
    if (!cfg.url || !cfg.anonKey) return;
    const db = window.supabase.createClient(cfg.url, cfg.anonKey);
    const status = document.getElementById("yadClientRequestStatus");
    const select = document.getElementById("yadChosenTherapist");
    const history = document.getElementById("yadClientRequestHistory");
    const queryTherapist = new URLSearchParams(location.search).get("therapist");
    const queryWorkshop = new URLSearchParams(location.search).get("workshop");
    let directory = [];
    let activeUser = null;
    const setStatus = (message, bad = false) => {
      status.textContent = message;
      status.dataset.error = bad ? "true" : "false";
    };

    async function loadDirectory() {
      const { data, error } = await db.from("therapists")
        .select("id,display_name,headline,languages,specialties,modalities")
        .eq("is_listed", true).not("verified_at", "is", null)
        .order("display_name", { ascending: true });
      if (error) throw error;
      directory = data || [];
      select.replaceChildren();
      const first = document.createElement("option");
      first.value = ""; first.textContent = "انتخاب درمانگر";
      select.append(first);
      directory.forEach(t => {
        const option = document.createElement("option");
        option.value = t.id;
        option.textContent = t.display_name + (t.headline ? " — " + t.headline : "");
        select.append(option);
      });
      if (queryTherapist && directory.some(t => t.id === queryTherapist)) select.value = queryTherapist;
      if (!directory.length) setStatus("در حال حاضر پروفایل تأییدشده‌ای برای انتخاب منتشر نشده است.");
    }

    async function loadHistory() {
      const { data, error } = await db.rpc("client_list_requests");
      if (error) throw error;
      history.replaceChildren();
      if (!data?.length) {
        history.textContent = "هنوز درخواستی ثبت نکرده‌اید.";
        return;
      }
      data.forEach(item => {
        const card = document.createElement("article");
        card.className = "portal-card";
        const title = document.createElement("b");
        title.textContent = item.therapist_name + " · " + new Intl.NumberFormat("fa-IR").format(item.currency === "IRR" ? Number(item.amount)/10 : Number(item.amount)) + (item.currency === "IRR" ? " تومان" : " " + item.currency);
        const detail = document.createElement("p");
        detail.textContent = "وضعیت درخواست: " + item.request_status + " | وضعیت پرداخت: " + (item.payment_status || "نامشخص");
        card.append(title, detail);
        if (item.request_status === "awaiting_payment" && item.payment_id) {
          const help = document.createElement("p");
          help.textContent = "پس از دریافت اطلاعات پرداخت از مدیریت و واریز وجه، شماره پیگیری را ثبت کنید.";
          const input = document.createElement("input");
          input.type = "text"; input.maxLength = 120; input.placeholder = "شماره پیگیری پرداخت";
          const button = document.createElement("button");
          button.type = "button"; button.className = "button primary"; button.textContent = "ارسال شماره پیگیری";
          button.addEventListener("click", async () => {
            if (input.value.trim().length < 4) { setStatus("شماره پیگیری معتبر وارد کنید.", true); return; }
            const { error: refError } = await db.rpc("submit_manual_payment_reference", {
              p_payment_id: item.payment_id, p_reference: input.value.trim()
            });
            if (refError) { setStatus(refError.message || "ثبت شماره پیگیری ناموفق بود.", true); return; }
            setStatus("شماره پیگیری ثبت شد و برای بررسی به مدیریت ارسال شد.");
            await loadHistory();
          });
          card.append(help, input, button);
        }
        history.append(card);
      });
    }


    async function registerForRequestedWorkshop(){
      if(!queryWorkshop)return;
      const {error}=await db.rpc("register_for_workshop",{p_workshop_id:queryWorkshop});
      if(error){setStatus(error.message==="event_full"?"ظرفیت این کارگاه تکمیل شده است.":error.message==="registration_closed"?"مهلت ثبت‌نام این رویداد پایان یافته است.":"ثبت‌نام انجام نشد؛ لطفاً رویداد را بررسی کنید.",true);return;}
      setStatus("درخواست ثبت‌نام شما در کارگاه ثبت شد. وضعیت و اطلاعات ورود را در بخش رویدادهای من می‌بینید.");
      await loadWorkshopRegistrations();
    }
    async function loadWorkshopRegistrations(){
      const {data,error}=await db.rpc("client_list_workshop_registrations");
      if(error){setStatus(error.message||"بارگذاری کارگاه‌های من ناموفق بود.",true);return;}
      let box=document.getElementById("yadClientWorkshopRegistrations");
      if(!box)return;box.replaceChildren();
      if(!data?.length){box.textContent="هنوز در کارگاهی ثبت‌نام نکرده‌اید.";return;}
      data.forEach(item=>{
        const card=document.createElement("article");card.className="portal-card";
        const title=document.createElement("b");title.textContent=item.title;
        const detail=document.createElement("p");detail.textContent=new Date(item.starts_at).toLocaleString()+" · "+item.status+" · "+item.platform;
        card.append(title,detail);
        if(item.status==="pending_payment"){
          const hint=document.createElement("p");hint.textContent="پس از پرداخت به یادسنتر، شماره پیگیری را ثبت کنید؛ لینک ورود پس از تأیید پرداخت نمایش داده می‌شود.";
          const input=document.createElement("input");input.maxLength=120;input.placeholder="شماره پیگیری پرداخت";
          const btn=document.createElement("button");btn.type="button";btn.className="button primary";btn.textContent="ارسال شماره پیگیری";
          btn.addEventListener("click",async()=>{const {error}=await db.rpc("client_submit_workshop_payment_reference",{p_registration_id:item.registration_id,p_reference:input.value.trim()});if(error){setStatus(error.message||"ثبت شماره پیگیری ناموفق بود.",true);return;}setStatus("شماره پیگیری برای بررسی ارسال شد.");await loadWorkshopRegistrations();});
          card.append(hint,input,btn);
        }
        if(item.meeting_url){
          const link=document.createElement("a");link.href=item.meeting_url;link.target="_blank";link.rel="noopener noreferrer";link.className="button primary";link.textContent="ورود به جلسه آنلاین";
          card.append(link);
          if(item.meeting_password){const pass=document.createElement("p");pass.textContent="رمز جلسه: "+item.meeting_password;card.append(pass);}
        }
        box.append(card);
      });
    }

    async function init(session) {
      if (!session?.user || activeUser === session.user.id) return;
      activeUser = session.user.id;
      const { data: profile, error: profileError } = await db.from("profiles")
        .select("role").eq("id", activeUser).maybeSingle();
      if (profileError || profile?.role !== "client") {
        setStatus("این بخش فقط برای حساب مراجع فعال است.", true);
        return;
      }
      try { await loadDirectory(); await loadHistory(); await registerForRequestedWorkshop(); await loadWorkshopRegistrations(); }
      catch (error) { setStatus(error.message || "بارگذاری اطلاعات ناموفق بود.", true); }
    }

    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!activeUser) { setStatus("برای ثبت درخواست ابتدا وارد حساب مراجع شوید.", true); return; }
      if (!select.value) { setStatus("ابتدا درمانگر موردنظر را انتخاب کنید.", true); return; }
      if (!document.getElementById("yadClientConsent")?.checked) { setStatus("برای ثبت درخواست، تأیید مطالعهٔ اطلاعیه و شرایط لازم است.", true); return; }
      if (!document.getElementById("yadAdultConfirm")?.checked) { setStatus("ثبت درخواست فقط برای افراد ۱۸ سال یا بیشتر فعال است.", true); return; }
      const sessionCountry = document.getElementById("yadSessionCountry")?.value?.trim().toUpperCase() || "";
      if (!/^[A-Z]{2}$/.test(sessionCountry)) { setStatus("کد دوحرفی معتبر کشور محل حضور هنگام جلسه را وارد کنید.", true); return; }
      const market = document.getElementById("yadRequestMarket").value;
      const currency = market === "iran" ? "IRR" : document.getElementById("yadRequestCurrency").value;
      const { error, data } = await db.rpc("create_client_request_with_consent", {
        p_therapist_id: select.value,
        p_market: market,
        p_currency: currency,
        p_client_message: document.getElementById("yadClientMessage").value.trim() || null,
        p_policy_version: "2026-11-16-v1-draft",
        p_adult_confirmation: true,
        p_country_code: sessionCountry
      });
      if (error) { setStatus(error.message || "ثبت درخواست ناموفق بود.", true); return; }
      setStatus("درخواست ثبت شد. اطلاعات پرداخت را از مدیریت یادسنتر دریافت کنید؛ پس از پرداخت، شماره پیگیری را در همین صفحه وارد کنید.");
      form.reset();
      await loadHistory();
    });

    db.auth.getSession().then(({ data }) => init(data.session));
    db.auth.onAuthStateChange((_event, session) => {
      if (session) init(session);
      else { activeUser = null; }
    });
  };
  if (document.readyState === "complete") ready();
  else window.addEventListener("load", ready, { once: true });
})();