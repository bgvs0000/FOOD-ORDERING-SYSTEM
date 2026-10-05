/* ==========================================================
   CART — logic only (walang DOM dito)
   Ang cart ay naka-save per user:  bv_cart_<userId>

   Isang cart line:
   {
     key: "1|Large|Bacon,Extra Cheese|No Onions|",
     productId: 1,
     qty: 2,
     size: "Large",
     addons: ["Bacon", "Extra Cheese"],
     remove: ["No Onions"],
     notes: ""
   }
   ========================================================== */
const Cart = (() => {

  class CartError extends Error {
    constructor(message) {
      super(message);
      this.name = "CartError";
    }
  }

  /* ---------- Storage ---------- */
  function load() {
    return Store.getUser("cart", []);
  }

  function save(lines) {
    Store.setUser("cart", lines);
    return lines;
  }

  /* ---------- Helpers ---------- */

  /** Same product + same options = same line (qty lang ang madadagdag) */
  function buildKey(productId, { size = "Regular", addons = [], remove = [], notes = "" } = {}) {
    return [
      productId,
      size,
      [...addons].sort().join(","),
      [...remove].sort().join(","),
      notes.trim().toLowerCase(),
    ].join("|");
  }

  /** Presyo ng ISANG piraso, kasama ang size at add-ons */
  function unitPrice(product, { size = "Regular", addons = [] } = {}) {
    const sizePrice = Menu.hasSize(product) ? (OPTIONS.sizes[size] || 0) : 0;
    const addonPrice = Menu.isCustomizable(product)
      ? addons.reduce((sum, a) => sum + (OPTIONS.addons[a] || 0), 0)
      : 0;
    return product.price + sizePrice + addonPrice;
  }

  /** Ilang piraso ng product na ito ang nasa cart (lahat ng variations) */
  function qtyOfProduct(productId, lines = load()) {
    return lines
      .filter((l) => l.productId === Number(productId))
      .reduce((sum, l) => sum + l.qty, 0);
  }

  /* ==========================================================
     PUBLIC API
     ========================================================== */
  return {
    CartError,
    unitPrice,
    buildKey,

    /* ---------- Read ---------- */
    lines() {
      return load();
    },

    /** Lines + product info + computed prices (para sa UI) */
    detailed() {
      return load()
        .map((line) => {
          const product = Menu.get(line.productId);
          if (!product) return null;               // product removed from menu
          const price = unitPrice(product, line);
          return {
            ...line,
            product,
            unitPrice: price,
            lineTotal: price * line.qty,
            description: this.describe(line, product),
          };
        })
        .filter(Boolean);
    },

    count() {
      return load().reduce((sum, l) => sum + l.qty, 0);
    },

    isEmpty() {
      return load().length === 0;
    },

    qtyOfProduct,

    /** Ilan pa ang puwedeng i-add (stock − nasa cart na) */
    available(productId) {
      return Math.max(0, Menu.stock(productId) - qtyOfProduct(productId));
    },

    /** "Large · +Bacon · No onions" */
    describe(line, product = Menu.get(line.productId)) {
      const parts = [];
      if (product && Menu.hasSize(product) && line.size && line.size !== "Regular") parts.push(line.size);
      (line.addons || []).forEach((a) => parts.push("+" + a));
      (line.remove || []).forEach((r) => parts.push(r));
      return parts.join(" · ");
    },

    /* ---------- Add ---------- */
    add(productId, options = {}) {
      const product = Menu.get(productId);
      if (!product) throw new CartError("Product not found.");

      const qty = Math.max(1, parseInt(options.qty, 10) || 1);
      const opts = {
        size: Menu.hasSize(product) ? options.size || "Regular" : "Regular",
        addons: Menu.isCustomizable(product) ? options.addons || [] : [],
        remove: Menu.isCustomizable(product) ? options.remove || [] : [],
        notes: (options.notes || "").trim().slice(0, 120),
      };

      // Stock check
      const left = this.available(productId);
      if (left <= 0) {
        throw new CartError(
          Menu.stock(productId) === 0
            ? `${product.name} is sold out.`
            : `You already have all available ${product.name} in your cart.`
        );
      }
      if (qty > left) {
        throw new CartError(`Only ${left} more ${product.name} available.`);
      }

      const key = buildKey(product.id, opts);
      const lines = load();
      const existing = lines.find((l) => l.key === key);

      if (existing) {
        existing.qty = Math.min(existing.qty + qty, CONFIG.maxQtyPerItem);
      } else {
        lines.push({ key, productId: product.id, qty, ...opts, addedAt: Date.now() });
      }

      save(lines);
      return { product, qty, line: existing || lines[lines.length - 1] };
    },

    /* ---------- Update qty ---------- */
    setQty(key, qty) {
      qty = parseInt(qty, 10);
      const lines = load();
      const line = lines.find((l) => l.key === key);
      if (!line) return;

      if (!qty || qty <= 0) return this.remove(key);

      // Stock: other lines of the same product count too
      const others = qtyOfProduct(line.productId, lines) - line.qty;
      const max = Math.min(CONFIG.maxQtyPerItem, Menu.stock(line.productId) - others);
      if (qty > max) {
        line.qty = Math.max(1, max);
        save(lines);
        throw new CartError(`Only ${max} available.`);
      }

      line.qty = qty;
      save(lines);
    },

    increment(key, delta = 1) {
      const line = load().find((l) => l.key === key);
      if (line) this.setQty(key, line.qty + delta);
    },

    /* ---------- Remove ---------- */
    remove(key) {
      save(load().filter((l) => l.key !== key));
    },

    clear() {
      save([]);
      this.removePromo();
    },

    /* ---------- Reorder (galing history) ----------
       Ina-add ang lahat ng puwede; nililista ang hindi na available.
    ------------------------------------------------- */
    addMany(items) {
      const added = [];
      const skipped = [];
      items.forEach((item) => {
        try {
          const left = this.available(item.productId);
          if (left <= 0) throw new CartError("Out of stock");
          const qty = Math.min(item.qty, left);
          this.add(item.productId, { ...item, qty });
          added.push(item);
          if (qty < item.qty) skipped.push({ ...item, reason: `Only ${qty} added` });
        } catch (e) {
          skipped.push({ ...item, reason: e.message });
        }
      });
      return { added, skipped };
    },

    /* ==========================================================
       PROMO CODES
       ========================================================== */
    getPromo() {
      const code = Store.getUser("promo", null);
      return code && PROMO_CODES[code] ? { code, ...PROMO_CODES[code] } : null;
    },

    applyPromo(input) {
      const code = String(input || "").trim().toUpperCase();
      if (!code) throw new CartError("Enter a promo code.");

      const promo = PROMO_CODES[code];
      if (!promo) throw new CartError("Invalid promo code.");

      const subtotal = this.totals().subtotal;
      if (subtotal < promo.minSpend) {
        throw new CartError(`Minimum spend for ${code} is ${peso(promo.minSpend)}.`);
      }

      // FIRSTBITE: para lang sa first order
      if (code === "FIRSTBITE" && typeof Orders !== "undefined" && Orders.mine().length > 0) {
        throw new CartError("FIRSTBITE is only valid on your first order.");
      }

      Store.setUser("promo", code);
      return { code, ...promo };
    },

    removePromo() {
      Store.setUser("promo", null);
    },

    /* ==========================================================
       TOTALS
       orderType: "delivery" | "pickup"
       ========================================================== */
    totals({ orderType = "delivery" } = {}) {
      const items = this.detailed();
      const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
      const count = items.reduce((sum, i) => sum + i.qty, 0);

      let promo = this.getPromo();
      let promoValid = true;
      if (promo && subtotal < promo.minSpend) promoValid = false;

      // Delivery fee
      let delivery = CONFIG.deliveryFee;
      if (orderType === "pickup" || subtotal === 0) delivery = 0;
      if (subtotal >= CONFIG.freeDeliveryMin) delivery = 0;
      if (promo && promoValid && promo.type === "freeship") delivery = 0;

      // Discount
      let discount = 0;
      if (promo && promoValid) {
        if (promo.type === "percent") discount = Math.round((subtotal * promo.value) / 100);
        if (promo.type === "fixed")   discount = Math.min(promo.value, subtotal);
      }

      const total = Math.max(0, subtotal + delivery - discount);

      return {
        items,
        count,
        subtotal,
        delivery,
        discount,
        total,
        promo: promo && promoValid ? promo : null,
        promoInvalid: promo && !promoValid ? promo : null,
        freeDeliveryLeft: Math.max(0, CONFIG.freeDeliveryMin - subtotal),
        freeDeliveryProgress: Math.min(100, Math.round((subtotal / CONFIG.freeDeliveryMin) * 100)),
      };
    },

    /* ---------- Listen for changes (navbar badge, etc.) ---------- */
    onChange(callback) {
      return Store.on(Store.userKey("cart"), callback);
    },
  };
})();