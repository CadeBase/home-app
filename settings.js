import { members, loadMembers, addMember, removeMember, escapeHtml } from "./members.js";
import { openSheet, closeSheet } from "./sheet.js";

function membersListHtml() {
  if (members.length === 0) return `<p class="muted">No family members added yet.</p>`;
  return members
    .map(
      (m) => `
      <div class="row between" style="padding:8px 0;border-bottom:1px solid var(--border);">
        <div class="row" style="gap:10px;">
          <span class="member-dot" style="background:${m.color}"></span>
          <span>${escapeHtml(m.name)}${m.is_kid ? " (kid)" : ""}</span>
        </div>
        <button class="icon-btn" data-remove="${m.id}">🗑️</button>
      </div>
    `
    )
    .join("");
}

export function openSettingsSheet(onChanged) {
  openSheet(
    "Settings",
    `
      <div class="section-title" style="margin-top:0;">Family members</div>
      <div id="settings-members-list">${membersListHtml()}</div>
      <div class="spacer"></div>
      <input id="new-member-name" placeholder="Add a family member's name" />
      <label style="display:flex;align-items:center;gap:8px;font-weight:400;">
        <input type="checkbox" id="new-member-kid" style="width:auto;margin:0;" /> This is a child
      </label>
      <button class="btn btn-secondary btn-block" id="add-member-btn">Add member</button>

      <div class="section-title">Calendar sync</div>
      <p class="muted" style="font-size:13px;">Google Calendar isn't connected yet. When you're ready, ask to set it up and I'll walk you through it — it'll ask your permission before connecting anything.</p>

      <div class="section-title">Household passcode</div>
      <p class="muted" style="font-size:13px;">Change the passcode by editing js/config.js in your project files.</p>
    `,
    (body) => {
      body.querySelector("#add-member-btn").addEventListener("click", async () => {
        const name = body.querySelector("#new-member-name").value.trim();
        if (!name) return;
        const isKid = body.querySelector("#new-member-kid").checked;
        await addMember(name, isKid);
        body.querySelector("#settings-members-list").innerHTML = membersListHtml();
        body.querySelector("#new-member-name").value = "";
        attachRemoveHandlers(body, onChanged);
        if (onChanged) onChanged();
      });
      attachRemoveHandlers(body, onChanged);
    }
  );
}

function attachRemoveHandlers(body, onChanged) {
  body.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remove this family member? Their chore/reward history will stay, but they won't be assignable anymore.")) return;
      await removeMember(btn.dataset.remove);
      body.querySelector("#settings-members-list").innerHTML = membersListHtml();
      attachRemoveHandlers(body, onChanged);
      if (onChanged) onChanged();
    });
  });
}
