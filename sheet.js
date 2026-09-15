const backdrop = document.getElementById("sheet-backdrop");
const sheetTitle = document.getElementById("sheet-title");
const sheetBody = document.getElementById("sheet-body");
const closeBtn = document.getElementById("sheet-close");

export function openSheet(title, bodyHtml, onMount) {
  sheetTitle.textContent = title;
  sheetBody.innerHTML = bodyHtml;
  backdrop.classList.add("open");
  if (onMount) onMount(sheetBody);
}

export function closeSheet() {
  backdrop.classList.remove("open");
  sheetBody.innerHTML = "";
}

closeBtn.addEventListener("click", closeSheet);
backdrop.addEventListener("click", (e) => {
  if (e.target === backdrop) closeSheet();
});
