/* ==========================================================
   MOCK DATA — Bun Voyage
   Ito ang "database" ng mockup.
   - DEFAULT_PRODUCTS = starting menu
   - Kapag in-edit ng admin, naka-save ang menu sa Store ("products")
     kaya lumalabas agad ang changes sa customer menu.
   ========================================================== */

/* ---------- Store settings ---------- */
const CONFIG = {
  storeName: "Bun Voyage",
  storeAddress: "123 Grill Street, Manila",
  currency: "₱",
  deliveryFee: 49,
  freeDeliveryMin: 500,      // libre ang delivery kapag ₱500 pataas
  pointsPerPeso: 0.1,        // 1 point kada ₱10
  pointsForFreeBurger: 100,
  etaMinutes: { delivery: 25, pickup: 15 },
  maxQtyPerItem: 20,
  lowStockAt: 5,             // "low stock" kapag 5 pababa
};

/* ---------- Categories ---------- */
const CATEGORIES = [
  { id: "all",     name: "All",     emoji: "🍽" },
  { id: "burgers", name: "Burgers", emoji: "🍔" },
  { id: "chicken", name: "Chicken", emoji: "🍗" },
  { id: "sides",   name: "Sides",   emoji: "🍟" },
  { id: "drinks",  name: "Drinks",  emoji: "🥤" },
  { id: "combos",  name: "Combos",  emoji: "🎁" },
];

