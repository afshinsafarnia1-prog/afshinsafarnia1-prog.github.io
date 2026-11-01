const menu=document.getElementById("menuToggle");const nav=document.getElementById("mainNav");menu?.addEventListener("click",()=>{const open=nav.classList.toggle("open");menu.setAttribute("aria-expanded",String(open));});nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>nav.classList.remove("open")));document.getElementById("searchForm")?.addEventListener("submit",e=>{e.preventDefault();const n=document.getElementById("directoryNotice");n.textContent="فهرست متخصصان پس از تکمیل بررسی مدارک و مجوزهای حرفه‌ای منتشر می‌شود. در حال حاضر هیچ درمانگر یا امتیاز تأییدنشده‌ای نمایش داده نمی‌شود.";n.scrollIntoView({behavior:"smooth",block:"center"});});
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));}

const marketSelect=document.getElementById("marketSelect");
if(marketSelect){
  marketSelect.addEventListener("change",()=>{
    const international=marketSelect.value==="international";
    const notice=document.getElementById("directoryNotice");
    if(notice){
      notice.textContent=international
        ? "مسیر بین‌المللی یادسنتر انتخاب شد. زبان‌ها، منطقه زمانی و هزینه‌ها باید بر اساس کشور محل اقامت نمایش داده شوند؛ پرداخت بین‌المللی پس از انتخاب و اتصال ارائه‌دهنده مجاز فعال خواهد شد."
        : "مسیر ایران انتخاب شد. هزینه‌ها به ریال نمایش داده می‌شوند و پرداخت داخلی پس از اتصال درگاه مجاز فعال خواهد شد.";
    }
    document.documentElement.dataset.market=marketSelect.value;
  });
}
