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
    const localDateTimeInZone = (value, timeZone) => {
      const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || "");
      if (!match) throw new Error("فرمت تاریخ و ساعت معتبر نیست.");
      const target = Date.UTC(Number(match[1]), Number(match[2])-1, Number(match[3]), Number(match[4]), Number(match[5]));
      let guess = target;
      const formatter = new Intl.DateTimeFormat("en-GB", { timeZone, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23" });
      for (let i=0;i<5;i++) {
        const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part=>[part.type,part.value]));
        const represented = Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute));
        const delta = target-represented;
        if (!delta) break;
        guess += delta;
      }
      const finalParts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part=>[part.type,part.value]));
      const finalValue = Date.UTC(Number(finalParts.year),Number(finalParts.month)-1,Number(finalParts.day),Number(finalParts.hour),Number(finalParts.minute));
      if (finalValue !== target) throw new Error("این ساعت در منطقهٔ زمانی مراجع وجود ندارد؛ زمان دیگری انتخاب کنید.");
      return new Date(guess);
    };
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
      if (profileError || profile?.role !== "admin") throw new Error("دسترسی فقط برای مدیر ردیاد مجاز است.");
    }

    const businessForm = document.getElementById("yadBusinessSettingsForm");
    const businessStatus = document.getElementById("yadBusinessSettingsStatus");
    const businessValue = id => document.getElementById(id)?.value?.trim() || "";
    async function loadBusinessSettings() {
      if (!businessForm) return;
      const { data, error } = await db.rpc("get_public_site_settings");
      if (error) throw error;
      document.getElementById("yadClientIntakeEnabled").checked = data?.client_intake_enabled === true;
      document.getElementById("yadClientPolicyVersion").value = data?.client_policy_version || "2026-11-17-v2-draft";
      const branding=data?.branding||{};
      document.getElementById("yadBrandName").value=branding.brand_name||"ردیاد";
      document.getElementById("yadBrandTagline").value=branding.tagline||"";
      document.getElementById("yadManagerName").value=branding.manager_name||"";
      document.getElementById("yadManagerTitle").value=branding.manager_title||"";
      document.getElementById("yadManagerBio").value=branding.manager_bio||"";
      document.getElementById("yadExistingLogoPath").value=branding.logo_path||"";
      document.getElementById("yadExistingManagerPhotoPath").value=branding.manager_photo_path||"";
      const setStoredPreview=(id,path)=>{
        const image=document.getElementById(id);
        if(!image)return;
        if(path){
          const {data}=db.storage.from("site-assets").getPublicUrl(path);
          if(data?.publicUrl){image.src=data.publicUrl;image.hidden=false;return;}
        }
        image.removeAttribute("src");image.hidden=true;
      };
      setStoredPreview("yadBrandLogoPreview",branding.logo_path);
      setStoredPreview("yadManagerPhotoPreview",branding.manager_photo_path);
      const contacts=data?.contacts||{};
      const fields={phone_number:"yadContactPhone",whatsapp_number:"yadContactWhatsapp",contact_email:"yadContactEmail",instagram_url:"yadContactInstagram",telegram_url:"yadContactTelegram",youtube_url:"yadContactYoutube",linkedin_url:"yadContactLinkedin",facebook_url:"yadContactFacebook"};
      Object.entries(fields).forEach(([key,id])=>{document.getElementById(id).value=contacts[key]||"";});
      businessStatus.textContent="تعرفه‌ها توسط هر درمانگر در پنل اختصاصی خودش تعیین می‌شوند؛ سهم درآمد ثابت ۷۰/۳۰ است.";
    }
    const bindImagePreview=(inputId,previewId)=>{
      const input=document.getElementById(inputId),image=document.getElementById(previewId);
      input?.addEventListener("change",()=>{
        const file=input.files?.[0];
        if(!file){image.hidden=true;image.removeAttribute("src");return;}
        if(!["image/jpeg","image/png","image/webp"].includes(file.type)){image.hidden=true;return;}
        const previous=image.dataset.objectUrl;
        if(previous)URL.revokeObjectURL(previous);
        const objectUrl=URL.createObjectURL(file);
        image.dataset.objectUrl=objectUrl;image.src=objectUrl;image.hidden=false;
      });
    };
    bindImagePreview("yadBrandLogo","yadBrandLogoPreview");
    bindImagePreview("yadManagerPhoto","yadManagerPhotoPreview");
    businessForm?.addEventListener("submit",async event=>{
      event.preventDefault();
      businessStatus.textContent="در حال ذخیره تنظیمات مرکز…";
      try{
        const intakeEnabled=document.getElementById("yadClientIntakeEnabled").checked;
        const policyVersion=businessValue("yadClientPolicyVersion");
        if(intakeEnabled&&(!policyVersion||/draft|test|preview/i.test(policyVersion))) {
          throw new Error("برای فعال‌سازی پذیرش، نسخهٔ نهایی و تأییدشدهٔ قوانین را ثبت کنید؛ نسخهٔ پیش‌نویس قابل قبول نیست.");
        }
        const contacts={
          phone_number:businessValue("yadContactPhone"),
          whatsapp_number:businessValue("yadContactWhatsapp"),
          contact_email:businessValue("yadContactEmail"),
          instagram_url:businessValue("yadContactInstagram"),
          telegram_url:businessValue("yadContactTelegram"),
          youtube_url:businessValue("yadContactYoutube"),
          linkedin_url:businessValue("yadContactLinkedin"),
          facebook_url:businessValue("yadContactFacebook")
        };
        const {error:contactsError}=await db.rpc("admin_update_yad_public_contacts",{p_contacts:contacts});
        if(contactsError)throw contactsError;
        const logoFile=document.getElementById("yadBrandLogo").files[0];
        const managerPhotoFile=document.getElementById("yadManagerPhoto").files[0];
        const logoPath=await upload("site-assets",logoFile,document.getElementById("yadExistingLogoPath").value);
        const managerPhotoPath=await upload("site-assets",managerPhotoFile,document.getElementById("yadExistingManagerPhotoPath").value);
        const {error:brandingError}=await db.rpc("admin_update_site_branding",{p_branding:{
          brand_name:businessValue("yadBrandName"),tagline:businessValue("yadBrandTagline"),
          manager_name:businessValue("yadManagerName"),manager_title:businessValue("yadManagerTitle"),
          manager_bio:businessValue("yadManagerBio"),logo_path:logoPath,manager_photo_path:managerPhotoPath
        }});
        if(brandingError)throw brandingError;
        const {error:intakeError}=await db.rpc("admin_set_client_intake",{p_enabled:intakeEnabled,p_policy_version:policyVersion});
        if(intakeError)throw intakeError;
        businessStatus.textContent=intakeEnabled
          ?"تنظیمات مرکز ذخیره شد و پذیرش درخواست‌های جدید فعال است."
          :"اطلاعات مرکز ذخیره شد؛ پذیرش درخواست‌های جدید غیرفعال است.";
      }catch(error){businessStatus.textContent=error.message||"ذخیره تنظیمات ناموفق بود.";}
    });

    async function upload(bucket, file, oldPath) {
      if (!file) return oldPath || null;
      const isDocument=bucket==="therapist-documents";
      if(file.size>(isDocument?10:5)*1024*1024)throw new Error(isDocument?"حجم مدرک نباید بیشتر از ۱۰ مگابایت باشد.":"حجم تصویر نباید بیشتر از ۵ مگابایت باشد.");
      const allowed=isDocument?["application/pdf","image/jpeg","image/png"]:["image/jpeg","image/png","image/webp"];
      if(!allowed.includes(file.type))throw new Error("فرمت فایل انتخاب‌شده مجاز نیست.");
      const clean = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-90);
      const generatedPath = crypto.randomUUID() + "/" + clean;
      // Site-branding RPCs validate a bucket-prefixed object key; keep upload and public URL paths identical.
      const path = bucket === "site-assets" ? "site-assets/" + generatedPath : generatedPath;
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
      document.getElementById("yadAuthority").value = t?.issuing_authority || "سازمان نظام روان‌شناسی و مشاوره جمهوری اسلامی ایران";
      document.getElementById("yadLicenseExpires").value = t?.license_expires_at || "";
      document.getElementById("yadRegistryReference").value = t?.registry_reference || "";
      document.getElementById("yadExistingScopeDocument").value = t?.psychotherapy_scope_evidence_reference || "";
      document.getElementById("yadJurisdictionReviewReference").value = t?.jurisdiction_review_reference || "";
      document.getElementById("yadVerified").checked = !!t?.verified;
      document.getElementById("yadAssessmentSpecialist").checked = !!t?.is_assessment_specialist;
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
      const { data: specialistFlags, error: specialistFlagsError } = await db.rpc("admin_list_assessment_specialist_flags");
      if(specialistFlagsError)throw specialistFlagsError;
      const metadataById = new Map((metadata || []).map(item => [item.therapist_id, item]));
      const specialistById = new Map((specialistFlags || []).map(item => [item.therapist_id, item.is_assessment_specialist]));
      cachedTherapists = (data || []).map(item => ({ ...item, ...(metadataById.get(item.therapist_id) || {}), is_assessment_specialist:specialistById.get(item.therapist_id)===true }));
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
      const { data: detailRows } = await db.rpc("admin_list_request_details");
      const detailsByRequest = new Map((detailRows || []).map(item => [item.request_id, item.client_message]));
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
        tr.dataset.timezone = timezoneByRequest.get(item.request_id) || Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tehran";
        const add = value => { const td = document.createElement("td"); td.textContent = safe(value); tr.append(td); return td; };
        const clientCell=add(item.client_name);
        const clientMessage=detailsByRequest.get(item.request_id);
        if(clientMessage){const note=document.createElement("small");note.className="request-client-note";note.textContent=clientMessage;clientCell.append(document.createElement("br"),note);}
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
          const slotSelect = document.createElement("select");
          slotSelect.setAttribute("aria-label","زمان آزاد برای جلسه");
          const placeholder=document.createElement("option");placeholder.value="";placeholder.textContent="در حال دریافت زمان‌های آزاد…";slotSelect.append(placeholder);
          const schedule = document.createElement("button");
          schedule.type = "button"; schedule.className = "button primary"; schedule.textContent = "ثبت جلسه از زمان آزاد";
          const loadSlots = async () => {
            const { data: slots, error: slotsError } = await db.rpc("admin_list_available_slots_for_request",{p_request_id:item.request_id});
            slotSelect.replaceChildren();
            const first=document.createElement("option");first.value="";first.textContent=slotsError?"مهاجرت ظرفیت هنوز فعال نیست":(slots?.length?"انتخاب زمان آزاد":"زمان آزادی ثبت نشده است");slotSelect.append(first);
            if(slotsError){
              const time=document.createElement("input");time.type="datetime-local";time.setAttribute("aria-label","زمان جلسه به وقت مدیر");
              const manual=document.createElement("button");manual.type="button";manual.className="button outline";manual.textContent="ثبت دستی با زمان هماهنگ‌شده";
              manual.addEventListener("click",()=>scheduleRequest(item.request_id,time.value));
              action.append(time,manual);
              setStatus("مدیریت ظرفیت زمان‌بندی فعال نیست؛ برای ادامه از زمان دستی هماهنگ‌شده استفاده کن.");
            } else {
              (slots||[]).forEach(slot=>{
                const option=document.createElement("option");option.value=slot.slot_id;
                const zone=slot.client_timezone||"Asia/Tehran";
                option.textContent=new Intl.DateTimeFormat("fa-IR",{dateStyle:"medium",timeStyle:"short",timeZone:zone}).format(new Date(slot.starts_at))+" · "+zone;
                slotSelect.append(option);
              });
            }
          };
          loadSlots();
          schedule.disabled=true;
          slotSelect.addEventListener("change",()=>{schedule.disabled=!slotSelect.value;});
          schedule.addEventListener("click",async()=>{
            if(!slotSelect.value)return;
            schedule.disabled=true;
            const {error:scheduleError}=await db.rpc("admin_schedule_request_from_slot",{p_request_id:item.request_id,p_slot_id:slotSelect.value});
            if(scheduleError){schedule.disabled=false;setStatus(scheduleError.message||"ثبت جلسه ناموفق بود.",true);return;}
            setStatus("جلسه از ظرفیت آزاد انتخاب‌شده ثبت شد.");
            await loadRequests();
          });
          action.append(slotSelect,schedule);
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
      const row = requests.querySelector("tr[data-request-id=\"" + requestId + "\"]");
      const timeZone = row?.dataset.timezone || "Asia/Tehran";
      let start;
      try { start = localDateTimeInZone(localValue,timeZone); }
      catch(error) { setStatus(error.message,true); return; }
      if (Number.isNaN(start.getTime()) || start <= new Date()) {
        setStatus("زمان جلسه باید در آینده باشد.", true); return;
      }
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
    const eventDate=id=>{const v=eventValue(id);return v?localDateTimeInZone(v,eventValue("eventTimezone")||Intl.DateTimeFormat().resolvedOptions().timeZone||"Asia/Tehran").toISOString():null;};
    const localInputValue=(value,zone)=>{
      if(!value)return "";
      const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(value)).map(p=>[p.type,p.value]));
      return parts.year+"-"+parts.month+"-"+parts.day+"T"+parts.hour+":"+parts.minute;
    };
    function clearWorkshopEditor(){
      eventForm?.reset();
      document.getElementById("eventId").value="";
      document.getElementById("eventFormHeading").textContent="ایجاد کارگاه یا نشست جدید";
      document.getElementById("eventCancelEdit").hidden=true;
      document.getElementById("eventTimezone").value=Intl.DateTimeFormat().resolvedOptions().timeZone||"Asia/Tehran";
      document.getElementById("eventLanguages").value="fa";
      document.getElementById("eventFee").value="0";
    }
    async function editWorkshop(id){
      const {data,error}=await db.rpc("admin_get_workshop",{p_workshop_id:id});
      if(error)throw error;
      const item=data?.[0];if(!item)throw new Error("رویداد پیدا نشد.");
      const zone=item.timezone||"Asia/Tehran";
      const values={eventId:item.id,eventSlug:item.slug,eventTitle:item.title,eventSummary:item.summary,eventDescription:item.description,
        eventPresenter:item.presenter_name,eventPresenterBio:item.presenter_bio,eventLanguages:(item.languages||["fa"]).join(","),
        eventTopics:(item.topics||[]).join(","),eventFormat:item.format,eventPlatform:item.platform,eventVenue:item.venue||"",
        eventStarts:localInputValue(item.starts_at,zone),eventEnds:localInputValue(item.ends_at,zone),eventTimezone:zone,
        eventCapacity:item.capacity??"",eventFee:item.fee_amount,eventCurrency:item.currency,eventStatus:item.status,
        eventDeadline:localInputValue(item.registration_deadline,zone),eventMeetingUrl:item.meeting_url||"",eventMeetingPassword:item.meeting_password||""};
      Object.entries(values).forEach(([id,value])=>{const input=document.getElementById(id);if(input)input.value=value;});
      document.getElementById("eventFormHeading").textContent="ویرایش کارگاه: "+item.title;
      document.getElementById("eventCancelEdit").hidden=false;
      eventForm.scrollIntoView({behavior:"smooth",block:"start"});
    }
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
        const editBtn=document.createElement("button");editBtn.type="button";editBtn.className="button outline";editBtn.textContent="ویرایش اطلاعات";
        editBtn.addEventListener("click",()=>editWorkshop(item.id).catch(error=>eventStatus.textContent=error.message||"بارگذاری رویداد ناموفق بود."));
        card.append(h,p,btn,statusBtn,editBtn);eventList.append(card);
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
          p_workshop_id:eventValue("eventId")||null,p_slug:eventValue("eventSlug"),p_title:eventValue("eventTitle"),
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
        clearWorkshopEditor();
        eventStatus.textContent="رویداد ذخیره شد.";await loadWorkshops();
      }catch(error){eventStatus.textContent=error.message||"ذخیره رویداد ناموفق بود.";}
    });
    document.getElementById("eventCancelEdit")?.addEventListener("click",clearWorkshopEditor);
    document.getElementById("yadRefreshWorkshops")?.addEventListener("click",()=>loadWorkshops().catch(e=>eventStatus.textContent=e.message));

    root.addEventListener("submit", async event => {
      event.preventDefault();
      try {
        const wantsVerification = document.getElementById("yadVerified").checked;
        const wantsAssessmentSpecialist=document.getElementById("yadAssessmentSpecialist").checked;
        if(wantsAssessmentSpecialist&&(!wantsVerification||!document.getElementById("yadListed").checked))throw new Error("متخصص ارزیابی باید پس از تأیید مدارک در فهرست عمومی منتشر شود.");
        const ownerUserId = val("yadTherapistOwnerUserId").trim();
        if (ownerUserId && !wantsVerification) {
          throw new Error("اتصال حساب کاربری درمانگر فقط پس از ثبت و تأیید صلاحیت حرفه‌ای امکان‌پذیر است.");
        }
        setStatus("در حال ذخیره پروفایل…");
        const photo = document.getElementById("yadPhoto").files[0];
        const documentFile = document.getElementById("yadLicenseDocument").files[0];
        const scopeDocumentFile = document.getElementById("yadScopeDocument").files[0];
        const photoPath = await upload("therapist-photos", photo, val("yadExistingPhoto"));
        const documentPath = await upload("therapist-documents", documentFile, val("yadExistingDocument"));
        const scopeDocumentPath = await upload("therapist-documents", scopeDocumentFile, val("yadExistingScopeDocument"));
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
          // Legacy database columns remain required by the existing RPC; live prices are stored per therapist.
          p_fee_amount: 0,
          p_fee_currency: "IRR",
          p_photo_path: photoPath,
          p_license_number: val("yadLicense") || null,
          p_issuing_authority: val("yadAuthority").trim(),
          p_document_path: documentPath,
          p_verified: false,
          p_is_listed: false
        };
        const { data: savedId, error } = await db.rpc("admin_save_therapist", payload);
        if (error) throw error;
        const metadataId = savedId || val("yadTherapistId");
        if (wantsVerification) {
          const { error: verificationError } = await db.rpc("admin_verify_therapist", {
            p_therapist_id: metadataId,
            p_license_number: val("yadLicense"),
            p_license_expires_at: val("yadLicenseExpires") || null,
            p_registry_reference: val("yadRegistryReference"),
            p_psychotherapy_scope_evidence_reference: scopeDocumentPath,
            p_jurisdiction_review_reference: val("yadJurisdictionReviewReference"),
            p_approved_jurisdictions: split(val("yadJurisdictions")).map(code => code.toUpperCase()),
            p_years_experience: val("yadYearsExperience") ? Number(val("yadYearsExperience")) : null,
            p_accepting_new_clients: document.getElementById("yadAcceptingNewClients").checked,
            p_publish: document.getElementById("yadListed").checked
          });
          if (verificationError) throw verificationError;
          if (ownerUserId) {
            const { error: ownerError } = await db.rpc("admin_assign_therapist_user", {
              p_therapist_id: metadataId,
              p_user_id: ownerUserId
            });
            if (ownerError) throw ownerError;
          }
        }
        const {error:assessmentSpecialistError}=await db.rpc("admin_set_assessment_specialist",{p_therapist_id:metadataId,p_enabled:wantsAssessmentSpecialist});
        if(assessmentSpecialistError)throw assessmentSpecialistError;
        root.reset();
        fillForm(null);
        document.getElementById("yadExistingPhoto").value = "";
        document.getElementById("yadExistingDocument").value = "";
        document.getElementById("yadExistingScopeDocument").value = "";
        setStatus(wantsVerification ? "استعلام پروانه، صلاحیت تخصصی و قلمروهای فعالیت ثبت شد؛ وضعیت انتشار مطابق انتخاب مدیر اعمال شد." : "پروفایل ذخیره شد اما تا تکمیل استعلام رسمی، احراز صلاحیت تخصصی و بررسی قلمروها منتشر یا برای پذیرش مراجع فعال نمی‌شود.");
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