/* ---------- Default products ----------
   available: false → nakatago sa customer menu (admin can toggle)
-------------------------------------------------------------- */
const DEFAULT_PRODUCTS = [
  /* ===== BURGERS ===== */
  { id: 1,  name: "Classic Smash",   category: "burgers", price: 149, image: "burger-classic.svg", accent: "#FFC233", tag: "Bestseller", rating: 4.9, reviews: 1284, calories: 620,  prepTime: 12, stock: 50,  popular: 100, featured: true,  available: true,
    desc: "Our signature smash-pressed beef patty with melty cheddar, crisp lettuce, tomato, pickles, and house sauce on a toasted brioche bun." },
  { id: 2,  name: "Double Stack",    category: "burgers", price: 219, image: "burger-double.svg",  accent: "#FF4B3E", tag: "Bestseller", rating: 4.8, reviews: 962,  calories: 940,  prepTime: 15, stock: 35,  popular: 95,  featured: true,  available: true,
    desc: "Two smashed patties, double cheddar, caramelized onions, and extra house sauce. For the seriously hungry." },
  { id: 3,  name: "Spicy Inferno",   category: "burgers", price: 189, image: "burger-spicy.svg",   accent: "#FF8A1F", tag: "Spicy",      rating: 4.7, reviews: 541,  calories: 710,  prepTime: 13, stock: 30,  popular: 88,  featured: true,  available: true,
    desc: "Smashed patty with pepper jack, fresh jalapeños, chipotle mayo, and a red chili bun. Bring water." },
  { id: 4,  name: "Cheesy Overload", category: "burgers", price: 199, image: "burger-classic.svg", accent: "#FFE08A", tag: "New",        rating: 4.6, reviews: 188,  calories: 860,  prepTime: 14, stock: 25,  popular: 70,  featured: false, available: true,
    desc: "Four kinds of cheese (cheddar, mozzarella, gouda, and cheese sauce) piled on a juicy beef patty." },
  { id: 5,  name: "BBQ Bacon Ranch", category: "burgers", price: 209, image: "burger-double.svg",  accent: "#C98B5E", tag: null,         rating: 4.7, reviews: 402,  calories: 890,  prepTime: 14, stock: 28,  popular: 80,  featured: false, available: true,
    desc: "Smoky BBQ glaze, crispy bacon, onion rings, and cool ranch on a toasted sesame bun." },
  { id: 6,  name: "Mushroom Swiss",  category: "burgers", price: 189, image: "burger-classic.svg", accent: "#D9C7A7", tag: null,         rating: 4.5, reviews: 236,  calories: 680,  prepTime: 13, stock: 20,  popular: 55,  featured: false, available: true,
    desc: "Sautéed garlic mushrooms and melted Swiss cheese over a beef patty with truffle mayo." },
  { id: 7,  name: "Junior Burger",   category: "burgers", price: 89,  image: "burger-classic.svg", accent: "#BFE3A8", tag: "Value",      rating: 4.4, reviews: 315,  calories: 390,  prepTime: 8,  stock: 60,  popular: 65,  featured: false, available: true,
    desc: "A smaller smash burger with cheese, ketchup, and pickles. Perfect for a quick bite." },

  /* ===== CHICKEN ===== */
  { id: 8,  name: "Crispy Chicken",        category: "chicken", price: 169, image: "burger-chicken.svg", accent: "#FFD27A", tag: "Bestseller", rating: 4.8, reviews: 733, calories: 650, prepTime: 14, stock: 32, popular: 90, featured: true,  available: true,
    desc: "Buttermilk-fried chicken thigh, coleslaw, pickles, and honey mustard on a soft potato bun." },
  { id: 9,  name: "Nashville Hot",         category: "chicken", price: 189, image: "burger-chicken.svg", accent: "#FF7A59", tag: "Spicy",      rating: 4.6, reviews: 298, calories: 720, prepTime: 15, stock: 18, popular: 72, featured: false, available: true,
    desc: "Crispy chicken dipped in fiery Nashville hot oil with cooling pickles and white sauce." },
  { id: 10, name: "Chicken Tenders (5pc)", category: "chicken", price: 159, image: "burger-chicken.svg", accent: "#F4A23A", tag: null,         rating: 4.5, reviews: 207, calories: 540, prepTime: 10, stock: 40, popular: 60, featured: false, available: true,
    desc: "Five golden chicken tenders served with your choice of honey mustard or BBQ dip." },

  /* ===== SIDES ===== */
  { id: 11, name: "Crispy Fries", category: "sides", price: 69, image: "fries.svg", accent: "#FFC233", tag: null,  rating: 4.7, reviews: 1102, calories: 320, prepTime: 6, stock: 80, popular: 92, featured: false, available: true,
    desc: "Double-fried skin-on fries with sea salt. Crispy outside, fluffy inside." },
  { id: 12, name: "Cheesy Fries", category: "sides", price: 99, image: "fries.svg", accent: "#FFE08A", tag: "New", rating: 4.6, reviews: 344,  calories: 480, prepTime: 7, stock: 45, popular: 74, featured: false, available: true,
    desc: "Our crispy fries smothered in warm cheese sauce and topped with bacon bits." },
  { id: 13, name: "Onion Rings",  category: "sides", price: 79, image: "fries.svg", accent: "#E8C48A", tag: null,  rating: 4.4, reviews: 190,  calories: 360, prepTime: 7, stock: 4,  popular: 50, featured: false, available: true,
    desc: "Thick-cut onion rings in a crunchy beer batter, served with chipotle mayo." },

  /* ===== DRINKS ===== */
  { id: 14, name: "Fizz Cola",      category: "drinks", price: 49,  image: "soda.svg", accent: "#8EC5FF", tag: null,  rating: 4.5, reviews: 640, calories: 150, prepTime: 1, stock: 100, popular: 85, featured: false, available: true,
    desc: "Ice-cold classic cola. The perfect partner for any burger." },
  { id: 15, name: "Lemon Iced Tea", category: "drinks", price: 59,  image: "soda.svg", accent: "#FFE57A", tag: null,  rating: 4.6, reviews: 412, calories: 120, prepTime: 2, stock: 70,  popular: 68, featured: false, available: true,
    desc: "House-brewed black tea with fresh lemon and just the right sweetness." },
  { id: 16, name: "Vanilla Shake",  category: "drinks", price: 119, image: "soda.svg", accent: "#FFF4E0", tag: "New", rating: 4.8, reviews: 276, calories: 520, prepTime: 4, stock: 0,   popular: 66, featured: false, available: true,
    desc: "Thick and creamy vanilla bean milkshake topped with whipped cream." },

  /* ===== COMBOS ===== */
  { id: 17, name: "Classic Combo",  category: "combos", price: 249, image: "burger-classic.svg", accent: "#3BB273", tag: "Value", rating: 4.9, reviews: 880, calories: 1090, prepTime: 14, stock: 30, popular: 98, featured: false, available: true,
    desc: "Classic Smash + Crispy Fries + Fizz Cola. Save ₱18 compared to ordering separately." },
  { id: 18, name: "Barkada Bundle", category: "combos", price: 799, image: "burger-double.svg",  accent: "#A66BFF", tag: "Value", rating: 4.8, reviews: 154, calories: 3600, prepTime: 20, stock: 12, popular: 75, featured: false, available: true,
    desc: "2 Classic Smash + 2 Double Stack + 2 large fries + 4 drinks. Good for 4 people." },
];

// para sa lumang code na gumagamit pa ng PRODUCTS
const PRODUCTS = DEFAULT_PRODUCTS;

