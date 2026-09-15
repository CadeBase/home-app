import { supabase } from "./supabaseClient.js";

export let members = [];

const PALETTE = ["#FF8552", "#4C9F70", "#5B8DEF", "#F4C95D", "#B36BD4", "#E5726E"];

export async function loadMembers() {
  const { data, error } = await supabase.from("members").select("*").order("created_at");
  if (error) {
    console.error("Failed to load members", error);
    return [];
  }
  members = data || [];
  return members;
}

export function memberById(id) {
  return members.find((m) => m.id === id);
}

export function nextColor() {
  const used = members.map((m) => m.color);
  return PALETTE.find((c) => !used.includes(c)) || PALETTE[members.length % PALETTE.length];
}

export async function addMember(name, isKid) {
  const { error } = await supabase
    .from("members")
    .insert({ name, is_kid: isKid, color: nextColor() });
  if (error) throw error;
  await loadMembers();
}

export async function removeMember(id) {
  const { error } = await supabase.from("members").delete().eq("id", id);
  if (error) throw error;
  await loadMembers();
}

export function memberOptionsHtml(selectedId) {
  let html = `<option value="">Unassigned</option>`;
  for (const m of members) {
    html += `<option value="${m.id}" ${m.id === selectedId ? "selected" : ""}>${escapeHtml(m.name)}</option>`;
  }
  return html;
}

export function memberDotHtml(memberId) {
  const m = memberById(memberId);
  if (!m) return "";
  return `<span class="member-dot" style="background:${m.color}" title="${escapeHtml(m.name)}"></span>`;
}

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
