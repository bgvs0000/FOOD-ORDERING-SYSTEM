/* ==========================================================
   ORDERS — logic only
   Lahat ng orders ay nasa iisang list:  bv_orders

   STATUS FLOW:
   PENDING → CONFIRMED → PREPARING → OUT_FOR_DELIVERY → COMPLETED
      ↘ CANCELLED
   Customer: puwedeng mag-cancel habang PENDING
   Admin:    puwedeng mag-cancel hangga't hindi pa COMPLETED
   ========================================================== */
const Orders = (() => {

  class OrderError extends Error {
    constructor(message) {
      super(message);
      this.name = "OrderError";
    }
  }

  const FLOW = ["PENDING", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "COMPLETED"];

  const STATUS = {
    PENDING: {
      label: "Pending", title: "Order received", icon: "🧾",
      desc: "Waiting for the restaurant to confirm your order.",
    },
    CONFIRMED: {
      label: "Confirmed", title: "Order confirmed", icon: "👍",
      desc: "The kitchen accepted your order. Firing up the grill!",
    },
    PREPARING: {
      label: "Preparing", title: "On the grill", icon: "🔥",
      desc: "Your burgers are being smashed and stacked fresh.",
    },
    OUT_FOR_DELIVERY: {
      label: "On the way", title: "Out for delivery", icon: "🛵",
      desc: "Your rider is on the way. Get ready to eat!",
      pickup: { label: "Ready", title: "Ready for pickup", icon: "🛍", desc: "Your order is packed and waiting at the counter." },
    },
    COMPLETED: {
      label: "Completed", title: "Delivered. Enjoy!", icon: "🎉",
      desc: "Thanks for riding the Bun Voyage. Don't forget to rate us!",
      pickup: { title: "Picked up. Enjoy!" },
    },
    CANCELLED: {
      label: "Cancelled", title: "Order cancelled", icon: "✕",
      desc: "This order was cancelled. Any payment will be refunded.",
    },
  };

  /** Button label ng admin para sa susunod na step */
  const NEXT_ACTION = {
    PENDING: "Accept",
    CONFIRMED: "Start grill",
    PREPARING: { delivery: "Send out", pickup: "Mark ready" },
    OUT_FOR_DELIVERY: { delivery: "Delivered", pickup: "Picked up" },
  };

  const PAYMENT_LABELS = { gcash: "GCash", card: "Card", cod: "Cash on Delivery" };

  /* ---------- Storage ---------- */
  const loadAll = () => Store.get("orders", []);
  const saveAll = (orders) => Store.set("orders", orders);

  function updateOrder(id, updater) {
    let updated = null;
    const orders = loadAll().map((o) => {
      if (o.id !== id) return o;
      updated = updater({ ...o });
      return updated;
    });
    saveAll(orders);
    return updated;
  }

  /* ---------- Stock ---------- */
  function adjustStock(productId, delta) {
    const product = Menu.get(productId);
    if (!product) return;
    Store.update("stock", {}, (stock) => {
      const current = stock[productId] !== undefined ? stock[productId] : product.stock;
      stock[productId] = Math.max(0, current + delta);
      return stock;
    });
  }

  /* ---------- IDs: BV-1001, BV-1002, ... ---------- */
  function nextId() {
    const seq = Store.get("order_seq", 1000) + 1;
    Store.set("order_seq", seq);
    return "BV-" + seq;
  }

  function computeEta(orderType, timing, scheduleTime, from = Date.now()) {
    if (timing === "schedule" && scheduleTime) return new Date(scheduleTime).toISOString();
    const mins = CONFIG.etaMinutes[orderType] || 25;
    return new Date(from + mins * 60000).toISOString();
  }

  function setStatus(o, status, at = new Date().toISOString()) {
    o.status = status;
    o.history = [...(o.history || []), { status, at }];
    if (status === "COMPLETED") {
      o.completedAt = at;
      o.payment = { ...o.payment, paid: true };
    }
    return o;
  }

  /* ==========================================================
     PUBLIC API
     ========================================================== */
  return {
    OrderError,
    FLOW,
    STATUS,
    PAYMENT_LABELS,

    /* ---------- Queries (customer) ---------- */
    all() {
      return loadAll();
    },

    mine() {
      const uid = Store.currentUserId();
      return loadAll()
        .filter((o) => o.userId === uid)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    get(id) {
      return this.mine().find((o) => o.id === id) || null;
    },

    active() {
      return this.mine().filter((o) => this.isActive(o));
    },

    past() {
      return this.mine().filter((o) => !this.isActive(o));
    },

    /* ---------- Queries (admin) ---------- */

    /** Lahat ng orders, newest first */
    everything() {
      return loadAll().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    /** Kahit kaninong order */
    byId(id) {
      return loadAll().find((o) => o.id === id) || null;
    },

    byUser(userId) {
      return this.everything().filter((o) => o.userId === userId);
    },

    /* ---------- Status helpers ---------- */
    statusInfo(order) {
      const base = STATUS[order.status] || STATUS.PENDING;
      const variant = order.orderType === "pickup" && base.pickup ? base.pickup : {};
      return { ...base, ...variant };
    },

    stepIndex(order) {
      return FLOW.indexOf(order.status);
    },

    canCancel(order) {
      return !!order && order.status === "PENDING";
    },

    isActive(order) {
      return !!order && !["COMPLETED", "CANCELLED"].includes(order.status);
    },

    /** "Accept" / "Start grill" / "Send out" / ... (null kapag tapos na) */
    nextAction(order) {
      const a = NEXT_ACTION[order.status];
      if (!a) return null;
      return typeof a === "string" ? a : a[order.orderType] || a.delivery;
    },

    /* ==========================================================
       PLACE ORDER (customer checkout)
       ========================================================== */
    async place(data) {
      await Store.delay(1200);

      const user = Auth.current();
      if (!user) throw new OrderError("Please log in again.");

      const orderType = data.orderType === "pickup" ? "pickup" : "delivery";
      const totals = Cart.totals({ orderType });
      if (totals.items.length === 0) throw new OrderError("Your cart is empty.");

      for (const item of totals.items) {
        const stock = Menu.stock(item.productId);
        const needed = Cart.qtyOfProduct(item.productId);
        if (needed > stock) {
          throw new OrderError(
            stock === 0
              ? `${item.product.name} just sold out. Please remove it from your cart.`
              : `Only ${stock} ${item.product.name} left. Please update your cart.`
          );
        }
      }

      const now = new Date().toISOString();
      const order = {
        id: nextId(),
        userId: user.id,
        status: "PENDING",
        history: [{ status: "PENDING", at: now }],
        createdAt: now,

        items: totals.items.map((i) => ({
          productId: i.productId,
          name: i.product.name,
          image: i.product.image,
          accent: i.product.accent,
          qty: i.qty,
          size: i.size,
          addons: i.addons,
          remove: i.remove,
          notes: i.notes,
          description: i.description,
          unitPrice: i.unitPrice,
          lineTotal: i.lineTotal,
        })),

        subtotal: totals.subtotal,
        delivery: totals.delivery,
        discount: totals.discount,
        promoCode: totals.promo ? totals.promo.code : null,
        total: totals.total,

        orderType,
        timing: data.timing === "schedule" ? "schedule" : "asap",
        scheduleTime: data.timing === "schedule" ? data.scheduleTime : null,
        eta: computeEta(orderType, data.timing, data.scheduleTime),

        customer: {
          name: data.name.trim(),
          phone: data.phone.trim(),
          email: user.email,
          address: orderType === "delivery" ? data.address.trim() : CONFIG.storeAddress,
          landmark: orderType === "delivery" ? (data.landmark || "").trim() : "",
        },

        payment: {
          method: data.payment,
          label: PAYMENT_LABELS[data.payment] || data.payment,
          last4:
            data.payment === "card" ? String(data.cardNumber || "").replace(/\D/g, "").slice(-4)
            : data.payment === "gcash" ? String(data.gcashNumber || "").replace(/\D/g, "").slice(-4)
            : null,
          changeFor: data.payment === "cod" && data.changeFor ? Number(data.changeFor) : null,
          paid: data.payment !== "cod",
        },

        riderNote: (data.riderNote || "").trim(),
        rating: null,
      };

      order.items.forEach((i) => adjustStock(i.productId, -i.qty));
      saveAll([...loadAll(), order]);
      Cart.clear();
      return order;
    },

    /* ---------- Move to next status (customer demo + admin) ---------- */
    advance(id) {
      return updateOrder(id, (o) => {
        const idx = FLOW.indexOf(o.status);
        if (idx === -1 || idx >= FLOW.length - 1) return o;
        return setStatus(o, FLOW[idx + 1]);
      });
    },

    /* ---------- Cancel (customer: PENDING only) ---------- */
    cancel(id, reason = "Changed my mind") {
      const order = this.get(id);
      if (!order) throw new OrderError("Order not found.");
      if (!this.canCancel(order)) {
        throw new OrderError("This order can no longer be cancelled — it's already being prepared.");
      }
      return this.forceCancel(id, reason, "customer");
    },

    /* ---------- Cancel (admin: any active order) ---------- */
    adminCancel(id, reason = "Cancelled by store") {
      const order = this.byId(id);
      if (!order) throw new OrderError("Order not found.");
      if (!this.isActive(order)) throw new OrderError("This order is already finished.");
      return this.forceCancel(id, reason, "store");
    },

    forceCancel(id, reason, by) {
      const order = this.byId(id);
      order.items.forEach((i) => adjustStock(i.productId, i.qty));   // ibalik ang stock
      return updateOrder(id, (o) => {
        o.cancelReason = reason;
        o.cancelledBy = by;
        o.cancelledAt = new Date().toISOString();
        return setStatus(o, "CANCELLED", o.cancelledAt);
      });
    },

    /* ---------- Rate ---------- */
    rate(id, { stars, tags = [], comment = "" }) {
      const order = this.get(id);
      if (!order) throw new OrderError("Order not found.");
      if (order.status !== "COMPLETED") throw new OrderError("You can only rate completed orders.");
      if (!stars || stars < 1 || stars > 5) throw new OrderError("Please choose a star rating.");
      return updateOrder(id, (o) => {
        o.rating = { stars: Number(stars), tags, comment: comment.trim(), at: new Date().toISOString() };
        return o;
      });
    },

    reorder(id) {
      const order = this.get(id);
      if (!order) throw new OrderError("Order not found.");
      return Cart.addMany(order.items);
    },

    /* ---------- Customer stats ---------- */
    stats() {
      return this.statsFor(this.mine());
    },

    statsFor(list) {
      const completed = list.filter((o) => o.status === "COMPLETED");
      const spent = completed.reduce((sum, o) => sum + o.total, 0);

      const counts = {};
      completed.forEach((o) => o.items.forEach((i) => { counts[i.name] = (counts[i.name] || 0) + i.qty; }));
      const favorite = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

      const points = Math.floor(spent * CONFIG.pointsPerPeso);
      return {
        total: list.length,
        completed: completed.length,
        cancelled: list.filter((o) => o.status === "CANCELLED").length,
        active: list.filter((o) => this.isActive(o)).length,
        spent,
        favorite: favorite ? favorite[0] : null,
        points,
        pointsToNext: CONFIG.pointsForFreeBurger - (points % CONFIG.pointsForFreeBurger),
      };
    },

    timeOf(order, status) {
      const h = (order.history || []).find((x) => x.status === status);
      return h ? new Date(h.at) : null;
    },

    /* ==========================================================
       ADMIN DEMO DATA
       ========================================================== */

    /** Gumawa ng sample orders mula sa nakaraang `days` araw */
    seedSample(days = 30, perDay = [2, 7]) {
      const names = [
        ["Jamie Mendoza", "jamie@demo.ph"], ["Rico Cruz", "rico@demo.ph"], ["Ana Lim", "ana@demo.ph"],
        ["Paolo Reyes", "paolo@demo.ph"], ["Bea Santos", "bea@demo.ph"], ["Carlo Tan", "carlo@demo.ph"],
        ["Mika Garcia", "mika@demo.ph"], ["Leo Ramos", "leo@demo.ph"],
      ];
      const customers = names.map(([n, e], i) =>
        Auth.createDemoCustomer(n, e, new Date(Date.now() - (days - i * 3) * 86400000).toISOString())
      );

      const menu = Menu.raw();
      const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
      const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
      const weighted = () => {
        const pool = menu.flatMap((p) => Array(Math.ceil(p.popular / 20)).fill(p));
        return pick(pool);
      };

      const created = [];
      for (let d = days - 1; d >= 0; d--) {
        const count = rand(perDay[0], perDay[1]);
        for (let k = 0; k < count; k++) {
          const when = new Date();
          when.setDate(when.getDate() - d);
          when.setHours(rand(10, 21), rand(0, 59), 0, 0);
          if (when > new Date()) when.setTime(Date.now() - rand(5, 90) * 60000);

          const user = pick(customers);
          const lines = {};
          for (let n = 0; n < rand(1, 3); n++) {
            const p = weighted();
            lines[p.id] = lines[p.id] || { p, qty: 0 };
            lines[p.id].qty += rand(1, 2);
          }
          const items = Object.values(lines).map(({ p, qty }) => ({
            productId: p.id, name: p.name, image: p.image, accent: p.accent,
            qty, size: "Regular", addons: [], remove: [], notes: "", description: "",
            unitPrice: p.price, lineTotal: p.price * qty,
          }));

          const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
          const orderType = Math.random() < 0.75 ? "delivery" : "pickup";
          const delivery = orderType === "pickup" || subtotal >= CONFIG.freeDeliveryMin ? 0 : CONFIG.deliveryFee;
          const method = pick(["gcash", "gcash", "card", "cod"]);
          const at = when.toISOString();

          // lumang orders = tapos na; ngayong araw = may active pa
          let status;
          if (d === 0) status = pick(["PENDING", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "COMPLETED", "COMPLETED"]);
          else status = Math.random() < 0.9 ? "COMPLETED" : "CANCELLED";

          const order = {
            id: nextId(), userId: user.id, status: "PENDING",
            history: [{ status: "PENDING", at }], createdAt: at,
            items, subtotal, delivery, discount: 0, promoCode: null, total: subtotal + delivery,
            orderType, timing: "asap", scheduleTime: null,
            eta: computeEta(orderType, "asap", null, when.getTime()),
            customer: {
              name: user.name, phone: "0917" + rand(1000000, 9999999), email: user.email,
              address: orderType === "delivery" ? `${rand(10, 999)} ${pick(["Mabini", "Rizal", "Bonifacio", "Luna"])} St., Manila` : CONFIG.storeAddress,
              landmark: "",
            },
            payment: { method, label: PAYMENT_LABELS[method], last4: method === "cod" ? null : String(rand(1000, 9999)), changeFor: null, paid: method !== "cod" },
            riderNote: "", rating: null, sample: true,
          };

          // dumaan sa flow para may timeline
          const target = status === "CANCELLED" ? 0 : FLOW.indexOf(status);
          for (let s = 1; s <= target; s++) {
            setStatus(order, FLOW[s], new Date(when.getTime() + s * rand(3, 8) * 60000).toISOString());
          }
          if (status === "CANCELLED") {
            order.cancelReason = pick(["Customer request", "Out of stock"]);
            order.cancelledBy = "store";
            setStatus(order, "CANCELLED", new Date(when.getTime() + 4 * 60000).toISOString());
          }
          if (status === "COMPLETED" && Math.random() < 0.6) {
            order.rating = { stars: pick([4, 5, 5, 5, 3]), tags: [], comment: "", at: order.completedAt };
          }
          created.push(order);
        }
      }

      saveAll([...loadAll(), ...created]);
      return created.length;
    },

    /** Burahin lahat ng orders (demo) */
    clearAll() {
      saveAll([]);
    },

    onChange(callback) {
      return Store.on("orders", callback);
    },
  };
})();