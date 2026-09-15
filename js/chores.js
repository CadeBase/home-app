import { supabase } from "./supabaseClient.js";
import { members, memberOptionsHtml, memberDotHtml, memberById, escapeHtml } from "./members.js";
import { openSheet, closeSheet } from "./sheet.js";

let chores = [];
let completions = [];

function startOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isSameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

function isDoneNow(chore) {
  const relevant = completions.filter((c) => c.chore_id === chore.id);
  if (relevant.length === 0) return false;
  if (chore.repeat === "once") return true;
  if (chore.repeat === "daily") {
    const today = new Date();
    return relevant.some((c) => isSameDay(new Date(c.completed_at), today));
  }
  if (chore.repeat === "weekly") {
    const weekStart = startOfWeek();
    return relevant.some((c) => new Date(c.completed_at) >= weekStart);
  }
  return false;
}

async function loadData() {
  const [choresRes, compRes] = await Promise.all([
    supabase.from("chores").select("*").eq("active", true).order("created_at"),
    supabase.from("chore_completions").select("*").order("completed_at", { ascending: false }).limit(500),
  ]);
  chores = choresRes.data || [];
  completions = compRes.data || [];
}

function choreRowHtml(chore) {
  const done = isDoneNow(chore);
  return `
    <div class="card row between" data-chore-id="${chore.id}">
      <div class="row" style="gap:12px;">
        <button class="check-circle ${done ? "done" : ""}" data-action="toggle">${done ? "✓" : ""}</button>
        <div>
          <div class="chore-title ${done ? "done" : ""}">${escapeHtml(chore.title)}</div>
          <div class="row" style="gap:6px;margin-top:4px;">
            ${memberDotHtml(chore.assigned_to)}
            <span class="muted" style="font-size:12px;">${memberById(chore.assigned_to)?.name || "Anyone"} · ${chore.repeat}</span>
            <span class="points-badge">${chore.points} pts</span>
          </div>
        </div>
      </div>
      <button class="icon-btn" data-action="delete" title="Remove">🗑️</button>
    </div>
  `;
}

export async function renderChores() {
  await loadData();
  const allList = document.getElementById("chores-all-list");
  const emptyState = document.getElementById("chores-empty");

  if (chores.length === 0) {
    allList.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");
  allList.innerHTML = chores.map(choreRowHtml).join("");

  allList.querySelectorAll("[data-action='toggle']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.closest("[data-chore-id]").dataset.choreId;
      toggleChore(id);
    });
  });
  allList.querySelectorAll("[data-action='delete']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.closest("[data-chore-id]").dataset.choreId;
      deleteChore(id);
    });
  });
}

async function toggleChore(id) {
  const chore = chores.find((c) => c.id === id);
  if (!chore) return;
  const done = isDoneNow(chore);

  if (!done) {
    await supabase.from("chore_completions").insert({ chore_id: id, completed_by: chore.assigned_to });
    if (chore.assigned_to) {
      await supabase.from("reward_events").insert({
        member_id: chore.assigned_to,
        points: chore.points,
        reason: `Completed "${chore.title}"`,
      });
    }
  } else {
    const relevant = completions
      .filter((c) => c.chore_id === id)
      .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
    if (relevant[0]) {
      await supabase.from("chore_completions").delete().eq("id", relevant[0].id);
    }
    if (chore.assigned_to) {
      const { data: rewardRows } = await supabase
        .from("reward_events")
        .select("*")
        .eq("member_id", chore.assigned_to)
        .eq("reason", `Completed "${chore.title}"`)
        .order("created_at", { ascending: false })
        .limit(1);
      if (rewardRows && rewardRows[0]) {
        await supabase.from("reward_events").delete().eq("id", rewardRows[0].id);
      }
    }
  }
  await renderChores();
}

async function deleteChore(id) {
  if (!confirm("Remove this chore?")) return;
  await supabase.from("chores").update({ active: false }).eq("id", id);
  await renderChores();
}

export function openAddChoreSheet() {
  openSheet(
    "New chore",
    `
      <label>What needs doing?</label>
      <input id="chore-title" placeholder="e.g. Feed the dog" />
      <label>Assign to</label>
      <select id="chore-assignee">${memberOptionsHtml()}</select>
      <label>How often?</label>
      <select id="chore-repeat">
        <option value="once">Just once</option>
        <option value="daily" selected>Every day</option>
        <option value="weekly">Every week</option>
      </select>
      <label>Points</label>
      <input id="chore-points" type="number" min="1" value="5" />
      <button class="btn btn-primary btn-block" id="chore-save">Add chore</button>
    `,
    (body) => {
      body.querySelector("#chore-save").addEventListener("click", async () => {
        const title = body.querySelector("#chore-title").value.trim();
        if (!title) return;
        const assigned_to = body.querySelector("#chore-assignee").value || null;
        const repeat = body.querySelector("#chore-repeat").value;
        const points = parseInt(body.querySelector("#chore-points").value, 10) || 5;
        await supabase.from("chores").insert({ title, assigned_to, repeat, points });
        closeSheet();
        await renderChores();
      });
    }
  );
}
