import { supabase } from "./supabaseClient.js";
import { memberOptionsHtml, memberDotHtml, memberById, escapeHtml } from "./members.js";
import { openSheet, closeSheet } from "./sheet.js";

let cursor = new Date();
cursor.setDate(1);
let events = [];

function monthLabel(d) {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function monthBounds(d) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end };
}

async function loadEvents() {
  const { start, end } = monthBounds(cursor);
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .gte("starts_at", start.toISOString())
    .lt("starts_at", end.toISOString())
    .order("starts_at");
  if (error) {
    console.error(error);
    events = [];
    return;
  }
  events = data || [];
}

function eventRowHtml(ev) {
  const date = new Date(ev.starts_at);
  const dateStr = date.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
  const timeStr = ev.all_day
    ? "All day"
    : date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `
    <div class="card row between" data-event-id="${ev.id}">
      <div class="row" style="gap:12px;">
        <div style="min-width:64px;">
          <div style="font-weight:700;">${dateStr}</div>
          <div class="muted" style="font-size:12px;">${timeStr}</div>
        </div>
        <div>
          <div style="font-weight:600;">${escapeHtml(ev.title)}</div>
          ${ev.member_id ? `<div class="row" style="gap:6px;margin-top:4px;">${memberDotHtml(ev.member_id)}<span class="muted" style="font-size:12px;">${memberById(ev.member_id)?.name}</span></div>` : ""}
        </div>
      </div>
      <button class="icon-btn" data-action="delete" title="Remove">🗑️</button>
    </div>
  `;
}

export async function renderCalendar() {
  document.getElementById("cal-month-label").textContent = monthLabel(cursor);
  await loadEvents();
  const list = document.getElementById("cal-events-list");
  const empty = document.getElementById("cal-empty");

  if (events.length === 0) {
    list.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  list.innerHTML = events.map(eventRowHtml).join("");
  list.querySelectorAll("[data-action='delete']").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.closest("[data-event-id]").dataset.eventId;
      if (!confirm("Remove this event?")) return;
      await supabase.from("events").delete().eq("id", id);
      await renderCalendar();
    });
  });
}

export function shiftMonth(delta) {
  cursor.setMonth(cursor.getMonth() + delta);
  renderCalendar();
}

export async function syncGoogleCalendar() {
  const btn = document.getElementById("cal-sync-btn");
  const originalText = btn.textContent;
  btn.textContent = "Syncing…";
  btn.disabled = true;
  try {
    const res = await fetch("/api/google-calendar-sync", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Sync failed. Is Google Calendar connected in Settings?");
    } else {
      await renderCalendar();
    }
  } catch (err) {
    alert("Couldn't reach the sync service. Please try again.");
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

export function openAddEventSheet() {
  openSheet(
    "New event",
    `
      <label>What's happening?</label>
      <input id="ev-title" placeholder="e.g. Katinka's soccer practice" />
      <label>Date</label>
      <input id="ev-date" type="date" />
      <label>Time (leave blank for all-day)</label>
      <input id="ev-time" type="time" />
      <label>Who's it for?</label>
      <select id="ev-member">${memberOptionsHtml()}</select>
      <button class="btn btn-primary btn-block" id="ev-save">Add event</button>
    `,
    (body) => {
      const dateInput = body.querySelector("#ev-date");
      const today = new Date();
      dateInput.value = today.toISOString().slice(0, 10);

      body.querySelector("#ev-save").addEventListener("click", async () => {
        const title = body.querySelector("#ev-title").value.trim();
        const date = body.querySelector("#ev-date").value;
        const time = body.querySelector("#ev-time").value;
        if (!title || !date) return;
        const member_id = body.querySelector("#ev-member").value || null;
        const all_day = !time;
        const starts_at = new Date(`${date}T${time || "00:00"}`).toISOString();
        await supabase.from("events").insert({ title, starts_at, all_day, member_id, source: "local" });
        closeSheet();
        await renderCalendar();
      });
    }
  );
}
