(() => {
  const input = document.getElementById("yadPhoto");
  const preview = document.getElementById("yadPhotoPreview");
  if (!input || !preview) return;
  let activeUrl = "";
  input.addEventListener("change", () => {
    if (activeUrl) URL.revokeObjectURL(activeUrl);
    activeUrl = "";
    preview.replaceChildren();
    const file = input.files && input.files[0];
    if (!file) {
      const note = document.createElement("span");
      note.textContent = "برای تغییر عکس، یک تصویر تازه انتخاب کن؛ در غیر این صورت عکس قبلی حفظ می‌شود.";
      preview.append(note);
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      input.value = "";
      const note = document.createElement("span");
      note.textContent = "لطفاً عکس با فرمت JPG، PNG یا WebP انتخاب کن.";
      preview.append(note);
      return;
    }
    activeUrl = URL.createObjectURL(file);
    const image = document.createElement("img");
    image.src = activeUrl;
    image.alt = "پیش‌نمایش عکس درمانگر";
    const note = document.createElement("span");
    note.textContent = "این عکس پس از زدن دکمهٔ «ذخیرهٔ پروفایل» ثبت می‌شود.";
    preview.append(image, note);
  });
  window.addEventListener("beforeunload", () => {
    if (activeUrl) URL.revokeObjectURL(activeUrl);
  });
})();