(()=>{const p=location.pathname;const prefix=p.includes("/articles/")?"../":"";const links=[["خانه","index.html","⌂"],["خدمات و درمانگران","index.html#services","✳"],["راهنمای پاسخ‌گو","assistant.html","؟"],["راهنمای اولیه انتخاب درمانگر","initial-guidance.html","◎"],["پنل مراجع","client.html","◉"],["مدیریت","admin.html","⚙"],["کارگاه‌ها و نشست‌ها","index.html#workshops","◈"],["مقالات تحلیلی","articles/index.html","▤"],["استانداردها و مسئولیت‌ها","standards.html","§"],["قوانین سایت","rules.html","§"]];const aside=document.createElement("aside");aside.className="side-nav";aside.innerHTML='<a class="side-brand" href="'+prefix+'index.html"><span class="brandmark">ی</span><b>یادسنتر</b></a><small>منوی اصلی</small>'+links.map(([n,h,i])=>'<a href="'+prefix+h+'"><i>'+i+'</i>'+n+'</a>').join("")+'<div class="side-note">همراهی حرفه‌ای<br>با احترام به پیچیدگی انسان</div>';document.body.appendChild(aside);document.body.classList.add("with-sidebar");const css=document.createElement("style");css.textContent='.side-nav{position:fixed;z-index:30;right:0;top:0;bottom:0;width:235px;padding:24px 16px;background:#123f46;color:#eaf7f2;display:flex;flex-direction:column;gap:8px;box-shadow:-8px 0 30px #123f4610}.side-brand{display:flex;align-items:center;gap:10px;color:white;font-size:19px;margin-bottom:22px}.side-brand .brandmark{display:grid;place-items:center;background:#35c6b0;color:#123f46;width:42px;height:42px;border-radius:14px}.side-nav>small{color:#8fbab0;padding:0 10px;margin-bottom:5px}.side-nav>a:not(.side-brand){padding:10px;border-radius:11px;color:#e1f1eb;font-size:13px}.side-nav>a:hover{background:#ffffff18}.side-nav i{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:8px;background:#ffffff15;font-style:normal;margin-left:9px}.side-note{margin-top:auto;background:#ffffff12;padding:14px;border-radius:13px;color:#b8d9d0;font-size:11px}.with-sidebar{padding-right:235px}.portal-main{min-height:100vh;padding:65px 0;background:#fffdfa}.portal-wrap{width:min(980px,90%);margin:auto}.portal-wrap h1{font-size:clamp(30px,4vw,44px);color:#123f46;margin:10px 0}.portal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:28px 0}.portal-card{background:white;border:1px solid #e5ece8;border-radius:18px;padding:23px;box-shadow:0 12px 35px #123f4608}.portal-card b{color:#123f46}.portal-card p{font-size:13px;color:#687b7c}.status-pending{font-size:11px;color:#9a6d31;background:#fff4dc;border-radius:20px;padding:5px 10px}.bank-card{margin:28px 0}.bank-card label{display:block;margin-top:14px;font-size:12px;color:#687b7c}.bank-card input,.bank-card select{display:block;width:100%;padding:11px;border:1px solid #e5ece8;border-radius:10px;margin-top:5px;background:#f5f6f5}.legal h2{color:#123f46;margin-top:30px}.legal p{line-height:2.2;color:#52696a}.assistant-shell{background:white;border:1px solid #e5ece8;border-radius:20px;padding:20px;box-shadow:0 20px 50px #123f4610;margin:28px 0}.assistant-messages{min-height:180px;max-height:340px;overflow:auto;background:#f4faf7;border-radius:14px;padding:15px}.bot-msg,.user-msg{max-width:85%;padding:12px 15px;border-radius:14px;margin:8px 0;font-size:13px;line-height:2}.bot-msg{background:white;color:#345052;border:1px solid #e4efea}.user-msg{background:#123f46;color:white;margin-right:auto}.quick-questions{display:flex;gap:8px;flex-wrap:wrap;margin:15px 0}.quick-questions button{border:1px solid #dcebe5;background:#f7fbf9;color:#17685f;padding:8px 12px;border-radius:20px;font:inherit;font-size:11px;cursor:pointer}.assistant-form{display:flex;gap:9px}.assistant-form input{flex:1;min-width:0;border:1px solid #dce8e3;border-radius:12px;padding:12px;font:inherit}.assistant-form .button{border:0;cursor:pointer}.with-sidebar footer{margin-right:0}@media(max-width:760px){.side-nav{width:64px;padding:12px 7px;align-items:center}.side-brand b,.side-nav>small,.side-nav>a:not(.side-brand){font-size:0}.side-nav>a:not(.side-brand){width:48px;height:45px;padding:8px;text-align:center}.side-nav i{font-size:17px;margin:0}.side-note{display:none}.with-sidebar{padding-right:64px}.portal-main{padding:35px 0}.portal-grid{grid-template-columns:1fr}.assistant-form{flex-wrap:wrap}.assistant-form input{flex-basis:100%}}';document.head.appendChild(css);const answers=[[/شروع|درمان|جلسه/,'برای شروع، ابتدا حوزهٔ نیاز و زبان گفت‌وگو را مشخص کن و اطلاعات حرفه‌ای درمانگر را بخوان. جلسهٔ اول معمولاً فرصتی برای شناخت مسئله و توافق دربارهٔ چارچوب کار است.'],[/روان.?پزشک|روان.?شناس/,'روان‌شناس در ارزیابی و مداخلات روان‌شناختی فعالیت می‌کند؛ روان‌پزشک پزشک متخصص است و می‌تواند ارزیابی پزشکی و در صورت نیاز دارودرمانی انجام دهد. انتخاب مناسب به نیاز فرد بستگی دارد.'],[/انتخاب|درمانگر/,'به تحصیلات، مجوز معتبر، تجربه، حوزهٔ تخصص، رویکرد درمانی، زبان و امکان ارتباط توجه کن. هیچ عنوان یا امتیازی به‌تنهایی تضمین‌کنندهٔ تناسب درمانگر نیست.'],[/نوبت|رزرو/,'سامانهٔ رزرو آنلاین هنوز فعال نشده است. پس از تکمیل زیرساخت امن، زمان‌های آزاد و شرایط پرداخت نمایش داده می‌شود.'],[/قانون|حریم|محرمان/,'قوانین و اصول حریم خصوصی را از بخش «قوانین سایت» در منوی کناری بخوان.'],[/اضطرار|خودکشی|آسیب|خطر/,'اگر خطر فوری برای خودت یا فرد دیگری وجود دارد، همین حالا با اورژانس یا خدمات بحران محل زندگی تماس بگیر؛ این راهنما جایگزین کمک فوری نیست.']];const answerTexts={
fa:[
"برای شروع، ابتدا حوزهٔ نیاز و زبان گفت‌وگو را مشخص کن و اطلاعات حرفه‌ای درمانگر را بخوان. جلسهٔ اول فرصتی برای شناخت مسئله و توافق درباره چارچوب کار است.",
"روان‌شناس در ارزیابی و مداخلات روان‌شناختی فعالیت می‌کند؛ روان‌پزشک پزشک متخصص است و می‌تواند ارزیابی پزشکی و در صورت نیاز دارودرمانی انجام دهد. انتخاب مناسب به نیاز فرد بستگی دارد.",
"به تحصیلات، مجوز معتبر، تجربه، حوزهٔ تخصص، رویکرد درمانی، زبان و امکان ارتباط توجه کن. هیچ عنوان یا امتیازی به‌تنهایی تضمین‌کنندهٔ تناسب درمانگر نیست.",
"نوبت‌دهی و زمان‌بندی هنوز به‌صورت کامل در مرورگر آزمایش نشده است. درخواست از طریق پنل مراجع ثبت می‌شود و پس از تأیید پرداخت، مدیریت زمان جلسه را هماهنگ می‌کند.",
"قوانین و اصول حریم خصوصی را از بخش «قوانین سایت» بخوان. متن فعلی پیش‌نویس است و پیش از راه‌اندازی عمومی به بازبینی حقوقی نیاز دارد.",
"اگر خطر فوری برای خودت یا فرد دیگری وجود دارد، همین حالا با اورژانس یا خدمات بحران محل زندگی تماس بگیر؛ این راهنما جایگزین کمک فوری نیست.",
"می‌توانم درباره خدمات، انتخاب درمانگر، روند شروع درمان و قوانین سایت راهنمایی عمومی بدهم. برای پرسش‌های بالینی شخصی، ارزیابی متخصص لازم است."
],
en:[
"To begin, identify the kind of support you are looking for and the language you prefer. Review the therapist's verified professional profile. The first session is usually a chance to understand the concern and agree on a working framework.",
"A psychologist provides psychological assessment and interventions. A psychiatrist is a medical doctor who can provide psychiatric assessment and, when appropriate, prescribe medication. The right choice depends on the person's needs.",
"Consider education, a valid professional licence, experience, area of expertise, therapeutic approach, language, and whether communication feels appropriate. No title or rating alone guarantees a good fit.",
"Appointment scheduling has not yet completed browser-level testing. Submit a request through the client area; after payment is verified, YAD Center administration coordinates the session time.",
"Read the site policies and privacy section. The current text is a draft and requires legal review before public launch.",
"If there is immediate danger to you or someone else, contact local emergency or crisis services now. This guide is not a substitute for urgent help.",
"I can provide general information about services, choosing a therapist, getting started, and site policies. Personal clinical questions require assessment by a qualified professional."
],
ku:[
"بۆ دەستپێکردن، جۆری یارمەتی و زمانی گفتوگۆ دیاری بکە و پرۆفایلی پشتڕاستکراوی چارەسەرکار بخوێنەوە. دانیشتنی یەکەم بۆ ناسینی کێشە و ڕێککەوتن لەسەر چوارچێوەی کارە.",
"دەروونناس هەڵسەنگاندن و دەستێوەردانی دەروونی ئەنجام دەدات؛ دەروونپزیشک پزیشکی پسپۆڕە و دەتوانێت هەڵسەنگاندنی پزیشکی و لە پێویستیدا دەرمان بنووسێت.",
"خوێندن، مۆڵەتی دروست، ئەزموون، بواری پسپۆڕی، ڕێبازی چارەسەر و زمانی گفتوگۆ بپشکنە. هیچ ناونیشان یان هەڵسەنگاندنێک بە تەنها گونجاوی چارەسەرکار دڵنیا ناکات.",
"تاقیکردنەوەی تەواوی وەرگرتنی کات لە وێبگەڕدا هێشتا نەکراوە. داواکاری لە بەشی مراجع بنێرە؛ دوای پشتڕاستکردنەوەی پارەدان، بەڕێوەبەرایەتی کات ڕێکدەخات.",
"یاساکان و پاراستنی نهێنی لە بەشی یاساکانی ماڵپەڕ بخوێنەوە. دەقی ئێستا پڕۆژەیە و پێویستی بە پشکنینی یاسایی هەیە.",
"ئەگەر مەترسییەکی دەستبەجێ هەیە، ئێستا پەیوەندی بە فریاکەوتن یان خزمەتگوزارییەکانی قەیرانی ناوچەکەت بکە. ئەم ڕێنماییە جێگرەوەی یارمەتیی فریاکەوتن نییە.",
"دەتوانم زانیاری گشتی لەبارەی خزمەتگوزاری، هەڵبژاردنی چارەسەرکار و دەستپێکردن بدەم. پرسیاری کلینیکی کەسی پێویستی بە هەڵسەنگاندنی پسپۆڕ هەیە."
],
tr:[
"Başlamak için ihtiyacınızı ve tercih ettiğiniz görüşme dilini belirleyin; terapistin doğrulanmış profilini inceleyin. İlk seans genellikle konuyu anlamak ve çalışma çerçevesini kararlaştırmak için kullanılır.",
"Psikolog psikolojik değerlendirme ve müdahaleler sunar. Psikiyatrist tıp doktorudur; psikiyatrik değerlendirme yapabilir ve gerektiğinde ilaç yazabilir. Uygun seçim ihtiyaca bağlıdır.",
"Eğitim, geçerli mesleki ruhsat, deneyim, uzmanlık alanı, terapi yaklaşımı ve iletişim dilini değerlendirin. Tek başına unvan veya puan uygunluğu garanti etmez.",
"Randevu süreci henüz tarayıcı düzeyinde tamamen test edilmedi. Danışan alanından talep gönderin; ödeme doğrulandıktan sonra seans saati yönetim tarafından koordine edilir.",
"Site kurallarını ve gizlilik bölümünü okuyun. Mevcut metin taslaktır ve halka açılmadan önce hukuki inceleme gerektirir.",
"Acil tehlike varsa yerel acil yardım veya kriz hizmetleriyle hemen iletişime geçin. Bu rehber acil yardımın yerini tutmaz.",
"Hizmetler, terapist seçimi ve başlangıç süreci hakkında genel bilgi verebilirim. Kişisel klinik sorular için yetkin bir uzmanın değerlendirmesi gerekir."
],
ar:[
"للبدء، حدد نوع الدعم الذي تحتاجه واللغة المفضلة، ثم اقرأ الملف المهني المعتمد للمعالج. تكون الجلسة الأولى عادة فرصة لفهم المشكلة والاتفاق على إطار العمل.",
"يقدم الأخصائي النفسي التقييم والتدخلات النفسية. أما الطبيب النفسي فهو طبيب متخصص يمكنه إجراء تقييم طبي ووصف الدواء عند الحاجة. يعتمد الاختيار على احتياجات الشخص.",
"راجع التعليم والترخيص المهني والخبرة والتخصص والمنهج العلاجي واللغة. لا يضمن المسمى أو التقييم وحده ملاءمة المعالج.",
"لم يكتمل بعد اختبار حجز المواعيد عبر المتصفح. أرسل طلباً من مساحة المراجع؛ وبعد التحقق من الدفع، تنسق الإدارة موعد الجلسة.",
"اقرأ سياسات الموقع والخصوصية. النص الحالي مسودة ويحتاج إلى مراجعة قانونية قبل الإطلاق العام.",
"إذا كان هناك خطر فوري، فاتصل الآن بخدمات الطوارئ أو الأزمات المحلية. هذا الدليل لا يحل محل المساعدة العاجلة.",
"يمكنني تقديم معلومات عامة عن الخدمات واختيار المعالج والبدء. الأسئلة السريرية الشخصية تتطلب تقييماً من مختص مؤهل."
],
es:[
"Para empezar, identifica el tipo de apoyo que buscas y el idioma que prefieres. Revisa el perfil profesional verificado del terapeuta. La primera sesión suele servir para comprender la consulta y acordar el marco de trabajo.",
"El psicólogo realiza evaluaciones e intervenciones psicológicas. El psiquiatra es médico y puede hacer evaluaciones médicas y prescribir medicación cuando corresponda. La elección depende de las necesidades.",
"Ten en cuenta la formación, la licencia profesional vigente, la experiencia, la especialidad, el enfoque terapéutico y el idioma. Ningún título o valoración garantiza por sí solo la compatibilidad.",
"La programación de citas aún no ha completado las pruebas en navegador. Envía una solicitud desde el área del paciente; tras verificar el pago, la administración coordinará la sesión.",
"Consulta las normas del sitio y la sección de privacidad. El texto actual es un borrador y requiere revisión jurídica antes del lanzamiento público.",
"Si existe peligro inmediato, contacta ahora con los servicios locales de emergencia o crisis. Esta guía no sustituye la ayuda urgente.",
"Puedo ofrecer información general sobre los servicios, la elección de terapeuta y el inicio. Las preguntas clínicas personales requieren la evaluación de un profesional cualificado."
],
de:[
"Bestimmen Sie zunächst, welche Unterstützung Sie suchen und welche Sprache Sie bevorzugen. Lesen Sie das geprüfte Berufsprofil. Das Erstgespräch dient meist dazu, das Anliegen zu verstehen und den Arbeitsrahmen zu vereinbaren.",
"Psycholog:innen bieten psychologische Diagnostik und Interventionen an. Psychiater:innen sind Ärzt:innen und können medizinisch beurteilen sowie bei Bedarf Medikamente verschreiben. Die Wahl hängt vom Bedarf ab.",
"Achten Sie auf Ausbildung, gültige Berufszulassung, Erfahrung, Fachgebiet, therapeutischen Ansatz und Sprache. Titel oder Bewertungen allein garantieren keine passende Zusammenarbeit.",
"Die Terminvereinbarung wurde noch nicht vollständig im Browser getestet. Senden Sie eine Anfrage im Klientenbereich; nach Zahlungsprüfung koordiniert die Verwaltung den Termin.",
"Lesen Sie die Website-Regeln und den Datenschutzbereich. Der aktuelle Text ist ein Entwurf und muss vor dem öffentlichen Start rechtlich geprüft werden.",
"Bei unmittelbarer Gefahr wenden Sie sich sofort an den örtlichen Notruf oder Krisendienst. Dieser Leitfaden ersetzt keine akute Hilfe.",
"Ich kann allgemeine Informationen zu Angeboten, Therapeut:innenwahl und den ersten Schritten geben. Persönliche klinische Fragen erfordern die Einschätzung einer qualifizierten Fachperson."
],
fr:[
"Pour commencer, identifiez le type de soutien recherché et la langue souhaitée. Consultez le profil professionnel vérifié du thérapeute. La première séance permet généralement de comprendre la demande et de définir le cadre du travail.",
"Le psychologue réalise des évaluations et interventions psychologiques. Le psychiatre est médecin et peut effectuer une évaluation médicale et prescrire un traitement si nécessaire. Le choix dépend des besoins.",
"Examinez la formation, l’autorisation professionnelle, l’expérience, le domaine d’expertise, l’approche thérapeutique et la langue. Un titre ou une note ne garantit pas à lui seul une bonne adéquation.",
"La prise de rendez-vous n’a pas encore été entièrement testée dans un navigateur. Envoyez une demande depuis l’espace patient ; après vérification du paiement, l’administration coordonnera la séance.",
"Consultez les règles du site et la section confidentialité. Le texte actuel est un brouillon qui doit faire l’objet d’une révision juridique avant le lancement public.",
"En cas de danger immédiat, contactez sans attendre les services d’urgence ou de crise locaux. Ce guide ne remplace pas une aide urgente.",
"Je peux fournir des informations générales sur les services, le choix d’un thérapeute et les premières démarches. Les questions cliniques personnelles nécessitent l’évaluation d’un professionnel qualifié."
]
};
const patterns=[/شروع|دەستپێ|start|begin|psychotherapy|psychotherapie|psicoterapia|psychothérapie|session|بدء العلاج النفسي/i,/روان.?پزشک|روان.?شناس|psychologist|psychiatrist|psic[oó]logo|psychiatre|psycholog|psycholoog|طبيب نفسي|دەروونناس/i,/انتخاب|درمانگر|therapist|choose|terapist|terapeuta|therapeut|معالج|چارەسەرکار/i,/نوبت|رزرو|appointment|booking|rendez|termin|cita|موعد|کات/i,/قانون|حریم|محرمان|policy|privacy|rule|confidential|privacidad|datenschutz|confidentialité|سياسة|یاسا/i,/اضطرار|خودکشی|آسیب|خطر|emergency|suicide|harm|crisis|urgence|notfall|emergencia|خطر|مەترسی/i];
function reply(q){
 const box=document.getElementById("assistantMessages");if(!box)return;
 const u=document.createElement("div");u.className="user-msg";u.textContent=q;box.append(u);
 const lang=document.documentElement.lang||"fa";
 const index=patterns.findIndex(re=>re.test(q));
 const b=document.createElement("div");b.className="bot-msg";b.textContent=(answerTexts[lang]||answerTexts.fa)[index>=0?index:6];box.append(b);box.scrollTop=box.scrollHeight;
}document.getElementById("assistantForm")?.addEventListener("submit",e=>{e.preventDefault();const input=document.getElementById("assistantInput");if(input.value.trim()){reply(input.value.trim());input.value="";}});document.querySelectorAll("[data-q]").forEach(b=>b.addEventListener("click",()=>reply(b.dataset.q)));})();
/* YAD Center: language foundation + secure admin data views */
(()=> {
  const translations = {
    fa: {
      menu:"منوی اصلی", links:["خانه","خدمات و درمانگران","راهنمای پاسخ‌گو","پنل مراجع","مدیریت","کارگاه‌ها","مقالات تحلیلی","قوانین سایت"],
      language:"زبان", adminEyebrow:"مدیریت متمرکز یادسنتر",adminTitle:"پنل مدیریت یادسنتر",
      adminLead:"مدیریت درمانگران، مراجعان، نوبت‌ها و پرداخت‌ها از طریق مدیریت مرکزی یادسنتر انجام می‌شود.",
      opsTitle:"عملیات و وضعیت سامانه",loading:"در حال اتصال امن…",appointmentsTitle:"نوبت‌ها",
      appointmentsHelp:"فهرست نوبت‌های ثبت‌شده در سامانه.",paymentsTitle:"پرداخت‌ها",
      paymentsHelp:"بررسی رسیدهای پرداخت و ثبت نتیجه.",refresh:"به‌روزرسانی",client:"مراجع",phone:"تلفن",
      therapist:"درمانگر",sessionTime:"زمان جلسه",market:"بازار",status:"وضعیت",paymentsReviewHelp:"رسیدهای انتقال دستی را بررسی و تأیید یا رد کن.",
      amount:"مبلغ",reference:"شماره پیگیری",createdAt:"تاریخ ثبت",action:"اقدام",
      therapistManagement:"مدیریت درمانگران",therapistWorkflow:"درمانگر اطلاعات و مدارک حرفه‌ای را فقط از مسیر خصوصی مورد توافق با مدیریت ارسال می‌کند. مدیر پس از بررسی، پروفایل را ثبت می‌کند؛ عکس در فضای عمومی و مدرک مجوز در فضای خصوصی ذخیره می‌شود. درمانگر در این صفحه حساب مستقل یا امکان بارگذاری مدارک ندارد.",
      therapistSecurity:"حساب درمانگر و امکان ورود مستقل برای او در این مدل فعال نیست. تأیید هویت و انتشار پروفایل فقط با تصمیم مدیر انجام می‌شود.",
      financialRules:"قواعد مالی یادسنتر",financialHelp:"پرداخت ابتدا به یادسنتر انجام می‌شود. مراجع درمانگر را انتخاب می‌کند و پس از تأیید واقعی پرداخت، مدیریت زمان جلسه را با همان درمانگر هماهنگ می‌کند. تأیید پنل جایگزین بررسی بانکی نیست.",workflowWarning:"پرداخت دستی فقط پس از بررسی واقعی واریز تأیید شود. پس از تأیید پرداختِ درخواست جدید، زمان جلسه را در بخش درخواست‌ها ثبت کن.",
      noRows:"موردی برای نمایش وجود ندارد.",approve:"تأیید پرداخت",reject:"رد پرداخت",reviewConfirm:"آیا از ثبت این تصمیم مطمئنی؟",
      approved:"پرداخت تأیید شد.",rejected:"پرداخت رد شد.",refreshError:"دریافت اطلاعات ناموفق بود. دوباره تلاش کن.",
      noAdmin:"این بخش فقط برای حساب مدیر در دسترس است.",connecting:"در حال اتصال به اطلاعات سامانه…",
      requested:"در انتظار پرداخت",confirmed:"تأییدشده",completed:"انجام‌شده",cancelled:"لغوشده",
      pending:"در انتظار بررسی",paid:"پرداخت‌شده",failed:"ناموفق",refunded:"بازپرداخت‌شده",
      iran:"ایران",international:"بین‌المللی",unknown:"نامشخص",reviewing:"در حال ثبت…",genericError:"عملیات انجام نشد."
    },
    en: {
      menu:"Main menu", links:["Home","Services & therapists","Help guide","Client area","Admin","Workshops","Articles","Site policies"],
      language:"Language", adminEyebrow:"Central YAD Center administration",adminTitle:"YAD Center Admin",
      adminLead:"Therapists, clients, appointments and payments are managed centrally by YAD Center.",
      opsTitle:"Operations and system status",loading:"Connecting securely…",appointmentsTitle:"Appointments",
      appointmentsHelp:"Appointments recorded in the platform.",paymentsTitle:"Payments",
      paymentsHelp:"Review payment references and record the decision.",refresh:"Refresh",client:"Client",phone:"Phone",
      therapist:"Therapist",sessionTime:"Session time",market:"Market",status:"Status",paymentsReviewHelp:"Review manual-transfer references and approve or reject them.",
      amount:"Amount",reference:"Payment reference",createdAt:"Created at",action:"Action",
      therapistManagement:"Therapist management",therapistWorkflow:"Therapists provide their profile details and professional documents through a private channel agreed with YAD Center management. The administrator reviews and creates the profile; profile photos are stored in public storage and license evidence in private storage. Therapists do not have independent accounts or document-upload access on this page.",
      therapistSecurity:"Therapists do not receive independent self-registration or profile-publishing access in this model. Verification and publication remain administrator-controlled.",
      financialRules:"YAD Center payment workflow",financialHelp:"Clients pay YAD Center first. Clients choose their therapist. After the payment is verified, the administrator schedules the session with that therapist. This panel does not verify a bank transfer.",workflowWarning:"Manual transfers must only be approved after checking the actual bank receipt. After approving a new request, schedule the session in the Requests section.",
      noRows:"There are no records to display.",approve:"Approve payment",reject:"Reject payment",reviewConfirm:"Are you sure you want to record this decision?",
      approved:"Payment approved.",rejected:"Payment rejected.",refreshError:"Could not load the data. Please try again.",
      noAdmin:"This area is available to administrators only.",connecting:"Connecting to platform data…",
      requested:"Awaiting payment",confirmed:"Confirmed",completed:"Completed",cancelled:"Cancelled",
      pending:"Pending review",paid:"Paid",failed:"Failed",refunded:"Refunded",
      iran:"Iran",international:"International",unknown:"Unknown",reviewing:"Saving…",genericError:"The action could not be completed."
    }
  };
  const clientLabels = {
    fa:{sessionCountry:"کشور محل حضور هنگام جلسه (کد دوحرفی)",adultConfirm:"تأیید می‌کنم ۱۸ سال یا بیشتر دارم.",preferredTime:"زمان‌های پیشنهادی (اختیاری؛ نوبت پس از هماهنگی قطعی می‌شود)",preferredTimePlaceholder:"مثلاً دوشنبه یا چهارشنبه، عصرها به وقت محل حضور",dataExport:"دریافت نسخهٔ اطلاعات حساب",crisisNotice:"یادسنتر خدمات فوریت‌های روان‌پزشکی یا بحران ارائه نمی‌کند. اگر خطر فوری برای خود یا دیگری وجود دارد، با خدمات اورژانس یا بحران محل حضور خود تماس بگیرید و منتظر پاسخ این سامانه نمانید.",clientPageTitle:"پنل مراجعان",clientLead:"در این بخش می‌توانید درمانگر انتخاب کنید، درخواست بفرستید و وضعیت پرداخت را پیگیری کنید.",clientRequestTitle:"انتخاب درمانگر و ثبت درخواست",clientRequestHelp:"از میان درمانگران تأییدشده انتخاب کنید. پرداخت ابتدا به یادسنتر انجام می‌شود و پس از تأیید، زمان جلسه هماهنگ خواهد شد.",chosenTherapist:"درمانگر موردنظر",paymentMarket:"منطقه پرداخت",internationalCurrency:"واحد پول بین‌المللی",clientMessage:"پیام کوتاه برای هماهنگی (اطلاعات حساس یا جزئیات بالینی ننویسید)",submitRequest:"ثبت درخواست",requestHistory:"درخواست‌ها و وضعیت پرداخت من",loginNotice:"برای ثبت درخواست ابتدا وارد حساب مراجع شوید."},
    en:{sessionCountry:"Country where you will be located during the session (2-letter code)",adultConfirm:"I confirm that I am 18 years of age or older.",preferredTime:"Preferred time windows (optional; the appointment is confirmed after coordination)",preferredTimePlaceholder:"For example, Monday or Wednesday evenings in your local time",dataExport:"Download my account data",crisisNotice:"YAD Center is not an emergency or crisis service. If you or someone else is in immediate danger, contact local emergency or crisis services now; do not wait for a response from this platform.",clientPageTitle:"Client area",clientLead:"Choose a therapist, submit a request, and follow your payment status here.",clientRequestTitle:"Choose a therapist and submit a request",clientRequestHelp:"Choose from verified therapists. Payment is made to YAD Center first; the session is arranged after payment verification.",chosenTherapist:"Preferred therapist",paymentMarket:"Payment region",internationalCurrency:"International currency",clientMessage:"Short coordination message (do not include sensitive or clinical details)",submitRequest:"Submit request",requestHistory:"My requests and payment status",loginNotice:"Sign in with your client account to submit a request."},
    ku:{sessionCountry:"وڵاتی شوێنی بوونت لە کاتی دانیشتن (کۆدی دوو پیت)",adultConfirm:"پشتڕاست دەکەمەوە تەمەنی من ١٨ ساڵ یان زیاترە.",preferredTime:"کاتە پێشنیارکراوەکان (ئارەزوومەندانە؛ کات دوای ڕێککەوتن پشتڕاست دەکرێتەوە)",preferredTimePlaceholder:"بۆ نموونە دووشەممە یان چوارشەممە، ئێواران بە کاتی ناوچەکە",dataExport:"وەرگرتنی کۆپی زانیاریی هەژمار",crisisNotice:"یادسنتر خزمەتگوزاری فریاکەوتنی دەروونی یان قەیران نییە. ئەگەر مەترسییەکی دەستبەجێ بۆ خۆت یان کەسێکی تر هەیە، پەیوەندی بە فریاکەوتن یان خزمەتگوزاری قەیرانی ناوچەکەت بکە و چاوەڕێی وەڵامی ئەم سامانه‌ مەبە.",clientPageTitle:"بەشی مراجع",clientLead:"لێرە دەتوانیت چارەسەرکار هەڵبژێریت و داواکاری و بارودۆخی پارەدان بەدواداچوون بکەیت.",clientRequestTitle:"هەڵبژاردنی چارەسەرکار و تۆمارکردنی داواکاری",clientRequestHelp:"لە نێوان چارەسەرکارە پشتڕاستکراوەکان هەڵبژێرە. پارەدان سەرەتا بۆ یادسنتر دەکرێت و دوای پشتڕاستکردنەوە کات دیاری دەکرێت.",chosenTherapist:"چارەسەرکاری هەڵبژێردراو",paymentMarket:"ناوچەی پارەدان",internationalCurrency:"دراوی نێودەوڵەتی",clientMessage:"پەیامی کورت بۆ ڕێکخستن (زانیاریی هەستیار یان کلینیکی مەنووسە)",submitRequest:"ناردنی داواکاری",requestHistory:"داواکاری و بارودۆخی پارەدان",loginNotice:"بۆ ناردنی داواکاری بە هەژماری مراجع بچۆ ژوورەوە."},
    tr:{sessionCountry:"Seans sırasında bulunacağınız ülke (2 harfli kod)",adultConfirm:"18 yaşında veya daha büyük olduğumu onaylıyorum.",preferredTime:"Tercih ettiğiniz saat aralıkları (isteğe bağlı; randevu koordinasyon sonrası kesinleşir)",preferredTimePlaceholder:"Örneğin yerel saatinize göre pazartesi veya çarşamba akşamları",dataExport:"Hesap verilerimi indir",crisisNotice:"YAD Center bir acil durum veya kriz hizmeti değildir. Siz ya da başka biri yakın tehlikedeyse hemen yerel acil yardım veya kriz hizmetleriyle iletişime geçin; bu platformdan yanıt beklemeyin.",clientPageTitle:"Danışan alanı",clientLead:"Buradan terapist seçebilir, talep gönderebilir ve ödeme durumunuzu takip edebilirsiniz.",clientRequestTitle:"Terapist seçimi ve talep oluşturma",clientRequestHelp:"Doğrulanmış terapistler arasından seçim yapın. Ödeme önce YAD Center'a yapılır; doğrulama sonrası seans planlanır.",chosenTherapist:"Seçilen terapist",paymentMarket:"Ödeme bölgesi",internationalCurrency:"Uluslararası para birimi",clientMessage:"Kısa koordinasyon mesajı (hassas veya klinik bilgi yazmayın)",submitRequest:"Talep gönder",requestHistory:"Taleplerim ve ödeme durumum",loginNotice:"Talep göndermek için danışan hesabınızla giriş yapın."},
    ar:{sessionCountry:"بلد وجودك أثناء الجلسة (رمز من حرفين)",adultConfirm:"أؤكد أن عمري 18 عاماً أو أكثر.",preferredTime:"الأوقات المفضلة (اختياري؛ يُؤكد الموعد بعد التنسيق)",preferredTimePlaceholder:"مثلاً مساء الاثنين أو الأربعاء حسب التوقيت المحلي",dataExport:"تنزيل بيانات حسابي",crisisNotice:"يادسنتر ليست خدمة للطوارئ أو الأزمات. إذا كنت أنت أو شخص آخر في خطر فوري، فاتصل بخدمات الطوارئ أو الأزمات المحلية الآن ولا تنتظر رد هذه المنصة.",clientPageTitle:"مساحة المراجع",clientLead:"يمكنك هنا اختيار معالج وإرسال طلب ومتابعة حالة الدفع.",clientRequestTitle:"اختيار المعالج وإرسال الطلب",clientRequestHelp:"اختر من بين المعالجين الذين تم التحقق منهم. يتم الدفع أولاً إلى يادسنتر، وبعد تأكيده يتم تنسيق الجلسة.",chosenTherapist:"المعالج المختار",paymentMarket:"منطقة الدفع",internationalCurrency:"العملة الدولية",clientMessage:"رسالة قصيرة للتنسيق (لا تكتب معلومات حساسة أو تفاصيل سريرية)",submitRequest:"إرسال الطلب",requestHistory:"طلباتي وحالة الدفع",loginNotice:"سجّل الدخول بحساب المراجع لإرسال الطلب."},
    es:{sessionCountry:"País donde estará durante la sesión (código de 2 letras)",adultConfirm:"Confirmo que tengo 18 años o más.",preferredTime:"Horarios preferidos (opcional; la cita se confirma tras coordinarla)",preferredTimePlaceholder:"Por ejemplo, lunes o miércoles por la tarde según su hora local",dataExport:"Descargar los datos de mi cuenta",crisisNotice:"YAD Center no es un servicio de emergencias ni de crisis. Si usted u otra persona está en peligro inmediato, contacte ahora con los servicios locales de emergencia o crisis; no espere una respuesta de esta plataforma.",clientPageTitle:"Área del paciente",clientLead:"Aquí puede elegir terapeuta, enviar una solicitud y consultar el estado del pago.",clientRequestTitle:"Elegir terapeuta y enviar solicitud",clientRequestHelp:"Elija entre terapeutas verificados. El pago se realiza primero a YAD Center; la sesión se coordina tras verificarlo.",chosenTherapist:"Terapeuta elegido",paymentMarket:"Región de pago",internationalCurrency:"Moneda internacional",clientMessage:"Mensaje breve para coordinar (no incluya datos sensibles ni clínicos)",submitRequest:"Enviar solicitud",requestHistory:"Mis solicitudes y estado de pago",loginNotice:"Inicie sesión con su cuenta de paciente para enviar una solicitud."},
    de:{sessionCountry:"Land, in dem Sie sich während der Sitzung befinden (2-Buchstaben-Code)",adultConfirm:"Ich bestätige, dass ich mindestens 18 Jahre alt bin.",preferredTime:"Bevorzugte Zeitfenster (optional; der Termin wird nach Abstimmung bestätigt)",preferredTimePlaceholder:"Zum Beispiel Montag- oder Mittwochabend nach Ihrer Ortszeit",dataExport:"Meine Kontodaten herunterladen",crisisNotice:"YAD Center ist kein Notfall- oder Krisendienst. Wenn Sie oder eine andere Person unmittelbar gefährdet sind, wenden Sie sich sofort an den örtlichen Notruf oder Krisendienst und warten Sie nicht auf eine Antwort dieser Plattform.",clientPageTitle:"Klientenbereich",clientLead:"Hier können Sie eine therapeutische Fachperson auswählen, eine Anfrage senden und den Zahlungsstatus verfolgen.",clientRequestTitle:"Therapeut:in auswählen und Anfrage senden",clientRequestHelp:"Wählen Sie aus geprüften Profilen. Die Zahlung erfolgt zunächst an YAD Center; nach Bestätigung wird der Termin abgestimmt.",chosenTherapist:"Gewünschte Fachperson",paymentMarket:"Zahlungsregion",internationalCurrency:"Internationale Währung",clientMessage:"Kurze Nachricht zur Abstimmung (keine sensiblen oder klinischen Angaben)",submitRequest:"Anfrage senden",requestHistory:"Meine Anfragen und Zahlungsstatus",loginNotice:"Bitte melden Sie sich mit Ihrem Klientenkonto an."},
    fr:{sessionCountry:"Pays où vous vous trouverez pendant la séance (code à 2 lettres)",adultConfirm:"Je confirme avoir 18 ans ou plus.",preferredTime:"Créneaux horaires préférés (facultatif ; le rendez-vous sera confirmé après coordination)",preferredTimePlaceholder:"Par exemple, lundi ou mercredi soir selon votre heure locale",dataExport:"Télécharger les données de mon compte",crisisNotice:"YAD Center n’est pas un service d’urgence ou de crise. Si vous-même ou une autre personne êtes en danger immédiat, contactez sans attendre les services d’urgence ou de crise locaux ; n’attendez pas une réponse de cette plateforme.",clientPageTitle:"Espace patient",clientLead:"Vous pouvez choisir un thérapeute, envoyer une demande et suivre le statut du paiement.",clientRequestTitle:"Choisir un thérapeute et envoyer une demande",clientRequestHelp:"Choisissez parmi les thérapeutes vérifiés. Le paiement est d’abord effectué à YAD Center ; la séance est organisée après vérification.",chosenTherapist:"Thérapeute choisi",paymentMarket:"Région de paiement",internationalCurrency:"Devise internationale",clientMessage:"Bref message de coordination (sans données sensibles ou cliniques)",submitRequest:"Envoyer la demande",requestHistory:"Mes demandes et état des paiements",loginNotice:"Connectez-vous avec votre compte patient pour envoyer une demande."}
  };
  Object.assign(translations, {
    ku:{...translations.en,menu:"مێنی سەرەکی",links:["سەرەکی","خزمەتگوزاری و چارەسەرکاران","ڕێنمایی","بەشی مراجع","بەڕێوەبردن","وۆرکشۆپ","وتارەکان","یاساکانی ماڵپەڕ"],language:"زمان",adminEyebrow:"بەڕێوەبردنی یادسنتر",adminTitle:"بەشی بەڕێوەبردن",adminLead:"بەڕێوەبردنی چارەسەرکاران و مراجعان و داواکاری و پارەدان لەلایەن یادسنترەوە ئەنجام دەدرێت.",opsTitle:"بارودۆخی سیستەم",loading:"پەیوەندییەکی پارێزراو...",appointmentsTitle:"کاتەکان",paymentsTitle:"پارەدانەکان",refresh:"نوێکردنەوە",client:"مراجع",phone:"تەلەفۆن",therapist:"چارەسەرکار",status:"بارودۆخ",amount:"بڕ",reference:"ژمارەی شوێنکەوتن",createdAt:"بەرواری تۆمار",action:"کردار",therapistManagement:"بەڕێوەبردنی چارەسەرکاران",financialRules:"یاساکانی دارایی",noRows:"هیچ تۆمارێک نییە.",approve:"پەسەندکردنی پارەدان",reject:"ڕەتکردنەوە",noAdmin:"ئەم بەشە تەنها بۆ بەڕێوەبەرە.",unknown:"نەزانراو"},
    tr:{...translations.en,menu:"Ana menü",links:["Ana sayfa","Hizmetler ve terapistler","Yardım","Danışan alanı","Yönetim","Atölyeler","Makaleler","Site kuralları"],language:"Dil",adminEyebrow:"YAD Center merkezi yönetim",adminTitle:"YAD Center Yönetim",adminLead:"Terapistler, danışanlar, seans talepleri ve ödemeler merkezi olarak yönetilir.",opsTitle:"Sistem durumu",loading:"Güvenli bağlantı kuruluyor…",appointmentsTitle:"Seanslar",paymentsTitle:"Ödemeler",refresh:"Yenile",client:"Danışan",phone:"Telefon",therapist:"Terapist",status:"Durum",amount:"Tutar",reference:"İşlem numarası",createdAt:"Kayıt tarihi",action:"İşlem",therapistManagement:"Terapist yönetimi",financialRules:"Ödeme süreci",noRows:"Gösterilecek kayıt yok.",approve:"Ödemeyi onayla",reject:"Reddet",noAdmin:"Bu alan yalnızca yöneticilere açıktır.",unknown:"Bilinmiyor"},
    ar:{...translations.en,menu:"القائمة الرئيسية",links:["الرئيسية","الخدمات والمعالجون","دليل المساعدة","مساحة المراجع","الإدارة","ورش العمل","المقالات","السياسات"],language:"اللغة",adminEyebrow:"إدارة يادسنتر المركزية",adminTitle:"لوحة إدارة يادسنتر",adminLead:"تتم إدارة المعالجين والمراجعين والطلبات والمدفوعات مركزياً عبر يادسنتر.",opsTitle:"حالة النظام",loading:"جارٍ الاتصال بشكل آمن…",appointmentsTitle:"الجلسات",paymentsTitle:"المدفوعات",refresh:"تحديث",client:"المراجع",phone:"الهاتف",therapist:"المعالج",status:"الحالة",amount:"المبلغ",reference:"رقم التحويل",createdAt:"تاريخ التسجيل",action:"الإجراء",therapistManagement:"إدارة المعالجين",financialRules:"إجراءات الدفع",noRows:"لا توجد سجلات للعرض.",approve:"تأكيد الدفع",reject:"رفض",noAdmin:"هذا القسم متاح للمدير فقط.",unknown:"غير معروف"},
    es:{...translations.en,menu:"Menú principal",links:["Inicio","Servicios y terapeutas","Guía de ayuda","Área del paciente","Administración","Talleres","Artículos","Políticas"],language:"Idioma",adminEyebrow:"Administración central de YAD Center",adminTitle:"Administración de YAD Center",adminLead:"YAD Center gestiona de forma centralizada a terapeutas, pacientes, solicitudes y pagos.",opsTitle:"Estado del sistema",loading:"Conectando de forma segura…",appointmentsTitle:"Sesiones",paymentsTitle:"Pagos",refresh:"Actualizar",client:"Paciente",phone:"Teléfono",therapist:"Terapeuta",status:"Estado",amount:"Importe",reference:"Referencia de pago",createdAt:"Fecha de registro",action:"Acción",therapistManagement:"Gestión de terapeutas",financialRules:"Proceso de pago",noRows:"No hay registros para mostrar.",approve:"Aprobar pago",reject:"Rechazar",noAdmin:"Esta sección es solo para administradores.",unknown:"Desconocido"},
    de:{...translations.en,menu:"Hauptmenü",links:["Startseite","Angebote und Therapeut:innen","Hilfe","Klientenbereich","Verwaltung","Workshops","Artikel","Richtlinien"],language:"Sprache",adminEyebrow:"Zentrale YAD-Center-Verwaltung",adminTitle:"YAD Center Verwaltung",adminLead:"Therapeut:innen, Klient:innen, Anfragen und Zahlungen werden zentral verwaltet.",opsTitle:"Systemstatus",loading:"Sichere Verbindung wird hergestellt…",appointmentsTitle:"Sitzungen",paymentsTitle:"Zahlungen",refresh:"Aktualisieren",client:"Klient:in",phone:"Telefon",therapist:"Therapeut:in",status:"Status",amount:"Betrag",reference:"Zahlungsreferenz",createdAt:"Erfasst am",action:"Aktion",therapistManagement:"Therapeut:innen verwalten",financialRules:"Zahlungsablauf",noRows:"Keine Einträge vorhanden.",approve:"Zahlung bestätigen",reject:"Ablehnen",noAdmin:"Dieser Bereich ist nur für die Verwaltung zugänglich.",unknown:"Unbekannt"},
    fr:{...translations.en,menu:"Menu principal",links:["Accueil","Services et thérapeutes","Guide d’aide","Espace patient","Administration","Ateliers","Articles","Règles du site"],language:"Langue",adminEyebrow:"Administration centrale de YAD Center",adminTitle:"Administration YAD Center",adminLead:"Les thérapeutes, patients, demandes et paiements sont gérés de manière centralisée.",opsTitle:"État du système",loading:"Connexion sécurisée…",appointmentsTitle:"Séances",paymentsTitle:"Paiements",refresh:"Actualiser",client:"Patient",phone:"Téléphone",therapist:"Thérapeute",status:"Statut",amount:"Montant",reference:"Référence de paiement",createdAt:"Date d’enregistrement",action:"Action",therapistManagement:"Gestion des thérapeutes",financialRules:"Processus de paiement",noRows:"Aucun élément à afficher.",approve:"Confirmer le paiement",reject:"Refuser",noAdmin:"Cette section est réservée à l’administration.",unknown:"Inconnu"}
  });
  Object.entries(clientLabels).forEach(([lang,labels])=>Object.assign(translations[lang],labels));
  const pageText = (lang) => {
    const t=translations[lang]||translations.fa;
    document.documentElement.lang=lang;
    document.documentElement.dir=["fa","ku","ar"].includes(lang)?"rtl":"ltr";
    document.querySelectorAll("[data-i18n]").forEach(el=>{
      const key=el.getAttribute("data-i18n");
      if(t[key]) el.textContent=t[key];
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el=>{const key=el.getAttribute("data-i18n-placeholder");if(t[key])el.setAttribute("placeholder",t[key]);});
    const side=document.querySelector(".side-nav");
    if(side){
      const menu=side.querySelector("small");if(menu&&t.menu)menu.textContent=t.menu;
      const anchors=side.querySelectorAll("a:not(.side-brand)");
      (t.links||[]).forEach((label,index)=>{const a=anchors[index];if(!a)return;const icon=a.querySelector("i");a.replaceChildren();if(icon)a.append(icon);a.append(document.createTextNode(label));});
    }
  };
  document.addEventListener("yad:languagechange",event=>pageText(event.detail?.language||"fa"));
  try { const saved=localStorage.getItem("yad-language"); if(saved && translations[saved]) pageText(saved); } catch (_) {}
  const adminPage=document.getElementById("yadAppointmentsBody");
  if(!adminPage) return;
  const start=async()=>{
    const status=document.getElementById("yadAdminStatus");
    const t=()=>translations[document.documentElement.lang]||translations.fa;
    const setStatus=(msg,bad=false)=>{status.textContent=msg;status.classList.toggle("admin-error",bad);};
    const config=window.YAD_SUPABASE_CONFIG||{};
    if(!window.supabase?.createClient||!config.url||!config.anonKey){setStatus(t().genericError,true);return;}
    const db=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    setStatus(t().connecting);
    const {data:sessionData,error:sessionError}=await db.auth.getSession();
    if(sessionError){setStatus(t().noAdmin,true);return;}
    if(!sessionData.session){
      setStatus(t().noAdmin,true);
      db.auth.onAuthStateChange((_event,session)=>{if(session?.user)setTimeout(()=>start(),0);});
      return;
    }
    const {data:profile,error:profileError}=await db.from("profiles").select("role").eq("id",sessionData.session.user.id).maybeSingle();
    if(profileError||profile?.role!=="admin"){setStatus(t().noAdmin,true);return;}
    const formatDate=(value)=>value?new Intl.DateTimeFormat(document.documentElement.lang==="fa"?"fa-IR":"en-GB",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value)):t().unknown;
    const formatAmount=(amount,currency)=>new Intl.NumberFormat(document.documentElement.lang==="fa"?"fa-IR":"en-GB").format(Number(amount||0))+" "+(currency||"");
    const makeCell=(row,value)=>{const td=document.createElement("td");td.textContent=value??"—";row.append(td);return td;};
    async function loadAppointments(){
      const body=document.getElementById("yadAppointmentsBody");body.replaceChildren();
      const {data,error}=await db.rpc("admin_list_appointments",{p_limit:50,p_offset:0});
      if(error){const tr=document.createElement("tr");makeCell(tr,t().refreshError);body.append(tr);setStatus(t().refreshError,true);return;}
      document.getElementById("yadAppointmentCount").textContent=String(data?.length||0);
      if(!data?.length){const tr=document.createElement("tr");const td=makeCell(tr,t().noRows);td.colSpan=6;body.append(tr);return;}
      data.forEach(item=>{
        const tr=document.createElement("tr");
        makeCell(tr,item.client_name);makeCell(tr,item.client_phone);
        makeCell(tr,item.therapist_name);makeCell(tr,formatDate(item.starts_at));
        makeCell(tr,t()[item.market]||item.market);makeCell(tr,t()[item.appointment_status]||item.appointment_status);
        body.append(tr);
      });
    }
    async function loadPayments(){
      const body=document.getElementById("yadPaymentsBody");body.replaceChildren();
      const {data,error}=await db.rpc("admin_list_payments",{p_limit:50,p_offset:0});
      if(error){const tr=document.createElement("tr");const td=makeCell(tr,t().refreshError);td.colSpan=6;body.append(tr);setStatus(t().refreshError,true);return;}
      document.getElementById("yadPaymentCount").textContent=String(data?.length||0);
      if(!data?.length){const tr=document.createElement("tr");const td=makeCell(tr,t().noRows);td.colSpan=6;body.append(tr);return;}
      data.forEach(item=>{
        const tr=document.createElement("tr");
        makeCell(tr,item.client_name);makeCell(tr,formatAmount(item.amount,item.currency));
        makeCell(tr,item.provider_reference);makeCell(tr,formatDate(item.created_at));
        makeCell(tr,t()[item.payment_status]||item.payment_status);
        const td=document.createElement("td");
        if(item.appointment_id && item.payment_status==="pending"&&item.provider_reference){
          const actions=document.createElement("div");actions.className="admin-actions";
          [[true,t().approve],[false,t().reject]].forEach(([approve,label])=>{
            const button=document.createElement("button");button.type="button";button.className="button "+(approve?"primary":"outline");button.textContent=label;
            button.addEventListener("click",async()=>{
              if(!window.confirm(t().reviewConfirm))return;
              button.disabled=true;button.textContent=t().reviewing;
              const {error:reviewError}=await db.rpc("admin_review_manual_payment",{p_payment_id:item.payment_id,p_approve:approve});
              if(reviewError){button.disabled=false;button.textContent=label;setStatus(t().genericError,true);return;}
              setStatus(approve?t().approved:t().rejected);
              await Promise.all([loadPayments(),loadAppointments()]);
            });
            actions.append(button);
          });
          td.append(actions);
        }else{td.textContent="—";}
        tr.append(td);body.append(tr);
      });
    }
    document.getElementById("yadRefreshAppointments")?.addEventListener("click",loadAppointments);
    document.getElementById("yadRefreshPayments")?.addEventListener("click",loadPayments);
    await Promise.all([loadAppointments(),loadPayments()]);
    setStatus(t().connecting);
  };
  window.addEventListener("load",start,{once:true});if(document.readyState==="complete")start();


})();
