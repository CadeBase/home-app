import { supabase } from "./supabaseClient.js";
import { escapeHtml } from "./members.js";
import { openSheet, closeSheet } from "./sheet.js";

export let mode = "stock"; // 'stock' or 'shopping'
let items = [];
let shoppingItems = [];

export function setMode(next) {
  mode = next;
  const btn = document.getElementById("go-shopping-list");
  btn.textContent = mode === "stock" ? "🛒 Shopping list" : "📦 Inventory";
  renderInventory();
}

async function loadStock() {
  const { data } = await supabase.from("inventory_items").select("*").order("name");
  items = data || [];
}

async function loadShopping() {
  const { data } = await supabase
    .from("shopping_items")
    .select("*")
    .order("checked")
    .order("created_at", { ascending: false });
  shoppingItems = data || [];
}

async function maybeAddToShoppingList(item) {
  if (Number(item.quantity) > Number(item.low_threshold)) return;
  const { data: existing } = await supabase
    .from("shopping_items")
    .select("id")
    .eq("inventory_item_id", item.id)
    .eq("checked", false)
    .limit(1);
  if (existing && existing.length > 0) return;
  await supabase.from("shopping_items").insert({
    name: item.name,
    auto_added: true,
    inventory_item_id: item.id,
  });
}

function stockRowHtml(item) {
  const low = Number(item.quantity) <= Number(item.low_threshold);
  return `
    <div class="card row between" data-item-id="${item.id}">
      <div>
        <div style="font-weight:600;">${escapeHtml(item.name)}</div>
        <div class="muted" style="font-size:12px;">${item.quantity} ${escapeHtml(item.unit || "")} ${low ? "· running low" : ""}</div>
      </div>
      <div class="row" style="gap:6px;">
        <button class="icon-btn" data-action="dec">−</button>
        <button class="icon-btn" data-action="inc">+</button>
        <button class="icon-btn" data-action="delete">🗑️</button>
      </div>
    </div>
  `;
}

function shoppingRowHtml(item) {
  return `
    <div class="card row between" data-item-id="${item.id}">
      <div class="row" style="gap:12px;">
        <button class="check-circle ${item.checked ? "done" : ""}" data-action="toggle">${item.checked ? "✓" : ""}</button>
        <div>
          <div class="chore-title ${item.checked ? "done" : ""}">${escapeHtml(item.name)} ${item.quantity ? `(${escapeHtml(item.quantity)})` : ""}</div>
          ${item.auto_added ? `<div class="muted" style="font-size:12px;">Auto-added — running low</div>` : ""}
        </div>
      </div>
      <button class="icon-btn" data-action="delete">🗑️</button>
    </div>
  `;
}

export async function renderInventory() {
  const list = document.getElementById("inventory-list");

  if (mode === "stock") {
    await loadStock();
    if (items.length === 0) {
      list.innerHTML = `<div class="empty-state"><span class="big-emoji">📦</span>Nothing tracked yet. Tap + to add an item.</div>`;
      return;
    }
    list.innerHTML = items.map(stockRowHtml).join("");
    list.querySelectorAll("[data-action='inc'],[data-action='dec']").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.closest("[data-item-id]").dataset.itemId;
        const item = items.find((i) => i.id === id);
        const delta = e.target.dataset.action === "inc" ? 1 : -1;
        const newQty = Math.max(0, Number(item.quantity) + delta);
        await supabase.from("inventory_items").update({ quantity: newQty, updated_at: new Date().toISOString() }).eq("id", id);
        const updated = { ...item, quantity: newQty };
        await maybeAddToShoppingList(updated);
        await renderInventory();
      });
    });
    list.querySelectorAll("[data-action='delete']").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.closest("[data-item-id]").dataset.itemId;
        if (!confirm("Remove this item from inventory?")) return;
        await supabase.from("inventory_items").delete().eq("id", id);
        await renderInventory();
      });
    });
  } else {
    await loadShopping();
    if (shoppingItems.length === 0) {
      list.innerHTML = `<div class="empty-state"><span class="big-emoji">🛒</span>Shopping list is empty.</div>`;
      return;
    }
    list.innerHTML = shoppingItems.map(shoppingRowHtml).join("");
    list.querySelectorAll("[data-action='toggle']").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.closest("[data-item-id]").dataset.itemId;
        const item = shoppingItems.find((i) => i.id === id);
        await supabase.from("shopping_items").update({ checked: !item.checked }).eq("id", id);
        await renderInventory();
      });
    });
    list.querySelectorAll("[data-action='delete']").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.closest("[data-item-id]").dataset.itemId;
        await supabase.from("shopping_items").delete().eq("id", id);
        await renderInventory();
      });
    });
  }
}

export function openAddSheetForMode() {
  if (mode === "stock") {
    openSheet(
      "New inventory item",
      `
        <label>Item name</label>
        <input id="inv-name" placeholder="e.g. Milk" />
        <label>Current quantity</label>
        <input id="inv-qty" type="number" min="0" value="1" />
        <label>Unit (optional)</label>
        <input id="inv-unit" placeholder="e.g. cartons, cans, rolls" />
        <label>Low-stock alert level</label>
        <input id="inv-threshold" type="number" min="0" value="1" />
        <button class="btn btn-primary btn-block" id="inv-save">Add item</button>
      `,
      (body) => {
        body.querySelector("#inv-save").addEventListener("click", async () => {
          const name = body.querySelector("#inv-name").value.trim();
          if (!name) return;
          const quantity = Number(body.querySelector("#inv-qty").value) || 0;
          const unit = body.querySelector("#inv-unit").value.trim();
          const low_threshold = Number(body.querySelector("#inv-threshold").value) || 0;
          await supabase.from("inventory_items").insert({ name, quantity, unit, low_threshold });
          closeSheet();
          await renderInventory();
        });
      }
    );
  } else {
    openSheet(
      "Add to shopping list",
      `
        <label>Item</label>
        <input id="shop-name" placeholder="e.g. Birthday candles" />
        <label>Quantity / note (optional)</label>
        <input id="shop-qty" placeholder="e.g. 2 packs" />
        <button class="btn btn-primary btn-block" id="shop-save">Add</button>
      `,
      (body) => {
        body.querySelector("#shop-save").addEventListener("click", async () => {
          const name = body.querySelector("#shop-name").value.trim();
          if (!name) return;
          const quantity = body.querySelector("#shop-qty").value.trim();
          await supabase.from("shopping_items").insert({ name, quantity });
          closeSheet();
          await renderInventory();
        });
      }
    );
  }
}
