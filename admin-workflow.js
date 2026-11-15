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
    let activeAdmin = null;
    let initializing = false;

    async function requireAdmin() {
      const { data, error } = await db.auth.getSession();
      if (error || !data.session) throw new Error("ابتدا با حساب مدیر وارد شوید.");
      const { data: assurance, error: assuranceError } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError || assurance?.currentLevel !== "aal2") throw new Error("برای پنل مدیریت، ورود دومرحله‌ای (MFA) لازم است.");
      const { data: profile, error: profileError } = await db.from("profiles")
        .select("role").eq("id", data.session.user.id).maybeSingle();
      if (profileError || profile?.role !== "admin") throw new Error("دسترسی فقط برای مدیر یادسنتر مجاز است.");
    }

    const businessForm = document.getElementById("yadBusinessSettingsForm");
    const businessStatus = document.getElementById("yadBusinessSettingsStatus");
    const businessValue = id => document.getElementById(id)?.value?.trim() || "";
    const setPlatformPercent = () => {
      const therapist = Number(businessValue("yadTherapistPercent") || 70);
      document.getElementById("yadPlatformPercent").value = String(100 - therapist);
    };
    async function loadBusinessSettings() {
      if (!businessForm) return;
      const { data, error } = await db.rpc("get_public_site_settings");
      if (error) throw error;
      const tariffs = data?.tariffs || [];
      const find = (market,currency) => tariffs.find(x=>x.market===market&&x.currency===currency);
      const iran=find("iran","IRR"),eur=find("international","EUR"),usd=find("international","USD");
      if(iran)document.getElementById("yadTariffIRR").value=Number(iran.amount)/10;
      if(eur)document.getElementById("yadTariffEUR").value=eur.amount;
      if(usd)document.getElementById("yadTariffUSD").value=usd.amount;
      const base=iran||eur||usd;
      if(base)document.getElementById("yadTherapistPercent").value=base.therapist_percent;
      const c=data?.contacts||{};
      const fields={whatsapp_number:"yadContactWhatsapp",contact_email:"yadContactEmail",instagram_url:"yadContactInstagram",telegram_url:"yadContactTelegram",youtube_url:"yadContactYoutube",linkedin_url:"yadContactLinkedin",facebook_url:"yadContactFacebook"};
      Object.entries(fields).forEach(([key,id])=>{document.getElementById(id).value=c[key]||"";});
      const date=document.getElementById("yadTariffEffective");
      if(!date.value){const now=new Date();now.setMinutes(now.getMinutes()-now.getTimezoneOffset());date.value=now.toISOString().slice(0,16);}
      setPlatformPercent();
      businessStatus.textContent=tariffs.length?"تعرفه‌های فعلی بارگذاری شد.":"هنوز تعرفه‌ای ثبت نشده است؛ هر سه مبلغ را وارد کن.";
    }
    document.getElementById("yadTherapistPercent")?.addEventListener("input",setPlatformPercent);
    businessForm?.addEventListener("submit",async event=>{
      event.preventDefault();
      businessStatus.textContent="در حال ذخیره تنظیمات…";
      try{
        const therapistPercent=Number(businessValue("yadTherapistPercent"));
        const effective=new Date(businessValue("yadTariffEffective"));
        if(!Number.isFinite(effective.getTime())||effective>new Date())throw new Error("تاریخ شروع اعتبار باید اکنون یا در گذشته باشد.");
        const contacts={
          whatsapp_number:businessValue("yadContactWhatsapp"),
          contact_email:businessValue("yadContactEmail"),
          instagram_url:businessValue("yadContactInstagram"),
          telegram_url:businessValue("yadContactTelegram"),
          youtube_url:businessValue("yadContactYoutube"),
          linkedin_url:businessValue("yadContactLinkedin"),
          facebook_url:businessValue("yadContactFacebook")
        };
        const {error}=await db.rpc("admin_update_yad_business_settings",{
          p_iran_irr:Number(businessValue("yadTariffIRR"))*10,
          p_international_eur:Number(businessValue("yadTariffEUR")),
          p_international_usd:Number(businessValue("yadTariffUSD")),
          p_therapist_percent:therapistPercent,
          p_effective_from:effective.toISOString(),
          p_contacts:contacts
        });
        if(error)throw error;
        businessStatus.textContent="تعرفه‌ها و اطلاعات تماس ذخیره شد. درخواست‌های قبلی بدون تغییر باقی می‌مانند.";
      }catch(error){businessStatus.textContent=error.message||"ذخیره تنظیمات ناموفق بود.";}
    });

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
      document.getElementById("yadYearsExperience").value = t?.years_experience ?? "";
      document.getElementById("yadJurisdictions").value = (t?.practice_jurisdictions || []).join("، ");
      document.getElementById("yadAcceptingNewClients").checked = !!t?.accepting_new_clients;
      document.getElementById("yadDuration").value = 45;
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
      const { data: metadata } = await db.rpc("admin_list_therapist_public_metadata");
      const metadataById = new Map((metadata || []).map(item => [item.therapist_id, item]));
      cachedTherapists = (data || []).map(item => ({ ...item, ...(metadataById.get(item.therapist_id) || {}) }));
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
      const { data: timezoneRows } = await db.rpc("admin_list_request_client_timezones");
      const timezoneByRequest = new Map((timezoneRows || []).map(item => [item.request_id, item.client_timezone]));
      requests.replaceChildren();
      if (!data?.length) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 8; td.textContent = "درخواستی ثبت نشده است.";
        tr.append(td); requests.append(tr); return;
      }
      data.forEach(item => {
        const tr = document.createElement("tr");
        tr.dataset.requestId = item.request_id;
        tr.dataset.duration = String(item.session_duration_minutes || 45);
        tr.dataset.timezone = timezoneByRequest.get(item.request_id) || "Asia/Tehran";
        const add = value => { const td = document.createElement("td"); td.textContent = safe(value); tr.append(td); return td; };
        add(item.client_name);
        add(item.therapist_name);
        add(new Intl.NumberFormat("fa-IR").format(item.currency==="IRR"?Number(item.amount)/10:Number(item.amount)) + (item.currency==="IRR"?" تومان":" "+item.currency));
        add(new Intl.NumberFormat("fa-IR").format(item.currency==="IRR"?Number(item.therapist_share_amount)/10:Number(item.therapist_share_amount)) + " / " + new Intl.NumberFormat("fa-IR").format(item.currency==="IRR"?Number(item.platform_share_amount)/10:Number(item.platform_share_amount)));
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
      const row = requests.querySelector("tr[data-request-id=\"" + requestId + "\"]");
      const duration = Number(row?.dataset.duration || 45);
      const end = new Date(start.getTime() + duration * 60000);
      const { error } = await db.rpc("admin_schedule_request", {
        p_request_id: requestId,
        p_starts_at: start.toISOString(),
        p_ends_at: end.toISOString(),
        p_timezone: row?.dataset.timezone || "Asia/Tehran"
      });
      if (error) { setStatus(error.message || "ثبت جلسه ناموفق بود.", true); return; }
      setStatus("جلسه با درمانگر انتخاب‌شده ثبت شد.");
      await loadRequests();
    }


    const eventStatus=document.getElementById("yadWorkshopAdminStatus");
    const eventList=document.getElementById("yadWorkshopAdminList");
    const eventForm=document.getElementById("yadWorkshopAdminForm");
    const eventTimezone=document.getElementById("eventTimezone");
    if(eventTimezone&&!eventTimezone.value)eventTimezone.value=Intl.DateTimeFormat().resolvedOptions().timeZone||"Asia/Tehran";
    const proposalList=document.getElementById("yadWorkshopProposals");
    const rosterBox=document.getElementById("yadWorkshopRoster");
    const rosterList=document.getElementById("yadWorkshopRosterList");
    const eventValue=id=>document.getElementById(id)?.value?.trim()||"";
    const eventDate=id=>{const v=eventValue(id);return v?new Date(v).toISOString():null;};
    async function loadWorkshops(){
      if(!eventList)return;
      const [{data:events,error},{data:proposals, error:proposalError}]=await Promise.all([
        db.rpc("admin_list_workshops"),db.rpc("admin_list_workshop_proposals")
      ]);
      if(error)throw error;if(proposalError)throw proposalError;
      eventList.replaceChildren();
      (events||[]).forEach(item=>{
        const card=document.createElement("article");card.className="portal-card";
        const h=document.createElement("b");h.textContent=item.title;
        const p=document.createElement("p");p.textContent=item.presenter_name+" · "+new Date(item.starts_at).toLocaleString()+" · "+item.status+" · "+item.registration_count+" ثبت‌نام";
        const btn=document.createElement("button");btn.type="button";btn.className="button outline";btn.textContent="مشاهده ثبت‌نام‌کنندگان";
        btn.addEventListener("click",()=>loadWorkshopRoster(item.id,item.title));
        const statusBtn=document.createElement("button");statusBtn.type="button";statusBtn.className="button outline";
        statusBtn.textContent=item.status==="published"?"لغو انتشار":item.status==="cancelled"?"انتشار دوباره":"انتشار رویداد";
        statusBtn.addEventListener("click",async()=>{const next=item.status==="published"?"cancelled":"published";const {error}=await db.rpc("admin_set_workshop_status",{p_workshop_id:item.id,p_status:next});if(error){eventStatus.textContent=error.message;return;}eventStatus.textContent=next==="published"?"رویداد منتشر شد.":"رویداد از فهرست عمومی خارج شد.";await loadWorkshops();});
        card.append(h,p,btn,statusBtn);eventList.append(card);
      });
      if(!(events||[]).length)eventList.textContent="هنوز رویدادی ایجاد نشده است.";
      proposalList.replaceChildren();
      (proposals||[]).forEach(item=>{
        const card=document.createElement("article");card.className="portal-card";
        const h=document.createElement("b");h.textContent=item.proposed_title;
        const p=document.createElement("p");p.textContent=item.presenter_name+" · "+item.contact_email+" · "+item.topic+" · "+item.status;
        const desc=document.createElement("p");desc.textContent=item.proposal||"";
        const actions=document.createElement("div");actions.className="admin-actions";
        [["reviewing","شروع بررسی"],["accepted","پذیرش پیشنهاد"],["declined","رد پیشنهاد"]].forEach(([status,label])=>{const b=document.createElement("button");b.type="button";b.className="button outline";b.textContent=label;b.addEventListener("click",async()=>{const {error}=await db.rpc("admin_set_workshop_proposal_status",{p_proposal_id:item.id,p_status:status});if(error){eventStatus.textContent=error.message;return;}eventStatus.textContent="وضعیت پیشنهاد به‌روزرسانی شد.";await loadWorkshops();});actions.append(b);});
        card.append(h,p,desc,actions);proposalList.append(card);
      });
      if(!(proposals||[]).length)proposalList.textContent="پیشنهادی در صف بررسی نیست.";
    }
    async function loadWorkshopRoster(id,title){
      const {data,error}=await db.rpc("admin_list_workshop_registrations",{p_workshop_id:id});
      if(error){eventStatus.textContent=error.message;return;}
      rosterBox.hidden=false;rosterList.replaceChildren();
      const heading=document.createElement("p");heading.textContent=title;rosterList.append(heading);
      (data||[]).forEach(person=>{
        const row=document.createElement("div");row.className="portal-card";
        const p=document.createElement("p");p.textContent=person.client_name+" · "+person.client_email+" · "+person.status+" · رسید: "+(person.payment_reference||"ثبت نشده");
        row.append(p);
        if(person.status==="pending_payment" && person.payment_reference){
          const b=document.createElement("button");b.type="button";b.className="button primary";b.textContent="تأیید پرداخت پس از تطبیق";
          b.addEventListener("click",async()=>{if(!confirm("واریز واقعی را بررسی کرده‌ای؟"))return;const {error}=await db.rpc("admin_set_workshop_registration_paid",{p_registration_id:person.registration_id,p_paid:true});if(error){eventStatus.textContent=error.message;return;}eventStatus.textContent="وضعیت پرداخت تأیید شد.";await loadWorkshopRoster(id,title);});
          row.append(b);
        }
        rosterList.append(row);
      });
      if(!(data||[]).length)rosterList.append("هنوز ثبت‌نامی انجام نشده است.");
    }
    eventForm?.addEventListener("submit",async e=>{
      e.preventDefault();eventStatus.textContent="در حال ذخیره رویداد…";
      try{
        const format=eventValue("eventFormat");
        let platform=eventValue("eventPlatform");
        if(format==="in_person")platform="In person";
        if(format==="online"&&platform==="In person")platform="Zoom";
        const args={
          p_workshop_id:null,p_slug:eventValue("eventSlug"),p_title:eventValue("eventTitle"),
          p_summary:eventValue("eventSummary"),p_description:eventValue("eventDescription"),
          p_presenter_name:eventValue("eventPresenter"),p_presenter_bio:eventValue("eventPresenterBio"),
          p_languages:split(eventValue("eventLanguages")),p_topics:split(eventValue("eventTopics")),
          p_format:format,p_platform:platform,p_venue:eventValue("eventVenue")||null,
          p_starts_at:eventDate("eventStarts"),p_ends_at:eventDate("eventEnds"),
          p_timezone:eventValue("eventTimezone"),p_capacity:eventValue("eventCapacity")?Number(eventValue("eventCapacity")):null,
          p_fee_amount:Number(eventValue("eventFee")||0),p_currency:eventValue("eventCurrency"),
          p_status:eventValue("eventStatus"),p_registration_deadline:eventDate("eventDeadline"),
          p_meeting_url:eventValue("eventMeetingUrl")||null,p_meeting_password:eventValue("eventMeetingPassword")||null
        };
        if(new Date(args.p_ends_at)<=new Date(args.p_starts_at))throw new Error("زمان پایان باید بعد از شروع باشد.");
        const {error}=await db.rpc("admin_upsert_workshop",args);
        if(error)throw error;
        eventForm.reset();document.getElementById("eventTimezone").value=Intl.DateTimeFormat().resolvedOptions().timeZone||"Asia/Tehran";
        document.getElementById("eventLanguages").value="fa";document.getElementById("eventFee").value="0";
        eventStatus.textContent="رویداد ذخیره شد.";await loadWorkshops();
      }catch(error){eventStatus.textContent=error.message||"ذخیره رویداد ناموفق بود.";}
    });
    document.getElementById("yadRefreshWorkshops")?.addEventListener("click",()=>loadWorkshops().catch(e=>eventStatus.textContent=e.message));

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
          p_session_duration_minutes: 45,
          // Legacy database columns remain required by the existing RPC; public pricing comes only from central tariffs.
          p_fee_amount: 0,
          p_fee_currency: "IRR",
          p_photo_path: photoPath,
          p_license_number: val("yadLicense") || null,
          p_issuing_authority: val("yadAuthority") || null,
          p_document_path: documentPath,
          p_verified: document.getElementById("yadVerified").checked,
          p_is_listed: document.getElementById("yadListed").checked
        };
        const { data: savedId, error } = await db.rpc("admin_save_therapist", payload);
        if (error) throw error;
        const metadataId = savedId || val("yadTherapistId");
        if (metadataId) {
          const { error: metadataError } = await db.rpc("admin_set_therapist_public_metadata", {
            p_therapist_id: metadataId,
            p_years_experience: val("yadYearsExperience") ? Number(val("yadYearsExperience")) : null,
            p_practice_jurisdictions: split(val("yadJurisdictions")).map(code => code.toUpperCase()),
            p_accepting_new_clients: document.getElementById("yadAcceptingNewClients").checked
          });
          if (metadataError) throw new Error("پروفایل اصلی ذخیره شد؛ اما اطلاعات سابقه، قلمرو فعالیت و پذیرش مراجع ذخیره نشد. مهاجرت تکمیلی پایگاه داده را بررسی کنید.");
        }
        root.reset();
        fillForm(null);
        document.getElementById("yadExistingPhoto").value = "";
        document.getElementById("yadExistingDocument").value = "";
        setStatus("پروفایل درمانگر ذخیره شد.");
        await loadBusinessSettings();
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

    async function initializeAdminWorkflow() {
      if (initializing) return;
      initializing = true;
      try {
        await requireAdmin();
        const { data } = await db.auth.getSession();
        const userId = data.session.user.id;
        if (activeAdmin === userId) return;
        activeAdmin = userId;
        await loadBusinessSettings();
        await loadTherapists();
        await loadRequests();
        if(eventList) await loadWorkshops();
        setStatus("اتصال پنل درمانگران، درخواست‌ها و کارگاه‌ها برقرار است.");
      } catch (error) {
        activeAdmin = null;
        setStatus(error.message || "اتصال به پنل ناموفق بود.", true);
      } finally { initializing = false; }
    }
    db.auth.onAuthStateChange((_event, session) => {
      if (session?.user) setTimeout(initializeAdminWorkflow, 0);
      else activeAdmin = null;
    });
    initializeAdminWorkflow();
  };
  if (document.readyState === "complete") onReady();
  else window.addEventListener("load", onReady, { once: true });
})();