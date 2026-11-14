(() => {
  const config = window.YAD_SUPABASE_CONFIG || {};
  const page = location.pathname.split("/").pop();
  const requiredRole = page === "admin.html" ? "admin" : page === "therapist.html" ? "therapist" : "client";
  const labels = {client:"مراجع",therapist:"درمانگر",admin:"مدیر"};
  const wrap = document.querySelector(".portal-wrap");
  if (!wrap) return;
  const original = [...wrap.children].filter(el => !el.classList.contains("universal-language"));
  original.forEach(el => el.hidden = true);

  const gate = document.createElement("section");
  gate.className = "portal-card auth-gate";
  gate.innerHTML = '<span class="eyebrow">ورود امن به یادسنتر</span><h2>ورود به پنل '+labels[requiredRole]+'</h2><p class="auth-description">برای مشاهدهٔ فضای شخصی، ابتدا وارد حساب کاربری خود شوید.</p><div class="auth-fields"><label>ایمیل<input id="yadEmail" type="email" autocomplete="email" required></label><label>رمز عبور<input id="yadPassword" type="password" autocomplete="current-password" minlength="8" required></label><label id="yadNameLabel" hidden>نام نمایشی<input id="yadName" autocomplete="name"></label></div><div class="auth-actions"><button class="button primary" id="yadLogin">ورود</button><button class="button outline" id="yadSignup" type="button">ساخت حساب مراجع</button></div><section id="yadMfaPanel" class="portal-card" hidden><h3>تأیید دومرحله‌ای مدیر</h3><p id="yadMfaHelp">برای دسترسی به پنل مدیریت، کد برنامهٔ احراز هویت را وارد کنید.</p><div id="yadMfaQrWrap" hidden style="text-align:center;margin:16px 0"><img id="yadMfaQr" alt="QR code for authenticator setup" style="max-width:220px;width:100%;background:white;padding:10px;border-radius:12px"><p>اگر امکان اسکن QR ندارید، کلید راه‌اندازی را در برنامهٔ Authenticator به‌صورت دستی وارد کنید.</p><input id="yadMfaSecret" type="text" readonly aria-label="Authenticator setup key" style="width:100%;direction:ltr"></div><label>کد شش‌رقمی برنامهٔ Authenticator<input id="yadMfaCode" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" style="width:100%;padding:12px;direction:ltr"></label><button class="button primary" id="yadMfaVerify" type="button">تأیید کد و ادامه</button><button class="textlink" id="yadMfaLogout" type="button">خروج از حساب</button></section><p class="auth-status" id="yadAuthStatus" role="status" aria-live="polite"></p><button class="textlink" id="yadWrongRoleLogout" type="button" hidden>خروج از حساب فعلی</button><button class="textlink" id="yadReset" type="button">بازیابی رمز عبور</button><div class="notice auth-config-note" id="yadConfigNote" hidden>اتصال امن هنوز پیکربندی نشده است. پس از ایجاد پروژهٔ Supabase، فقط URL پروژه و کلید عمومی anon را در فایل supabase-config.js قرار دهید. کلید service-role هرگز نباید در مرورگر قرار گیرد.</div>';
  wrap.prepend(gate);
  const status = gate.querySelector("#yadAuthStatus");
  const setStatus = (message, bad=false) => { status.textContent=message; status.dataset.error=bad?"true":"false"; };
  const configReady = /^https:\/\//.test(config.url || "") && typeof config.anonKey === "string" && config.anonKey.length > 20;
  if (!configReady || !window.supabase?.createClient) {
    gate.querySelector("#yadConfigNote").hidden=false;
    gate.querySelector("#yadLogin").disabled=true;
    gate.querySelector("#yadSignup").disabled=true;
    gate.querySelector("#yadReset").disabled=true;
    return;
  }
  const client = window.supabase.createClient(config.url, config.anonKey, {
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  const email = gate.querySelector("#yadEmail");
  const password = gate.querySelector("#yadPassword");
  const nameLabel = gate.querySelector("#yadNameLabel");
  const name = gate.querySelector("#yadName");
  const login = gate.querySelector("#yadLogin");
  const signup = gate.querySelector("#yadSignup");
  const mfaPanel = gate.querySelector("#yadMfaPanel");
  const mfaCode = gate.querySelector("#yadMfaCode");
  const mfaVerify = gate.querySelector("#yadMfaVerify");
  if (requiredRole !== "client") signup.hidden = true;
  let mode = "login";
  let pendingFactorId = null;
  let pendingChallengeId = null;
  let mfaBusy = false;
  const busy = value => { login.disabled=value; signup.disabled=value; };
  function showMfaPanel(help, setup) {
    gate.hidden = false;
    gate.querySelector(".auth-fields").hidden = true;
    gate.querySelector(".auth-actions").hidden = true;
    gate.querySelector("#yadReset").hidden = true;
    mfaPanel.hidden = false;
    gate.querySelector("#yadMfaHelp").textContent = help;
    gate.querySelector("#yadMfaQrWrap").hidden = !setup;
    mfaCode.value = "";
    setStatus("برای ادامه، احراز هویت دومرحله‌ای لازم است.");
    mfaCode.focus();
  }
  async function beginAdminMfa() {
    if (mfaBusy) return false;
    mfaBusy = true;
    try {
      const {data: assurance, error: assuranceError} = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;
      if (assurance?.currentLevel === "aal2") return true;
      const {data: factorData, error: factorError} = await client.auth.mfa.listFactors();
      if (factorError) throw factorError;
      const verified = (factorData?.totp || []).find(f => f.status === "verified");
      if (verified) {
        pendingFactorId = verified.id;
        const {data: challenge, error: challengeError} = await client.auth.mfa.challenge({factorId:pendingFactorId});
        if (challengeError) throw challengeError;
        pendingChallengeId = challenge.id;
        showMfaPanel("کد شش‌رقمی برنامهٔ Authenticator را وارد کنید تا ورود مدیر تکمیل شود.", false);
        return false;
      }
      const {data: enrollment, error: enrollmentError} = await client.auth.mfa.enroll({
        factorType:"totp", friendlyName:"YAD Center Admin Authenticator"
      });
      if (enrollmentError) throw enrollmentError;
      pendingFactorId = enrollment.id;
      const qr = gate.querySelector("#yadMfaQr");
      qr.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(enrollment.totp.qr_code);
      gate.querySelector("#yadMfaSecret").value = enrollment.totp.secret;
      const {data: challenge, error: challengeError} = await client.auth.mfa.challenge({factorId:pendingFactorId});
      if (challengeError) throw challengeError;
      pendingChallengeId = challenge.id;
      showMfaPanel("برای حساب مدیر هنوز عامل دومرحله‌ای ثبت نشده است. QR را با برنامهٔ Authenticator اسکن کنید؛ یا کلید را دستی وارد کنید، سپس کد شش‌رقمی را بنویسید.", true);
      return false;
    } finally { mfaBusy = false; }
  }
  async function showSession(session) {
    if (!session?.user) {
      original.forEach(el=>el.hidden=true);
      gate.hidden=false;
      mfaPanel.hidden=true;
      gate.querySelector(".auth-fields").hidden=false;
      gate.querySelector(".auth-actions").hidden=false;
      gate.querySelector("#yadReset").hidden=false;
      return;
    }
    const {data,error} = await client.from("profiles").select("role,display_name").eq("id",session.user.id).maybeSingle();
    if (error || !data) { setStatus("پروفایل حساب در دسترس نیست. لطفاً پشتیبانی را مطلع کنید.",true); return; }
    if (data.role !== requiredRole) {
      gate.hidden=false;
      gate.querySelector("#yadWrongRoleLogout").hidden=false;
      setStatus("این حساب نقش «"+(labels[data.role] || data.role)+"» دارد و اجازهٔ ورود به پنل «"+labels[requiredRole]+"» را ندارد.",true);
      return;
    }
    if (requiredRole === "admin") {
      try {
        const allowed = await beginAdminMfa();
        if (!allowed) return;
      } catch (error) {
        setStatus("راه‌اندازی یا تأیید MFA انجام نشد. اتصال را بررسی کنید و دوباره تلاش کنید.",true);
        return;
      }
    }
    mfaPanel.hidden=true;
    gate.querySelector(".auth-fields").hidden=false;
    gate.querySelector(".auth-actions").hidden=false;
    gate.querySelector("#yadReset").hidden=false;
    gate.querySelector("#yadWrongRoleLogout").hidden=true;
    gate.hidden=true;
    original.forEach(el=>el.hidden=false);
    let bar=document.getElementById("yadSessionBar");
    if(!bar){
      bar=document.createElement("div");bar.id="yadSessionBar";bar.className="portal-card session-bar";
      bar.innerHTML='<span id="yadSessionText"></span><button id="yadLogout" class="button outline" type="button">خروج امن</button>';
      wrap.insertBefore(bar,original[0] || null);
      bar.querySelector("#yadLogout").addEventListener("click",async()=>{
        const {error}=await client.auth.signOut();
        if(error){setStatus("خروج انجام نشد؛ دوباره تلاش کنید.",true);return;}
        location.reload();
      });
    }
    bar.querySelector("#yadSessionText").textContent="وارد شده‌اید: "+(data.display_name || session.user.email);
  }
  async function refresh(){const {data}=await client.auth.getSession();await showSession(data.session);}
  client.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>{if(!mfaBusy)showSession(session);},0);});
  login.addEventListener("click",async()=>{
    if(!email.value.trim() || !password.value){setStatus("ایمیل و رمز عبور را وارد کنید.",true);return;}
    busy(true);setStatus("در حال بررسی اطلاعات ورود…");
    const {data,error}=await client.auth.signInWithPassword({email:email.value.trim(),password:password.value});
    busy(false);
    if(error){setStatus("ورود انجام نشد. ایمیل و رمز عبور را بررسی کنید.",true);return;}
    await showSession(data.session);
  });
  signup.addEventListener("click",async()=>{
    if(mode==="login"){
      mode="signup";nameLabel.hidden=false;login.textContent="ثبت‌نام";signup.textContent="بازگشت به ورود";setStatus("ثبت‌نام فقط برای حساب مراجع فعال است.");return;
    }
    if(!email.value.trim() || password.value.length<8){setStatus("ایمیل معتبر و رمز عبور حداقل ۸ کاراکتری وارد کنید.",true);return;}
    busy(true);setStatus("در حال ایجاد حساب…");
    const {data,error}=await client.auth.signUp({email:email.value.trim(),password:password.value,options:{data:{display_name:name.value.trim()}}});
    busy(false);
    if(error){setStatus("ثبت‌نام انجام نشد. اطلاعات را بررسی کنید یا بعداً تلاش کنید.",true);return;}
    if(data.session){await showSession(data.session);}
    else setStatus("حساب ایجاد شد. اگر تأیید ایمیل فعال باشد، پیوند تأیید برای شما ارسال می‌شود.");
  });
  mfaVerify.addEventListener("click",async()=>{
    const code=mfaCode.value.replace(/\s/g,"");
    if(!pendingFactorId || !pendingChallengeId || !/^\d{6}$/.test(code)){setStatus("کد شش‌رقمی معتبر را وارد کنید.",true);return;}
    mfaVerify.disabled=true;
    const {error}=await client.auth.mfa.verify({factorId:pendingFactorId,challengeId:pendingChallengeId,code});
    mfaVerify.disabled=false;
    if(error){setStatus("کد تأیید نشد؛ کد تازه‌ای از برنامه بردارید و دوباره تلاش کنید.",true);return;}
    const {data: refreshed,error:refreshError}=await client.auth.refreshSession();
    if(refreshError || !refreshed.session){setStatus("تأیید انجام شد اما تازه‌سازی نشست ناموفق بود؛ صفحه را دوباره بارگذاری کنید.",true);return;}
    pendingFactorId=null;pendingChallengeId=null;
    await showSession(refreshed.session);
  });
  gate.querySelector("#yadMfaLogout").addEventListener("click",async()=>{
    const {error}=await client.auth.signOut();
    if(error){setStatus("خروج انجام نشد؛ دوباره تلاش کنید.",true);return;}
    location.reload();
  });
  gate.querySelector("#yadWrongRoleLogout").addEventListener("click",async()=>{
    const {error}=await client.auth.signOut();
    if(error){setStatus("خروج انجام نشد؛ دوباره تلاش کنید.",true);return;}
    location.reload();
  });
  gate.querySelector("#yadReset").addEventListener("click",async()=>{
    if(!email.value.trim()){setStatus("ابتدا ایمیل خود را وارد کنید.",true);return;}
    const {error}=await client.auth.resetPasswordForEmail(email.value.trim(),{redirectTo:location.origin+"/client.html"});
    setStatus(error?"ارسال پیوند بازیابی ممکن نشد.":"اگر این ایمیل ثبت شده باشد، پیوند تأیید ارسال می‌شود.",!!error);
  });
  refresh();
})();