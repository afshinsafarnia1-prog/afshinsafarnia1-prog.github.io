(() => {
  const onReady = () => {
    const root = document.getElementById("yadTherapistForm");
    if (!root || !window.supabase?.createClient) return;
    const cfg = window.YAD_SUPABASE_CONFIG || {};
    if (!cfg.url || !cfg.anonKey) return;
    const db = window.supabase.createClient(cfg.url, cfg.anonKey);
    const status = document.getElementById("yadWorkflowStatus");
    const list = document.getElementById("yadTherapistList");
    const requests = document.getElementById("yadRequestsBody");
    const setStatus = (message, bad = false) => {
      status.textContent = message;
      status.dataset.error = bad ? "true" : "false";
    };
    const val = id => document.getElementById(id)?.value?.trim() || "";
    const split = value => value.split(/[,،\n]/).map(x => x.trim()).filter(Boolean);
    const safe = value => value == null ? "—" : String(value);
    let cachedTherapists = [];

    async function requireAdmin() {
      const { data, error } = await db.auth.getSession();
      if (error || !data.session) throw new Error("ابتدا با حساب مدیر وارد شوید.");
      const { data: profile, error: profileError } = await db.from("profiles")
        .select("role").eq("id", data.session.user.id).maybeSingle();
      if (profileError || profile?.role !== "admin") throw new Error("دسترسی فقط برای مدیر یادسنتر مجاز است.");
    }

    async function upload(bucket, file, oldPath) {
      if (!file) return oldPath || null;
      const clean = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-90);
      const path = crypto.randomUUID() + "/" + clean;
      const { error } = await db.storage.from(bucket).upload(path, file, {
        upsert: false, contentType: file.type || "application/octet-stream"
      });
      if (error) throw error;
      return path;
    }

    function fillForm(t) {
      document.getElementById("yadTherapistId").value = t?.therapist_id || "";
      document.getElementById("yadPublicSlug").value = t?.public_slug || "";
      document.getElementById("yadDisplayName").value = t?.display_name || "";
      document.getElementById("yadHeadline").value = t?.headline || "";
      document.getElementById("yadBiography").value = t?.biography || "";
      document.getElementById("yadQualifications").value = (t?.qualifications || []).join("، ");
      document.getElementById("yadSpecialties").value = (t?.specialties || []).join("، ");
      document.getElementById("yadLanguages").value = (t?.languages || ["fa"]).join(", ");
      document.getElementById("yadModalities").value = (t?.modalities || []).join("، ");
      document.getElementById("yadDuration").value = t?.session_duration_minutes || 50;
      document.getElementById("yadFee").value = t?.fee_amount ?? "";
      document.getElementById("yadCurrency").value = t?.fee_currency || "IRR";
      document.getElementById("yadLicense").value = t?.license_number || "";
      document.getElementById("yadAuthority").value = t?.issuing_authority || "";
      document.getElementById("yadVerified").checked = !!t?.verified;
      document.getElementById("yadListed").checked = !!t?.is_listed;
      document.getElementById("yadExistingPhoto").value = t?.photo_path || "";
      document.getElementById("yadExistingDocument").value = t?.document_path || "";
      document.getElementById("yadFormTitle").textContent = t ? "ویرایش پروفایل درمانگر" : "ثبت درمانگر جدید";
      document.getElementById("yadCancelEdit").hidden = !t;
      root.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    async function loadTherapists() {
      const { data, error } = await db.rpc("admin_list_therapists");
      if (error) throw error;
      cachedTherapists = data || [];
      list.replaceChildren();
      if (!cachedTherapists.length) {
        list.textContent = "هنوز درمانگری ثبت نشده است.";
        return;
      }
      cachedTherapists.forEach(t => {
        const card = document.createElement("article");
        card.className = "portal-card therapist-admin-card";
        const heading = document.createElement("b");
        heading.textContent = safe(t.display_name);
        const detail = document.createElement("p");
        detail.textContent = (t.headline || "بدون عنوان") + " · " + (t.verified ? "تأییدشده" : "تأییدنشده") + " · " + (t.is_listed ? "منتشرشده" : "منتشرنشده");
        const edit = document.createElement("button");
        edit.type = "button"; edit.className = "button outline"; edit.textContent = "ویرایش";
        edit.addEventListener("click", () => fillForm(t));
        card.append(heading, detail, edit);
        list.append(card);
      });
    }

    async function loadRequests() {
      const { data, error } = await db.rpc("admin_list_requests", { p_limit: 100, p_offset: 0 });
      if (error) throw error;
      requests.replaceChildren();
      if (!data?.length) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 7; td.textContent = "درخواستی ثبت نشده است.";
        tr.append(td); requests.append(tr); return;
      }
      data.forEach(item => {
        const tr = document.createElement("tr");
        const add = value => { const td = document.createElement("td"); td.textContent = safe(value); tr.append(td); return td; };
        add(item.client_name);
        add(item.therapist_name);
        add(new Intl.NumberFormat("fa-IR").format(Number(item.amount)) + " " + item.currency);
        add(item.provider_reference || "—");
        add(item.request_status);
        add(item.payment_status || "—");
        const action = add("");
        if (item.request_status === "payment_submitted" && item.payment_status === "pending") {
          const approve = document.createElement("button");
          approve.type = "button"; approve.className = "button primary"; approve.textContent = "تأیید دریافت وجه";
          approve.addEventListener("click", () => reviewPayment(item.payment_id, true));
          const reject = document.createElement("button");
          reject.type = "button"; reject.className = "button outline"; reject.textContent = "رد رسید";
          reject.addEventListener("click", () => reviewPayment(item.payment_id, false));
          action.append(approve, reject);
        } else if (item.request_status === "payment_verified") {
          const time = document.createElement("input");
          time.type = "datetime-local"; time.setAttribute("aria-label", "زمان جلسه");
          const schedule = document.createElement("button");
          schedule.type = "button"; schedule.className = "button primary"; schedule.textContent = "ثبت جلسه";
          schedule.addEventListener("click", () => scheduleRequest(item.request_id, time.value));
          action.append(time, schedule);
        } else if (item.request_status === "scheduled") {
          action.textContent = "جلسه ثبت شده";
        }
        requests.append(tr);
      });
    }

    async function reviewPayment(paymentId, approve) {
      if (!confirm(approve ? "دریافت وجه را پس از بررسی واقعی تأیید می‌کنی؟" : "رسید پرداخت رد شود؟")) return;
      setStatus("در حال ثبت نتیجه بررسی پرداخت…");
      const { error } = await db.rpc("admin_review_manual_payment", {
        p_payment_id: paymentId, p_approve: approve
      });
      if (error) { setStatus(error.message || "ثبت تصمیم ناموفق بود.", true); return; }
      setStatus(approve ? "پرداخت تأیید شد؛ اکنون زمان جلسه را ثبت کن." : "رسید رد شد.");
      await loadRequests();
    }

    async function scheduleRequest(requestId, localValue) {
      if (!localValue) { setStatus("ابتدا تاریخ و ساعت جلسه را انتخاب کن.", true); return; }
      const start = new Date(localValue);
      if (Number.isNaN(start.getTime()) || start <= new Date()) {
        setStatus("زمان جلسه باید در آینده باشد.", true); return;
      }
      const duration = 50;
      const end = new Date(start.getTime() + duration * 60000);
      const { error } = await db.rpc("admin_schedule_request", {
        p_request_id: requestId,
        p_starts_at: start.toISOString(),
        p_ends_at: end.toISOString(),
        p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tehran"
      });
      if (error) { setStatus(error.message || "ثبت جلسه ناموفق بود.", true); return; }
      setStatus("جلسه با درمانگر انتخاب‌شده ثبت شد.");
      await loadRequests();
    }

    root.addEventListener("submit", async event => {
      event.preventDefault();
      try {
        setStatus("در حال ذخیره پروفایل…");
        const photo = document.getElementById("yadPhoto").files[0];
        const documentFile = document.getElementById("yadLicenseDocument").files[0];
        const photoPath = await upload("therapist-photos", photo, val("yadExistingPhoto"));
        const documentPath = await upload("therapist-documents", documentFile, val("yadExistingDocument"));
        const payload = {
          p_therapist_id: val("yadTherapistId") || null,
          p_public_slug: val("yadPublicSlug"),
          p_display_name: val("yadDisplayName"),
          p_headline: val("yadHeadline"),
          p_biography: val("yadBiography"),
          p_qualifications: split(val("yadQualifications")),
          p_specialties: split(val("yadSpecialties")),
          p_languages: split(val("yadLanguages")),
          p_modalities: split(val("yadModalities")),
          p_session_duration_minutes: Number(val("yadDuration") || 50),
          p_fee_amount: Number(val("yadFee") || 0),
          p_fee_currency: val("yadCurrency"),
          p_photo_path: photoPath,
          p_license_number: val("yadLicense") || null,
          p_issuing_authority: val("yadAuthority") || null,
          p_document_path: documentPath,
          p_verified: document.getElementById("yadVerified").checked,
          p_is_listed: document.getElementById("yadListed").checked
        };
        const { error } = await db.rpc("admin_save_therapist", payload);
        if (error) throw error;
        root.reset();
        fillForm(null);
        document.getElementById("yadExistingPhoto").value = "";
        document.getElementById("yadExistingDocument").value = "";
        setStatus("پروفایل درمانگر ذخیره شد.");
        await loadTherapists();
      } catch (error) {
        setStatus(error.message || "ذخیره پروفایل ناموفق بود.", true);
      }
    });

    document.getElementById("yadCancelEdit").addEventListener("click", () => { root.reset(); fillForm(null); });
    document.getElementById("yadRefreshWorkflow").addEventListener("click", async () => {
      try { await loadTherapists(); await loadRequests(); setStatus("اطلاعات به‌روزرسانی شد."); }
      catch (error) { setStatus(error.message || "بارگذاری اطلاعات ناموفق بود.", true); }
    });

    (async () => {
      try {
        await requireAdmin();
        await loadTherapists();
        await loadRequests();
        setStatus("اتصال پنل درمانگران و درخواست‌ها برقرار است.");
      } catch (error) { setStatus(error.message || "اتصال به پنل ناموفق بود.", true); }
    })();
  };
  if (document.readyState === "complete") onReady();
  else window.addEventListener("load", onReady, { once: true });
})();