import { supabase } from "./supabaseClient.js";
import { escapeHtml } from "./members.js";
import { openSheet, closeSheet } from "./sheet.js";

const SLOTS = ["breakfast", "lunch", "dinner"];
let mealsByDate = {};

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

function next7Days() {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

async function loadMeals() {
  const days = next7Days();
  const start = dateKey(days[0]);
  const end = dateKey(days[days.length - 1]);
  const { data, error } = await supabase
    .from("meals")
    .select("*")
    .gte("date", start)
    .lte("date", end);
  mealsByDate = {};
  if (error) {
    console.error(error);
    return;
  }
  for (const m of data || []) {
    mealsByDate[`${m.date}_${m.slot}`] = m;
  }
}

function dayCardHtml(d) {
  const key = dateKey(d);
  const label = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const rows = SLOTS.map((slot) => {
    const meal = mealsByDate[`${key}_${slot}`];
    return `
      <div class="row between" data-date="${key}" data-slot="${slot}" style="padding:8px 0;border-bottom:1px solid var(--border);">
        <div>
          <div class="muted" style="font-size:12px;text-transform:capitalize;">${slot}</div>
          <div style="font-weight:600;">${meal ? escapeHtml(meal.title) : "Tap to plan"}</div>
        </div>
        <span class="muted">${meal ? "✎" : "+"}</span>
      </div>
    `;
  }).join("");

  return `
    <div class="card">
      <div class="display" style="font-size:15px;margin-bottom:4px;">${label}</div>
      ${rows}
    </div>
  `;
}

export async function renderMeals() {
  await loadMeals();
  const list = document.getElementById("meals-list");
  list.innerHTML = next7Days().map(dayCardHtml).join("");

  list.querySelectorAll("[data-date]").forEach((row) => {
    row.addEventListener("click", () => openMealSheet(row.dataset.date, row.dataset.slot));
  });
}

function openMealSheet(date, slot) {
  const existing = mealsByDate[`${date}_${slot}`];
  openSheet(
    `${slot[0].toUpperCase() + slot.slice(1)} — ${date}`,
    `
      <label>What's the plan?</label>
      <input id="meal-title" placeholder="e.g. Spaghetti bolognese" value="${existing ? escapeHtml(existing.title) : ""}" />
      <label>Notes (optional)</label>
      <textarea id="meal-notes" rows="2" placeholder="Recipe link, reminders...">${existing ? escapeHtml(existing.notes || "") : ""}</textarea>
      <button class="btn btn-primary btn-block" id="meal-save">Save</button>
      ${existing ? `<button class="btn btn-danger btn-block" id="meal-clear">Clear this meal</button>` : ""}
    `,
    (body) => {
      body.querySelector("#meal-save").addEventListener("click", async () => {
        const title = body.querySelector("#meal-title").value.trim();
        const notes = body.querySelector("#meal-notes").value.trim();
        if (!title) return;
        await supabase.from("meals").upsert(
          { date, slot, title, notes },
          { onConflict: "date,slot" }
        );
        closeSheet();
        await renderMeals();
      });
      const clearBtn = body.querySelector("#meal-clear");
      if (clearBtn) {
        clearBtn.addEventListener("click", async () => {
          await supabase.from("meals").delete().eq("date", date).eq("slot", slot);
          closeSheet();
          await renderMeals();
        });
      }
    }
  );
}
