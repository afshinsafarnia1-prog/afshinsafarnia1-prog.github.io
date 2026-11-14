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
    let directory = [];
    let activeUser = null;
    const setStatus = (message, bad = false) => {
      status.textContent = message;
      status.dataset.error = bad ? "true" : "false";
    };

    async function loadDirectory() {
      const { data, error } = await db.from("therapists")
        .select("id,display_name,headline,languages,specialties,fee_amount,fee_currency")
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
        title.textContent = item.therapist_name + " · " + item.amount + " " + item.currency;
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

    async function init(session) {
      if (!session?.user || activeUser === session.user.id) return;
      activeUser = session.user.id;
      const { data: profile, error: profileError } = await db.from("profiles")
        .select("role").eq("id", activeUser).maybeSingle();
      if (profileError || profile?.role !== "client") {
        setStatus("این بخش فقط برای حساب مراجع فعال است.", true);
        return;
      }
      try { await loadDirectory(); await loadHistory(); }
      catch (error) { setStatus(error.message || "بارگذاری اطلاعات ناموفق بود.", true); }
    }

    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!activeUser) { setStatus("برای ثبت درخواست ابتدا وارد حساب مراجع شوید.", true); return; }
      if (!select.value) { setStatus("ابتدا درمانگر موردنظر را انتخاب کنید.", true); return; }
      const market = document.getElementById("yadRequestMarket").value;
      const currency = market === "iran" ? "IRR" : document.getElementById("yadRequestCurrency").value;
      const { error, data } = await db.rpc("create_client_request", {
        p_therapist_id: select.value,
        p_market: market,
        p_currency: currency,
        p_client_message: document.getElementById("yadClientMessage").value.trim() || null
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