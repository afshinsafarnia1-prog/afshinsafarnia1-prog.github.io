(() => {
  const ready = () => {
    const form = document.getElementById("yadClientRequestForm");
    if (!form || !window.supabase?.createClient) return;
    const cfg = window.YAD_SUPABASE_CONFIG || {};
    if (!cfg.url || !cfg.anonKey) return;
    const db = window.supabase.createClient(cfg.url, cfg.anonKey);
    const status = document.getElementById("yadClientRequestStatus");
    const select = document.getElementById("yadChosenTherapist");
    const slotSelect = document.getElementById("yadPreferredSlot");
    const countryInput = document.getElementById("yadSessionCountry");
    const history = document.getElementById("yadClientRequestHistory");
    const queryTherapist = new URLSearchParams(location.search).get("therapist");
    const queryWorkshop = new URLSearchParams(location.search).get("workshop");
    let directory = [];
    const feeNote=document.getElementById("yadSelectedTherapistFee");
    let activeUser = null;
    let clientIntakeEnabled = false;
    let clientPolicyVersion = "2026-11-17-v2-draft";
    const setStatus = (message, bad = false) => {
      status.textContent = message;
      status.dataset.error = bad ? "true" : "false";
    };

    async function loadClientIntakeState() {
      const notice=document.getElementById("yadClientIntakeNotice");
      const submit=form.querySelector('button[type="submit"]');
      try {
        const {data,error}=await db.rpc("get_public_site_settings");
        if(error)throw error;
        clientIntakeEnabled=data?.client_intake_enabled===true;
        clientPolicyVersion=data?.client_policy_version||"2026-11-17-v2-draft";
        if(submit)submit.disabled=!clientIntakeEnabled;
        if(notice)notice.textContent=clientIntakeEnabled
          ?"پذیرش درخواست فعال است. پیش از ارسال، قوانین و اطلاعیهٔ حریم خصوصی را مطالعه کنید."
          :"ثبت درخواست جدید فعلاً غیرفعال است. یادشین پس از تکمیل بررسی‌های حقوقی و فعال‌سازی رسمی، پذیرش را آغاز می‌کند.";
      } catch(error) {
        clientIntakeEnabled=false;
        if(submit)submit.disabled=true;
        if(notice)notice.textContent="وضعیت پذیرش قابل تأیید نیست؛ برای حفظ امنیت، ثبت درخواست موقتاً غیرفعال است.";
      }
    }

    async function loadDirectory() {
      const { data, error } = await db.from("therapists")
        .select("id,display_name,headline,languages,specialties,modalities")
        .eq("is_listed", true).not("verified_at", "is", null)
        .order("display_name", { ascending: true });
      if (error) throw error;
      directory = data || [];
      const {data:feeRows,error:feeError}=await db.rpc("get_public_therapist_fee_directory");
      if(feeError)throw feeError;
      const feesByTherapist=new Map();
      (feeRows||[]).forEach(row=>{if(!feesByTherapist.has(row.therapist_id))feesByTherapist.set(row.therapist_id,[]);feesByTherapist.get(row.therapist_id).push(row);});
      directory=directory.map(t=>({...t,fees:feesByTherapist.get(t.id)||[]}));
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
      if (select.value) await loadAvailableSlots();
      updateSelectedFee();
      if (!directory.length) setStatus("در حال حاضر پروفایل تأییدشده‌ای برای انتخاب منتشر نشده است.");
    }

    function updateSelectedFee(){
      if(!feeNote)return;
      const therapist=directory.find(t=>t.id===select.value);
      if(!therapist){feeNote.textContent="پس از انتخاب درمانگر، تعرفهٔ همان متخصص نمایش داده می‌شود.";return;}
      const market=document.getElementById("yadRequestMarket").value;
      const currency=market==="iran"?"IRR":document.getElementById("yadRequestCurrency").value;
      const fee=(therapist.fees||[]).find(x=>x.currency===currency);
      feeNote.textContent=fee
        ?"تعرفهٔ این درمانگر: "+new Intl.NumberFormat(document.documentElement.lang==="fa"?"fa-IR":"en-GB").format(currency==="IRR"?Number(fee.amount)/10:Number(fee.amount))+(currency==="IRR"?" تومان":" "+currency)+" · هر جلسه ۴۵ دقیقه"
        :"این درمانگر هنوز تعرفه‌ای برای ارز انتخاب‌شده ثبت نکرده است؛ لطفاً ارز دیگری انتخاب کنید یا با مدیریت تماس بگیرید.";
    }
    async function loadAvailableSlots() {
      if (!slotSelect) return;
      slotSelect.replaceChildren();
      const country=(countryInput?.value||"").trim().toUpperCase();
      if(!select.value){slotSelect.add(new Option("ابتدا درمانگر را انتخاب کنید",""));return;}
      if(!/^[A-Z]{2}$/.test(country)){slotSelect.add(new Option("ابتدا کشور محل حضور را وارد کنید",""));return;}
      slotSelect.add(new Option("در حال دریافت زمان‌های آزاد…",""));
      const {data,error}=await db.rpc("client_list_available_slots",{p_therapist_id:select.value,p_country_code:country});
      slotSelect.replaceChildren();
      slotSelect.add(new Option(error?"زمان‌های آزاد در دسترس نیست":(data?.length?"زمان دلخواه را انتخاب کنید":"فعلاً زمان آزادی برای این درمانگر ثبت نشده است"),""));
      if(error){setStatus(error.message||"دریافت زمان‌های آزاد ناموفق بود.",true);return;}
      (data||[]).forEach(slot=>{
        const label=new Intl.DateTimeFormat(document.documentElement.lang||"fa-IR",{dateStyle:"medium",timeStyle:"short",timeZone:slot.timezone||undefined}).format(new Date(slot.starts_at));
        slotSelect.add(new Option(label+" · "+(slot.timezone||""),slot.slot_id));
      });
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
          const hint=document.createElement("p");hint.textContent="پس از پرداخت به یادشین، شماره پیگیری را ثبت کنید؛ لینک ورود پس از تأیید پرداخت نمایش داده می‌شود.";
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

    select.addEventListener("change",()=>{loadAvailableSlots();updateSelectedFee();});
    document.getElementById("yadRequestMarket").addEventListener("change",updateSelectedFee);
    document.getElementById("yadRequestCurrency").addEventListener("change",updateSelectedFee);
    countryInput?.addEventListener("change",loadAvailableSlots);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!clientIntakeEnabled) { setStatus("ثبت درخواست جدید فعلاً غیرفعال است.", true); return; }
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
        p_client_message: [document.getElementById("yadPreferredTime")?.value.trim() ? "زمان‌های پیشنهادی (غیرقطعی): " + document.getElementById("yadPreferredTime").value.trim() : "", document.getElementById("yadClientMessage").value.trim()].filter(Boolean).join("\n").slice(0, 500) || null,
        p_policy_version: clientPolicyVersion,
        p_adult_confirmation: true,
        p_country_code: sessionCountry,
        p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tehran",
        p_preferred_slot_id: slotSelect?.value || null
      });
      if (error) {
        const raw=error.message||"";
        const friendly=raw.includes("therapist_not_accepting_new_clients")?"این درمانگر در حال حاضر پذیرش مراجع جدید ندارد."
          :raw.includes("therapist_not_authorized_for_client_location")?"مجوز ارائهٔ خدمت این درمانگر برای کشور محل حضور شما تأیید نشده است."
          :raw.includes("therapist_not_available")?"این پروفایل دیگر برای ثبت درخواست فعال نیست."
          :raw.includes("client_intake_paused")?"ثبت درخواست جدید فعلاً غیرفعال است."
          :raw.includes("current_policy_version_required")?"نسخهٔ نهایی قوانین هنوز تأیید نشده است."
          :raw.includes("create_client_request_with_consent")?"زیرساخت تکمیلی هنوز روی پایگاه داده فعال نشده است."
          :raw.includes("therapist_fee_not_configured_for_currency")?"این درمانگر برای واحد پول انتخاب‌شده تعرفه ثبت نکرده است.":raw;
        setStatus(friendly||"ثبت درخواست ناموفق بود.", true); return;
      }
      setStatus("درخواست ثبت شد. اطلاعات پرداخت را از مدیریت یادشین دریافت کنید؛ پس از پرداخت، شماره پیگیری را در همین صفحه وارد کنید.");
      form.reset();
      await loadHistory();
    });

    loadClientIntakeState().finally(()=>db.auth.getSession().then(({ data }) => init(data.session)));
    db.auth.onAuthStateChange((_event, session) => {
      if (session) init(session);
      else { activeUser = null; }
    });
  };
  if (document.readyState === "complete") ready();
  else window.addEventListener("load", ready, { once: true });
})();