/* ---------- Promo codes ---------- */
const PROMO_CODES = {
  FIRSTBITE: { type: "percent",  value: 20, minSpend: 0,   label: "20% off your first order" },
  FREESHIP:  { type: "freeship", value: 0,  minSpend: 0,   label: "Free delivery" },
  BUNVOYAGE: { type: "fixed",    value: 50, minSpend: 300, label: "₱50 off orders ₱300+" },
};

/* ---------- Product options ---------- */
const OPTIONS = {
  sizes: { Regular: 0, Large: 40, Monster: 80 },
  addons: { "Extra Cheese": 25, "Bacon": 40, "Extra Patty": 60, "Fried Egg": 20 },
  customizable: ["burgers", "chicken"],
  noSize: ["combos"],
};

/* ==========================================================
   HELPERS
   ========================================================== */

/** Tamang path ng image: root (index.html) vs /app/ vs /admin/ */
function assetPath(file) {
  const path = window.location.pathname;
  const nested = path.includes("/app/") || path.includes("/admin/");
  return (nested ? "../" : "") + "assets/images/products/" + file;
}

/** Format number → "₱1,249" */
function peso(amount) {
  return CONFIG.currency + Number(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/* ==========================================================
   MENU — read + admin write
   ========================================================== */
const Menu = {
  /** Lahat ng products, kasama ang nakatago (para sa admin) */
  raw() {
    const saved = typeof Store !== "undefined" ? Store.get("products", null) : null;
    return Array.isArray(saved) && saved.length ? saved : DEFAULT_PRODUCTS;
  },

  /** Products na nakikita ng customer */
  all() {
    return this.raw().filter((p) => p.available !== false);
  },

  /** Kahit nakatago (para sa cart, orders, admin) */
  get(id) {
    return this.raw().find((p) => p.id === Number(id)) || null;
  },

  byCategory(catId) {
    const list = this.all();
    return catId === "all" ? list : list.filter((p) => p.category === catId);
  },

  featured() {
    return this.all().filter((p) => p.featured);
  },

  category(catId) {
    return CATEGORIES.find((c) => c.id === catId) || null;
  },

  /** Live stock. Nakatagong product = 0 (hindi mabibili) */
  stock(id) {
    const product = this.get(id);
    if (!product || product.available === false) return 0;
    const saved = typeof Store !== "undefined" ? Store.get("stock", {}) : {};
    return saved[id] !== undefined ? saved[id] : product.stock;
  },

  /** Stock kahit nakatago (para sa admin table) */
  rawStock(id) {
    const product = this.get(id);
    if (!product) return 0;
    const saved = typeof Store !== "undefined" ? Store.get("stock", {}) : {};
    return saved[id] !== undefined ? saved[id] : product.stock;
  },

  isCustomizable(product) {
    return OPTIONS.customizable.includes(product.category);
  },

  hasSize(product) {
    return !OPTIONS.noSize.includes(product.category);
  },

  /* ---------- ADMIN: write ---------- */

  /** Add or update. Walang id = bagong product */
  save(product) {
    const list = [...this.raw()];
    const clean = {
      rating: 0,
      reviews: 0,
      popular: 50,
      calories: 0,
      prepTime: 10,
      featured: false,
      available: true,
      tag: null,
      ...product,
      price: Math.max(0, Number(product.price) || 0),
      stock: Math.max(0, parseInt(product.stock, 10) || 0),
    };

    if (!clean.id) {
      clean.id = list.reduce((max, p) => Math.max(max, p.id), 0) + 1;
      list.push(clean);
    } else {
      clean.id = Number(clean.id);
      const i = list.findIndex((p) => p.id === clean.id);
      if (i > -1) list[i] = { ...list[i], ...clean };
      else list.push(clean);
    }

    Store.set("products", list);
    this.setStock(clean.id, clean.stock);
    return clean;
  },

  remove(id) {
    Store.set("products", this.raw().filter((p) => p.id !== Number(id)));
    Store.update("stock", {}, (s) => {
      delete s[id];
      return s;
    });
  },

  setStock(id, qty) {
    Store.update("stock", {}, (s) => {
      s[id] = Math.max(0, parseInt(qty, 10) || 0);
      return s;
    });
  },

  setAvailable(id, available) {
    const list = this.raw().map((p) => (p.id === Number(id) ? { ...p, available: !!available } : p));
    Store.set("products", list);
  },

  /** Ibalik ang default menu at stock */
  reset() {
    Store.remove("products");
    Store.remove("stock");
  },
};  