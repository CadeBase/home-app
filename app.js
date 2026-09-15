import { HOUSEHOLD_PASSCODE } from "./config.js";
import { initTheme, toggleTheme } from "./theme.js";
import { loadMembers } from "./members.js";
import { renderChores, openAddChoreSheet } from "./chores.js";
import { renderCalendar, shiftMonth, openAddEventSheet } from "./calendar.js";
import { renderMeals } from "./meals.js";
import { renderInventory, setMode as setInventoryMode, openAddSheetForMode, mode as inventoryMode } from "./inventory.js";
import { renderRewards } from "./rewards.js";
import { openSettingsSheet } from "./settings.js";

const GATE_KEY = "home-app-unlocked";
let currentView = "chores";

initTheme();

// ---- Passcode gate ----
const gate = document.getElementById("gate");
const app = document.getElementById("app");
const gateInput = document.getElementById("gate-input");
const gateError = document.getElementById("gate-error");

function unlock() {
  gate.classList.add("hidden");
  app.classList.remove("hidden");
  sessionStorage.setItem(GATE_KEY, "1");
  boot();
}

if (sessionStorage.getItem(GATE_KEY) === "1") {
  unlock();
}

document.getElementById("gate-submit").addEventListener("click", tryUnlock);
gateInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") tryUnlock();
});

function tryUnlock() {
  if (gateInput.value === HOUSEHOLD_PASSCODE) {
    gateError.classList.add("hidden");
    unlock();
  } else {
    gateError.classList.remove("hidden");
  }
}

// ---- Tabs ----
function switchView(view) {
  currentView = view;
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.getElementById(`view-${view}`).classList.add("active");
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === view));

  const titles = { chores: "Chores", calendar: "Calendar", meals: "Meal plan", inventory: "Inventory", rewards: "Rewards" };
  document.getElementById("header-title").textContent = titles[view];

  if (view === "chores") renderChores();
  if (view === "calendar") renderCalendar();
  if (view === "meals") renderMeals();
  if (view === "inventory") renderInventory();
  if (view === "rewards") renderRewards();
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

// ---- Header buttons ----
document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
document.getElementById("settings-btn").addEventListener("click", () => {
  openSettingsSheet(async () => {
    // refresh whatever view is showing after member list changes
    switchView(currentView);
  });
});

// ---- Calendar month nav ----
document.getElementById("cal-prev").addEventListener("click", () => shiftMonth(-1));
document.getElementById("cal-next").addEventListener("click", () => shiftMonth(1));

// ---- Inventory <-> Shopping list toggle ----
document.getElementById("go-shopping-list").addEventListener("click", () => {
  setInventoryMode(inventoryMode === "stock" ? "shopping" : "stock");
});

// ---- Floating add button ----
document.getElementById("fab-add").addEventListener("click", () => {
  if (currentView === "chores") openAddChoreSheet();
  if (currentView === "calendar") openAddEventSheet();
  if (currentView === "inventory") openAddSheetForMode();
  if (currentView === "meals") switchView("meals"); // meals are added by tapping a day slot
  if (currentView === "rewards") document.getElementById("settings-btn").click();
});

async function boot() {
  await loadMembers();
  switchView("chores");
}
