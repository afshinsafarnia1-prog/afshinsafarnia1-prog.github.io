(() => {
  const ready = () => {
    const sessionsRoot = document.getElementById("yadSessionAccessList");
    if (!sessionsRoot || !window.supabase?.createClient) return;
    const cfg = window.YAD_SUPABASE_CONFIG || {};
    if (!cfg.url || !cfg.anonKey) return;
    const db = window.supabase.createClient(cfg.url, cfg.anonKey);
    const migrationHint = "برای فعال‌شدن این بخش، مهاجرت platform-completion-2026-11.sql باید پس از بررسی و تأیید روی پایگاه داده اعمال شود.";
    const node = (tag, cls, value) => {
      const el = document.createElement(tag);
      if (cls) el.className = cls;
      if (value != null) el.textContent = value;
      return el;
    };
    const date = (value, timeZone) => value ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short", ...(timeZone ? { timeZone } : {}) }).format(new Date(value)) : "—";
    const localDateTimeInZone = (value, timeZone) => {
      const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || "");
      if (!match) throw new Error("فرمت تاریخ و ساعت معتبر نیست.");
      const target = Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]),Number(match[4]),Number(match[5]));
      let guess = target;
      const formatter = new Intl.DateTimeFormat("en-GB",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
      for(let i=0;i<5;i++){
        const parts=Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part=>[part.type,part.value]));
        const represented=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute));
        const delta=target-represented;if(!delta)break;guess+=delta;
      }
      const finalParts=Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part=>[part.type,part.value]));
      if(Date.UTC(Number(finalParts.year),Number(finalParts.month)-1,Number(finalParts.day),Number(finalParts.hour),Number(finalParts.minute))!==target)
        throw new Error("این ساعت در منطقهٔ زمانی مراجع وجود ندارد؛ زمان دیگری انتخاب کنید.");
      return new Date(guess);
    };
    const setStatus = (root, value, bad = false) => {
      root.replaceChildren(node("p", bad ? "admin-error" : "muted", value));
    };
    async function verifyAdmin() {
      const { data, error } = await db.auth.getSession();
      if (error || !data.session) throw new Error("برای دسترسی به این بخش با حساب مدیر وارد شوید.");
      const { data: assurance, error: assuranceError } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError || assurance?.currentLevel !== "aal2") throw new Error("برای این عملیات ورود دومرحله‌ای (AAL2) لازم است.");
      const { data: profile, error: profileError } = await db.from("profiles").select("role").eq("id", data.session.user.id).maybeSingle();
      if (profileError || profile?.role !== "admin") throw new Error("دسترسی فقط برای مدیر یادسنتر مجاز است.");
    }

    async function loadSessions() {
      const { data, error } = await db.rpc("admin_list_appointment_private_access");
      sessionsRoot.replaceChildren();
      if (error) { setStatus(sessionsRoot, migrationHint); return; }
      if (!data?.length) { setStatus(sessionsRoot, "جلسهٔ تأییدشده‌ای برای مدیریت لینک وجود ندارد."); return; }
      data.forEach(item => {
        const card = node("article", "portal-card yad-session-admin-card");
        card.append(node("h3", "", item.client_name + " · " + item.therapist_name));
        card.append(node("p", "muted", date(item.starts_at, item.timezone) + " تا " + date(item.ends_at, item.timezone) + " · " + (item.timezone || "") + " · " + item.appointment_status));
        const url = node("input"); url.type = "url"; url.required = true; url.maxLength = 1000;
        url.placeholder = "لینک خصوصی جلسه با https://";
        url.value = item.meeting_url || "";
        url.setAttribute("aria-label", "لینک خصوصی جلسه");
        const password = node("input"); password.type = "text"; password.maxLength = 160;
        password.placeholder = "رمز جلسه (اختیاری)";
        password.value = item.meeting_password || "";
        password.setAttribute("aria-label", "رمز جلسه");
        const save = node("button", "button primary", "ذخیرهٔ لینک خصوصی"); save.type = "button";
        save.addEventListener("click", async () => {
          if (!url.value.startsWith("https://")) { setStatus(sessionsRoot, "لینک جلسه باید با https:// آغاز شود.", true); return; }
          save.disabled = true;
          const { error: saveError } = await db.rpc("admin_set_appointment_meeting", {
            p_appointment_id: item.appointment_id,
            p_meeting_url: url.value.trim(),
            p_meeting_password: password.value.trim() || null
          });
          save.disabled = false;
          if (saveError) { setStatus(sessionsRoot, saveError.message || "ذخیرهٔ لینک ناموفق بود.", true); return; }
          save.textContent = "ذخیره شد";
          await loadSessions();
        });
        card.append(url, password, save);
        if (item.appointment_status === "confirmed" && new Date(item.ends_at) <= new Date()) {
          const complete = node("button", "button outline", "ثبت پایان جلسه"); complete.type = "button";
          complete.addEventListener("click", async () => {
            const { error: completeError } = await db.rpc("admin_mark_appointment_completed", { p_appointment_id: item.appointment_id });
            if (completeError) { setStatus(sessionsRoot, completeError.message || "تغییر وضعیت ناموفق بود.", true); return; }
            await loadSessions();
          });
          card.append(complete);
        }
        sessionsRoot.append(card);
      });
    }

    async function loadSupport() {
      const root = document.getElementById("yadSupportAdminList");
      const { data, error } = await db.rpc("admin_list_support_tickets", { p_limit: 100 });
      root.replaceChildren();
      if (error) { setStatus(root, migrationHint); return; }
      if (!data?.length) { setStatus(root, "درخواست پشتیبانی ثبت نشده است."); return; }
      const labels = { cancellation: "لغو جلسه", reschedule: "تغییر زمان", complaint: "شکایت", therapist_change: "تغییر درمانگر", data_request: "اطلاعات حساب", account_deletion: "حذف حساب", other: "سایر" };
      for (const item of data) {
        const card = node("article", "portal-card");
        card.append(node("h3", "", (labels[item.ticket_type] || item.ticket_type) + " · " + item.client_name));
        card.append(node("p", "", item.message));
        card.append(node("small", "muted", date(item.created_at)));
        const status = node("select");
        [["new","جدید"],["in_review","در حال بررسی"],["resolved","رسیدگی شد"],["declined","پذیرفته نشد"]].forEach(([v,l]) => {
          const o = node("option", "", l); o.value = v; status.append(o);
        });
        status.value = item.status;
        const note = node("textarea"); note.rows = 3; note.maxLength = 2000; note.placeholder = "یادداشت یا پاسخ مدیریت (اختیاری)"; note.value = item.admin_note || "";
        const save = node("button", "button primary", "ذخیرهٔ وضعیت"); save.type = "button";
        save.addEventListener("click", async () => {
          save.disabled = true;
          const { error: updateError } = await db.rpc("admin_update_support_ticket", {
            p_ticket_id: item.ticket_id, p_status: status.value, p_admin_note: note.value.trim() || null
          });
          save.disabled = false;
          if (updateError) { setStatus(root, updateError.message || "ذخیرهٔ درخواست ناموفق بود.", true); return; }
          await loadSupport();
        });
        const requiresDedicatedAction=["cancellation","reschedule","therapist_change"].includes(item.ticket_type);
        if(requiresDedicatedAction)save.hidden=true;
        card.append(status, note, save);
        if (item.ticket_type === "cancellation") {
          const refundLabel = node("label", "yad-inline-check", "بازپرداخت واقعی خارج از سامانه انجام شده است");
          const refundDone = node("input"); refundDone.type = "checkbox"; refundLabel.prepend(refundDone);
          const actions = node("div", "admin-actions");
          const approveCancel = node("button", "button primary", "تأیید لغو"); approveCancel.type = "button";
          approveCancel.addEventListener("click", async () => {
            if (!window.confirm("آیا درخواست لغو را تأیید می‌کنید؟ اگر وجه دریافت شده، ابتدا باید بازپرداخت واقعی انجام شده باشد.")) return;
            const { error: actionError } = await db.rpc("admin_resolve_support_cancellation", {
              p_ticket_id: item.ticket_id, p_cancel: true, p_refund_completed: refundDone.checked, p_admin_note: note.value.trim() || null
            });
            if (actionError) { setStatus(root, actionError.message || "لغو انجام نشد.", true); return; }
            await loadSupport();
          });
          const rejectCancel = node("button", "button outline", "رد درخواست لغو"); rejectCancel.type = "button";
          rejectCancel.addEventListener("click", async () => {
            const { error: actionError } = await db.rpc("admin_resolve_support_cancellation", {
              p_ticket_id: item.ticket_id, p_cancel: false, p_refund_completed: false, p_admin_note: note.value.trim() || null
            });
            if (actionError) { setStatus(root, actionError.message || "ثبت تصمیم ناموفق بود.", true); return; }
            await loadSupport();
          });
          actions.append(approveCancel, rejectCancel);
          card.append(refundLabel, actions);
        } else if (item.ticket_type === "reschedule") {
          const when = node("input"); when.type = "datetime-local"; when.setAttribute("aria-label", "زمان جدید جلسه");
          const confirmedLabel = node("label", "yad-inline-check", "زمان جدید با مراجع هماهنگ و تأیید شده است");
          const confirmed = node("input"); confirmed.type = "checkbox"; confirmedLabel.prepend(confirmed);
          const apply = node("button", "button primary", "ثبت زمان جدید"); apply.type = "button";
          apply.addEventListener("click", async () => {
            if (!when.value || !confirmed.checked) { setStatus(root, "زمان جدید و تأیید مراجع لازم است.", true); return; }
            const { data: clientTimezone, error: timezoneError } = await db.rpc("admin_get_appointment_timezone", { p_appointment_id: item.appointment_id });
            if (timezoneError || !clientTimezone) { setStatus(root, timezoneError?.message || "منطقهٔ زمانی مراجع در دسترس نیست.", true); return; }
            let startsAt;
            try { startsAt = localDateTimeInZone(when.value,clientTimezone); }
            catch(error) { setStatus(root,error.message,true); return; }
            const { error: actionError } = await db.rpc("admin_resolve_support_reschedule", {
              p_ticket_id: item.ticket_id, p_starts_at: startsAt.toISOString(),
              p_timezone: clientTimezone, p_client_confirmed: true, p_admin_note: note.value.trim() || null
            });
            if (actionError) { setStatus(root, actionError.message || "تغییر زمان انجام نشد.", true); return; }
            await loadSupport();
          });
          card.append(when, confirmedLabel, apply);
        } else if (item.ticket_type === "therapist_change") {
          const select = node("select");
          const placeholder = node("option", "", "درمانگر جدید را انتخاب کنید"); placeholder.value = ""; select.append(placeholder);
          const { data: therapists } = await db.rpc("admin_list_therapists");
          (therapists || []).filter(t => t.verified && t.is_listed).forEach(t => {
            const option = node("option", "", t.display_name + (t.headline ? " — " + t.headline : ""));
            option.value = t.therapist_id; select.append(option);
          });
          const change = node("button", "button primary", "تغییر درمانگر"); change.type = "button";
          change.addEventListener("click", async () => {
            if (!select.value) { setStatus(root, "درمانگر جدید را انتخاب کنید.", true); return; }
            const { error: actionError } = await db.rpc("admin_resolve_support_therapist_change", {
              p_ticket_id: item.ticket_id, p_new_therapist_id: select.value, p_admin_note: note.value.trim() || null
            });
            if (actionError) { setStatus(root, actionError.message || "تغییر درمانگر انجام نشد.", true); return; }
            await loadSupport();
          });
          card.append(select, change);
        }
        root.append(card);
      }
    }

    async function loadFeedback() {
      const root = document.getElementById("yadFeedbackAdminList");
      const { data, error } = await db.rpc("admin_list_appointment_feedback", { p_limit: 100 });
      root.replaceChildren();
      if (error) { setStatus(root, migrationHint); return; }
      if (!data?.length) { setStatus(root, "بازخوردی برای بررسی وجود ندارد."); return; }
      data.forEach(item => {
        const card = node("article", "portal-card");
        card.append(node("h3", "", item.therapist_name + " · " + "★".repeat(item.rating)));
        card.append(node("p", "", item.feedback || "بدون متن"));
        card.append(node("small", "muted", date(item.created_at) + " · " + item.status));
        const actions = node("div", "admin-actions");
        [["published","انتشار"],["hidden","عدم انتشار"]].forEach(([value,label]) => {
          const button = node("button", "button " + (value === "published" ? "primary" : "outline"), label);
          button.type = "button";
          button.addEventListener("click", async () => {
            const { error: moderateError } = await db.rpc("admin_moderate_appointment_feedback", { p_feedback_id: item.feedback_id, p_status: value });
            if (moderateError) { setStatus(root, moderateError.message || "ثبت تصمیم ناموفق بود.", true); return; }
            await loadFeedback();
          });
          actions.append(button);
        });
        card.append(actions);
        root.append(card);
      });
    }

    const availabilityForm=document.getElementById("yadAvailabilityForm");
    const availabilityTherapist=document.getElementById("yadAvailabilityTherapist");
    const availabilityList=document.getElementById("yadAvailabilityList");
    const availabilityStatus=document.getElementById("yadAvailabilityStatus");
    const availabilityMessage=(value,bad=false)=>{if(availabilityStatus){availabilityStatus.textContent=value;availabilityStatus.dataset.error=bad?"true":"false";}};
    async function loadAvailabilitySlots(){
      if(!availabilityTherapist?.value||!availabilityList)return;
      const {data,error}=await db.rpc("admin_list_availability_slots",{p_therapist_id:availabilityTherapist.value});
      availabilityList.replaceChildren();
      if(error){availabilityList.append(node("p","admin-error",error.message||migrationHint));return;}
      if(!data?.length){availabilityList.append(node("p","muted","برای این درمانگر زمان آزادی ثبت نشده است."));return;}
      data.forEach(slot=>{
        const card=node("article","portal-card yad-session-admin-card");
        card.append(node("b","",date(slot.starts_at,slot.timezone)+" · "+slot.timezone));
        card.append(node("small","muted",date(slot.ends_at,slot.timezone)));
        const remove=node("button","button outline","حذف ظرفیت");remove.type="button";
        remove.addEventListener("click",async()=>{
          if(!window.confirm("این زمان آزاد حذف شود؟"))return;
          const {error:deleteError}=await db.rpc("admin_delete_availability_slot",{p_slot_id:slot.slot_id});
          if(deleteError){availabilityMessage(deleteError.message||"حذف ظرفیت ناموفق بود.",true);return;}
          await loadAvailabilitySlots();
        });
        card.append(remove);availabilityList.append(card);
      });
    }
    async function initAvailability(){
      if(!availabilityForm)return;
      if(!document.getElementById("yadAvailabilityTimezone").value)
        document.getElementById("yadAvailabilityTimezone").value=Intl.DateTimeFormat().resolvedOptions().timeZone||"Asia/Tehran";
      const {data:therapists,error}=await db.rpc("admin_list_therapists");
      if(error){availabilityMessage(error.message||migrationHint,true);return;}
      availabilityTherapist.replaceChildren();
      const placeholder=node("option","","درمانگر را انتخاب کنید");placeholder.value="";availabilityTherapist.append(placeholder);
      (therapists||[]).filter(t=>t.verified&&t.is_listed).forEach(t=>{
        const option=node("option","",t.display_name);option.value=t.therapist_id;availabilityTherapist.append(option);
      });
      availabilityTherapist.addEventListener("change",loadAvailabilitySlots);
      availabilityForm.addEventListener("submit",async event=>{
        event.preventDefault();
        if(!availabilityTherapist.value){availabilityMessage("درمانگر را انتخاب کنید.",true);return;}
        const zone=document.getElementById("yadAvailabilityTimezone").value.trim();
        let start,end;
        try{
          start=localDateTimeInZone(document.getElementById("yadAvailabilityStart").value,zone);
          end=localDateTimeInZone(document.getElementById("yadAvailabilityEnd").value,zone);
        }catch(error){availabilityMessage(error.message,true);return;}
        if(end.getTime()-start.getTime()!==45*60000){availabilityMessage("هر ظرفیت باید دقیقاً ۴۵ دقیقه باشد.",true);return;}
        const button=availabilityForm.querySelector('button[type="submit"]');button.disabled=true;
        const {error:saveError}=await db.rpc("admin_create_availability_slot",{
          p_therapist_id:availabilityTherapist.value,p_starts_at:start.toISOString(),p_ends_at:end.toISOString(),p_timezone:zone
        });
        button.disabled=false;
        if(saveError){availabilityMessage(saveError.message||"ثبت زمان آزاد ناموفق بود.",true);return;}
        availabilityForm.reset();
        document.getElementById("yadAvailabilityTimezone").value=zone;
        availabilityMessage("زمان آزاد ۴۵ دقیقه‌ای ثبت شد.");
        await loadAvailabilitySlots();
      });
    }

    document.getElementById("yadRefreshSessionAccess")?.addEventListener("click", loadSessions);
    document.getElementById("yadRefreshSupport")?.addEventListener("click", loadSupport);
    document.getElementById("yadRefreshFeedback")?.addEventListener("click", loadFeedback);
    async function init() {
      try {
        await verifyAdmin();
        await Promise.all([loadSessions(), loadSupport(), loadFeedback(), initAvailability()]);
      } catch (error) {
        [sessionsRoot, document.getElementById("yadSupportAdminList"), document.getElementById("yadFeedbackAdminList")].filter(Boolean)
          .forEach(root => setStatus(root, error.message, true));
      }
    }
    db.auth.getSession().then(({ data }) => { if (data.session) init(); });
    db.auth.onAuthStateChange((_event, session) => { if (session?.user) setTimeout(init, 0); });
  };
  if (document.readyState === "complete") ready();
  else window.addEventListener("load", ready, { once: true });
})();
