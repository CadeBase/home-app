import { supabase } from "./supabaseClient.js";
import { members, escapeHtml } from "./members.js";
import { openSheet, closeSheet } from "./sheet.js";

async function loadTotals() {
  const { data } = await supabase.from("reward_events").select("*");
  const totals = {};
  const recent = {};
  for (const m of members) {
    totals[m.id] = 0;
    recent[m.id] = [];
  }
  for (const ev of data || []) {
    if (!(ev.member_id in totals)) continue;
    totals[ev.member_id] += ev.points;
    recent[ev.member_id].push(ev);
  }
  for (const id in recent) {
    recent[id].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    recent[id] = recent[id].slice(0, 5);
  }
  return { totals, recent };
}

function memberCardHtml(m, points, recentEvents) {
  return `
    <div class="card" data-member-id="${m.id}">
      <div class="row between">
        <div class="row" style="gap:10px;">
          <span class="member-dot" style="width:16px;height:16px;background:${m.color}"></span>
          <span style="font-weight:700;font-size:16px;">${escapeHtml(m.name)}</span>
        </div>
        <span class="points-badge" style="font-size:16px;">${points} pts</span>
      </div>
      ${recentEvents.length > 0 ? `
        <div class="spacer"></div>
        ${recentEvents.map((ev) => `
          <div class="row between muted" style="font-size:12px;padding:3px 0;">
            <span>${escapeHtml(ev.reason)}</span>
            <span>${ev.points > 0 ? "+" : ""}${ev.points}</span>
          </div>
        `).join("")}
      ` : ""}
      <div class="spacer"></div>
      <button class="btn btn-secondary btn-block" data-action="redeem" style="font-size:13px;">🎁 Redeem points</button>
    </div>
  `;
}

export async function renderRewards() {
  const list = document.getElementById("rewards-list");
  if (members.length === 0) {
    list.innerHTML = `<div class="empty-state"><span class="big-emoji">⭐</span>Add family members in Settings to start tracking rewards.</div>`;
    return;
  }
  const { totals, recent } = await loadTotals();
  list.innerHTML = members.map((m) => memberCardHtml(m, totals[m.id] || 0, recent[m.id] || [])).join("");

  list.querySelectorAll("[data-action='redeem']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.closest("[data-member-id]").dataset.memberId;
      openRedeemSheet(id);
    });
  });
}

function openRedeemSheet(memberId) {
  const member = members.find((m) => m.id === memberId);
  openSheet(
    `Redeem points — ${member.name}`,
    `
      <label>What are they redeeming?</label>
      <input id="redeem-reason" placeholder="e.g. Movie night pick" />
      <label>Points to spend</label>
      <input id="redeem-points" type="number" min="1" value="10" />
      <button class="btn btn-primary btn-block" id="redeem-save">Redeem</button>
    `,
    (body) => {
      body.querySelector("#redeem-save").addEventListener("click", async () => {
        const reason = body.querySelector("#redeem-reason").value.trim() || "Redeemed reward";
        const points = Number(body.querySelector("#redeem-points").value) || 0;
        if (points <= 0) return;
        await supabase.from("reward_events").insert({ member_id: memberId, points: -points, reason });
        closeSheet();
        await renderRewards();
      });
    }
  );
}
