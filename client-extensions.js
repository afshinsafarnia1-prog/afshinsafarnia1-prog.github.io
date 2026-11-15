(() => {
  const ready = () => {
    const root = document.getElementById("yadClientAppointmentList");
    if (!root || !window.supabase?.createClient) return;
    const cfg = window.YAD_SUPABASE_CONFIG || {};
    if (!cfg.url || !cfg.anonKey) return;
    const db = window.supabase.createClient(cfg.url, cfg.anonKey);
    const supportForm = document.getElementById("yadClientSupportForm");
    const supportStatus = document.getElementById("yadClientSupportStatus");
    const ticketList = document.getElementById("yadClientSupportTickets");
    const related = document.getElementById("yadSupportAppointment");
    let appointments = [];
    let requests = [];
    let activeUser = null;
    const node = (tag, cls, value) => {
      const el = document.createElement(tag);
      if (cls) el.className = cls;
      if (value != null) el.textContent = value;
      return el;
    };
    const message = (text, bad = false) => {
      if (!supportStatus) return;
      supportStatus.textContent = text;
      supportStatus.dataset.error = bad ? "true" : "false";
    };
    const date = value => value ? new Intl.DateTimeFormat(document.documentElement.lang === "fa" ? "fa-IR" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
    const migrationHint = "این بخش به مهاجرت تکمیلی پایگاه داده نیاز دارد؛ پس از اعمال فایل platform-completion-2026-11.sql فعال می‌شود.";

    async function loadAppointments() {
      const { data, error } = await db.rpc("client_list_appointments");
      if (error) {
        root.replaceChildren(node("p", "notice", migrationHint));
        return;
      }
      appointments = data || [];
      root.replaceChildren();
      if (!appointments.length) {
        root.append(node("p", "muted", "هنوز جلسه‌ای برای شما زمان‌بندی نشده است."));
      }
      appointments.forEach(item => {
        const card = node("article", "portal-card yad-appointment-card");
        card.append(node("h3", "", item.therapist_name));
        card.append(node("p", "muted", date(item.starts_at) + " تا " + date(item.ends_at)));
        card.append(node("span", "status-chip", item.appointment_status === "completed" ? "تکمیل‌شده" : item.appointment_status === "cancelled" ? "لغوشده" : "تأییدشده"));
        if (item.meeting_url) {
          const link = node("a", "button primary", "ورود به جلسهٔ خصوصی");
          link.href = item.meeting_url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          card.append(link);
          if (item.meeting_password) card.append(node("p", "muted", "رمز ورود: " + item.meeting_password));
          card.append(node("p", "privacy-hint", "لینک جلسه فقط برای حساب شما نمایش داده می‌شود؛ آن را با دیگران به اشتراک نگذارید."));
        } else if (item.appointment_status === "confirmed") {
          card.append(node("p", "muted", "زمان جلسه ثبت شده است؛ لینک خصوصی پس از ثبت توسط مدیریت در همین بخش نمایش داده می‌شود."));
        }
        if (item.can_leave_feedback) {
          const form = node("form", "yad-feedback-form");
          const label = node("label", "", "ارزیابی جلسه");
          const rating = node("select");
          rating.required = true;
          [["","انتخاب امتیاز"],["5","۵ – بسیار خوب"],["4","۴ – خوب"],["3","۳ – متوسط"],["2","۲ – ضعیف"],["1","۱ – بسیار ضعیف"]].forEach(([v,l]) => {
            const option = node("option", "", l); option.value = v; rating.append(option);
          });
          label.append(rating);
          const comment = node("textarea"); comment.rows = 3; comment.maxLength = 1500;
          comment.placeholder = "بازخورد اختیاری؛ لطفاً اطلاعات شناسایی یا جزئیات محرمانه ننویسید.";
          const submit = node("button", "button outline", "ارسال بازخورد");
          submit.type = "submit";
          form.append(label, comment, submit);
          form.addEventListener("submit", async event => {
            event.preventDefault();
            submit.disabled = true;
            const { error: feedbackError } = await db.rpc("client_submit_appointment_feedback", {
              p_appointment_id: item.appointment_id,
              p_rating: Number(rating.value),
              p_feedback: comment.value.trim() || null
            });
            if (feedbackError) {
              submit.disabled = false;
              message(feedbackError.message || "ثبت بازخورد انجام نشد.", true);
              return;
            }
            message("بازخورد ثبت شد و پس از بررسی مدیریت منتشر خواهد شد.");
            await loadAppointments();
          });
          card.append(form);
        }
        root.append(card);
      });
      await populateRelatedOptions();
    }

    async function populateRelatedOptions() {
      if (!related) return;
      const [requestResult, appointmentResult] = await Promise.all([
        db.rpc("client_list_requests"),
        db.rpc("client_list_appointments")
      ]);
      requests = requestResult.data || [];
      appointments = appointmentResult.data || appointments;
      related.replaceChildren();
      const none = node("option", "", "بدون انتخاب جلسه");
      none.value = "";
      related.append(none);
      requests.forEach(item => {
        const option = node("option", "", "درخواست · " + item.therapist_name + " · " + item.request_status);
        option.value = "request:" + item.request_id;
        related.append(option);
      });
      appointments.forEach(item => {
        const option = node("option", "", "جلسه · " + item.therapist_name + " · " + date(item.starts_at));
        option.value = "appointment:" + item.appointment_id;
        related.append(option);
      });
    }

    async function loadTickets() {
      if (!ticketList) return;
      const { data, error } = await db.rpc("client_list_support_tickets");
      ticketList.replaceChildren();
      if (error) {
        ticketList.append(node("p", "muted", migrationHint));
        return;
      }
      if (!data?.length) {
        ticketList.append(node("p", "muted", "درخواستی برای پشتیبانی ثبت نشده است."));
        return;
      }
      data.forEach(item => {
        const card = node("article", "portal-card");
        const typeNames = { cancellation: "لغو جلسه", reschedule: "تغییر زمان", complaint: "شکایت", therapist_change: "تغییر درمانگر", data_request: "درخواست اطلاعات حساب", other: "سایر" };
        card.append(node("b", "", typeNames[item.ticket_type] || item.ticket_type));
        card.append(node("p", "", item.message));
        card.append(node("span", "status-chip", ({new:"جدید",in_review:"در حال بررسی",resolved:"رسیدگی شد",declined:"پذیرفته نشد"})[item.status] || item.status));
        if (item.admin_note) card.append(node("p", "privacy-hint", "پاسخ مدیریت: " + item.admin_note));
        card.append(node("small", "muted", date(item.created_at)));
        ticketList.append(card);
      });
    }

    supportForm?.addEventListener("submit", async event => {
      event.preventDefault();
      const type = document.getElementById("yadSupportType").value;
      const ref = related?.value || "";
      const [kind, id] = ref.split(":");
      if (["cancellation","reschedule","therapist_change","complaint"].includes(type) && !id) {
        message("برای این نوع درخواست، جلسه یا درخواست مرتبط را انتخاب کنید.", true);
        return;
      }
      const button = supportForm.querySelector('button[type="submit"]');
      button.disabled = true;
      const { error } = await db.rpc("client_submit_support_ticket", {
        p_ticket_type: type,
        p_message: document.getElementById("yadSupportMessage").value.trim(),
        p_request_id: kind === "request" ? id : null,
        p_appointment_id: kind === "appointment" ? id : null
      });
      button.disabled = false;
      if (error) {
        message(error.message || migrationHint, true);
        return;
      }
      supportForm.reset();
      message("درخواست شما ثبت شد؛ پاسخ مدیریت را در همین بخش پیگیری کنید.");
      await loadTickets();
    });

    document.getElementById("yadExportMyData")?.addEventListener("click", async () => {
      const button = document.getElementById("yadExportMyData");
      button.disabled = true;
      try {
        const [{ data: profile, error: profileError }, { data: requestData, error: requestError }, { data: appointmentData, error: appointmentError }, { data: ticketData, error: ticketError }] = await Promise.all([
          db.from("profiles").select("display_name,phone,country_code,preferred_language,timezone,created_at").eq("id", activeUser).maybeSingle(),
          db.rpc("client_list_requests"),
          db.rpc("client_list_appointments"),
          db.rpc("client_list_support_tickets")
        ]);
        const error = profileError || requestError || appointmentError || ticketError;
        if (error) throw error;
        const exportData = {
          exported_at: new Date().toISOString(),
          notice: "This export contains account and service metadata. Keep it private. It does not include clinical notes because YAD Center does not collect clinical records in this version.",
          profile,
          requests: requestData || [],
          appointments: appointmentData || [],
          support_tickets: ticketData || []
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = node("a"); link.href = url; link.download = "yadcenter-account-export.json";
        document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
        message("نسخهٔ اطلاعات حساب آماده شد. فایل را در محل امن نگهداری کنید.");
      } catch (error) {
        message(error.message || "دریافت نسخهٔ اطلاعات ناموفق بود.", true);
      } finally { button.disabled = false; }
    });

    async function init(session) {
      if (!session?.user || activeUser === session.user.id) return;
      activeUser = session.user.id;
      const { data: profile, error } = await db.from("profiles").select("role").eq("id", activeUser).maybeSingle();
      if (error || profile?.role !== "client") {
        root.replaceChildren(node("p", "muted", "برای مشاهدهٔ جلسات و پشتیبانی با حساب مراجع وارد شوید."));
        return;
      }
      await loadAppointments();
      await loadTickets();
    }
    db.auth.getSession().then(({ data }) => init(data.session));
    db.auth.onAuthStateChange((_event, session) => {
      if (session) init(session);
      else { activeUser = null; root.replaceChildren(node("p", "muted", "برای مشاهدهٔ جلسات وارد حساب شوید.")); }
    });
  };
  if (document.readyState === "complete") ready();
  else window.addEventListener("load", ready, { once: true });
})();
