const data=[
{name:"نمونه درمانگر ۱",kind:"روان‌درمانگر",lang:"فارسی",field:"روان‌درمانی روان‌پویشی"},
{name:"نمونه درمانگر ۲",kind:"روان‌شناس",lang:"کوردی",field:"درمان فردی و ذهن‌آگاهی"},
{name:"نمونه متخصص ۳",kind:"روان‌پزشک",lang:"فارسی",field:"روان‌پزشکی"}];
function draw(items=data){document.getElementById("cards").innerHTML=items.map(x=>`<article class="card"><h3>${x.name}</h3><p>${x.kind}</p><p>🗣 ${x.lang}</p><p>${x.field}</p><p class="verified">✓ پروفایل پس از بررسی مدارک فعال می‌شود</p></article>`).join("")}
function filter(){const l=document.getElementById("language").value,s=document.getElementById("specialty").value;draw(data.filter(x=>(!l||x.lang===l)&&(!s||x.kind===s)))}draw();