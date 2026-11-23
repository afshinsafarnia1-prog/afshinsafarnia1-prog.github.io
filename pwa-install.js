(()=>{"use strict";
const button=document.getElementById("pwaInstallButton");
const dialog=document.getElementById("pwaInstallHelp");
if(!button)return;
let deferredPrompt=null;
const ua=navigator.userAgent||"";
const isIOS=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
const isAndroid=/Android/i.test(ua);
const isStandalone=window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
if(isStandalone){button.hidden=true;return;}
button.hidden=false;
function showHelp(){
 const ios=document.getElementById("pwaInstallIOS");
 const android=document.getElementById("pwaInstallAndroid");
 const other=document.getElementById("pwaInstallOther");
 if(ios)ios.hidden=!isIOS;
 if(android)android.hidden=!isAndroid||isIOS;
 if(other)other.hidden=isIOS||isAndroid;
 if(dialog?.showModal)dialog.showModal();
 else window.alert(isIOS
  ?"در Safari گزینهٔ Share و سپس Add to Home Screen را انتخاب کنید."
  :"از منوی مرورگر گزینهٔ Install app یا Add to Home screen را انتخاب کنید.");
}
window.addEventListener("beforeinstallprompt",event=>{
 event.preventDefault();
 deferredPrompt=event;
});
button.addEventListener("click",async()=>{
 if(!deferredPrompt){showHelp();return;}
 const promptEvent=deferredPrompt;
 deferredPrompt=null;
 button.disabled=true;
 try{
  await promptEvent.prompt();
  const choice=await promptEvent.userChoice;
  if(choice?.outcome==="accepted")button.hidden=true;
 }catch(_){showHelp();}
 finally{button.disabled=false;}
});
window.addEventListener("appinstalled",()=>{deferredPrompt=null;button.hidden=true;});
document.getElementById("pwaInstallClose")?.addEventListener("click",()=>dialog?.close());
dialog?.addEventListener("click",event=>{if(event.target===dialog)dialog.close();});
})();