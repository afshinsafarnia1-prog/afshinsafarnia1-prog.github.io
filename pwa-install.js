(()=>{"use strict";
const button=document.getElementById("pwaInstallButton");
const dialog=document.getElementById("pwaInstallHelp");
if(!button)return;
let deferredPrompt=null;
const ua=navigator.userAgent||"";
const isIOS=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
const isStandalone=window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
if(isStandalone){button.hidden=true;return;}
function showHelp(){if(dialog?.showModal)dialog.showModal();else window.alert("برای نصب یادسنتر، از منوی مرورگر گزینهٔ Add to Home Screen یا افزودن به صفحهٔ اصلی را انتخاب کنید.");}
if(isIOS){button.hidden=false;button.addEventListener("click",showHelp);return;}
window.addEventListener("beforeinstallprompt",event=>{
 event.preventDefault();deferredPrompt=event;button.hidden=false;
});
button.addEventListener("click",async()=>{
 if(!deferredPrompt){showHelp();return;}
 const promptEvent=deferredPrompt;deferredPrompt=null;button.disabled=true;
 try{await promptEvent.prompt();await promptEvent.userChoice;}catch(_){}
 button.disabled=false;button.hidden=true;
});
window.addEventListener("appinstalled",()=>{deferredPrompt=null;button.hidden=true;});
document.getElementById("pwaInstallClose")?.addEventListener("click",()=>dialog?.close());
dialog?.addEventListener("click",event=>{if(event.target===dialog)dialog.close();});
})();