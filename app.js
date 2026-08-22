/* ═══════════════════════════════════════════════════════════
   Multi-Platform E-commerce Pricing Calculator (TH) — app.js
   Alpine.js application: math engine, presets, charts,
   history (LocalStorage) and CSV export.
   ═══════════════════════════════════════════════════════════ */

/* ---------- Fee presets by category (Thailand, reference 2026) ----------
   Structure: category -> platform -> { commissionPct, paymentPct, servicePct } */
const CATEGORY_PRESETS = {
  fashion:    { label: "แฟชั่น",     shopee: { c: 4.0, pay: 2.0 }, tiktok: { c: 4.0, pay: 1.6 }, lazada: { c: 3.0, pay: 2.0 } },
  electronics:{ label: "อิเล็กทรอนิกส์", shopee: { c: 5.0, pay: 2.0 }, tiktok: { c: 4.5, pay: 1.6 }, lazada: { c: 4.0, pay: 2.0 } },
  health:     { label: "สุขภาพและความงาม", shopee: { c: 5.5, pay: 2.0 }, tiktok: { c: 5.0, pay: 1.6 }, lazada: { c: 4.5, pay: 2.0 } },
  fmcg:       { label: "สินค้าอุปโภคบริโภค", shopee: { c: 3.0, pay: 2.0 }, tiktok: { c: 3.0, pay: 1.6 }, lazada: { c: 2.5, pay: 2.0 } },
  other:      { label: "อื่น ๆ" },
};

/* ---------- Alpine root component ---------- */
function pricingApp() {
  return {
    mode: "single",
    toast: "",
    globalWarning: "",
    charts: {},

    /* ----- shared input form ----- */
    form: {
      sku: "",
      cost: 100,
      packaging: 10,
      targetProfit: 50,
      sellPrice: 250,
      adsPct: 0,
      voucherPct: 0,
      calcMode: "target",   // 'target' | 'evaluate'
      category: "fashion",
    },

    /* ----- platform definitions ----- */
    platforms: [
      {
        id: "shopee", name: "Shopee", short: "S", customizable: false,
        iconBgClass: "bg-orange-500",
        cardClass: "bg-gradient-to-br from-orange-500 to-orange-600",
        labelCampaign: "Shopee ฟรีค่าส่ง พิเศษ / เหรียญแคชแบ็ก",
        hasCampaign: true, campaignOn: true, campaignPct: 3.0,
        commissionPct: 4.0, paymentPct: 2.0, servicePct: 0,
        fixedFee: 1.07,          // Platform Infrastructure Fee (฿)
        enabled: true, open: false, showSetting: false,
      },
      {
        id: "tiktok", name: "TikTok Shop", short: "TT", customizable: false,
        iconBgClass: "bg-teal-600",
        cardClass: "bg-gradient-to-br from-slate-800 to-teal-900",
        labelCampaign: "TikTok Seller Campaign",
        hasCampaign: true, campaignOn: false, campaignPct: 2.0,
        commissionPct: 4.0, paymentPct: 1.6, servicePct: 0,
        fixedFee: 0,
        enabled: true, open: false, showSetting: false,
      },
      {
        id: "lazada", name: "Lazada", short: "LZ", customizable: false,
        iconBgClass: "bg-blue-600",
        cardClass: "bg-gradient-to-br from-blue-600 to-indigo-700",
        labelCampaign: "Lazada Free Shipping Max",
        hasCampaign: true, campaignOn: false, campaignPct: 2.0,
        commissionPct: 3.0, paymentPct: 2.0, servicePct: 1.0,   // servicePct = Marketplace + FSM (รวมใน preset)
        fixedFee: 0,
        enabled: true, open: false, showSetting: false,
      },
      {
        id: "custom", name: "ช่องทางอื่น (กำหนดเอง)", short: "MY", customizable: true,
        iconBgClass: "bg-purple-600",
        cardClass: "bg-gradient-to-br from-purple-600 to-slate-700",
        labelCampaign: "แคมเปญของช่องทางนี้",
        hasCampaign: true, campaignOn: false, campaignPct: 2.0,
        commissionPct: 5.0, paymentPct: 2.0, servicePct: 0,
        fixedFee: 0,
        enabled: false, open: false, showSetting: true,
      },
    ],

    history: [],
    bulkRows: [{ sku: "", cost: 0, packaging: 0, targetProfit: 0 }],

    /* ═══════════ INIT ═══════════ */
    init() {
      try { this.history = JSON.parse(localStorage.getItem("pricing_history") || "[]"); } catch { this.history = []; }
      this.applyCategoryPreset();
      // re-render charts whenever relevant state changes
      this.$watch("form", () => this.renderCharts());
      this.$watch("platforms", () => this.renderCharts());
      this.$watch("mode", () => this.$nextTick(() => { this.renderCharts(); lucide.createIcons(); }));
      this.$nextTick(() => { this.renderCharts(); lucide.createIcons(); });

      // Re-create Lucide icons whenever Alpine renders new DOM (bulk rows, history, etc.)
      new MutationObserver(() => lucide.createIcons())
        .observe(document.body, { childList: true, subtree: true });
    },

    /* Apply category preset fee rates to all platforms */
    applyCategoryPreset() {
      const preset = CATEGORY_PRESETS[this.form.category];
      if (!preset) return; // 'other' keeps manual values
      const map = { shopee: preset.shopee, tiktok: preset.tiktok, lazada: preset.lazada };
      this.platforms.forEach(p => {
        const v = map[p.id];
        if (v && !p.customizable) { p.commissionPct = v.c; p.paymentPct = v.pay; }
      });
    },

    /* ═══════════ CORE MATH ENGINE ═══════════
       Target mode:  price = (cost + packaging + targetProfit + fixedFees) / (1 - totalFee%)
       Evaluate mode: profit = price*(1 - fee%) - fixedFees - cost - packaging */
    totalFeePct(p) {
      return (p.commissionPct + p.paymentPct + p.servicePct +
              (p.campaignOn ? p.campaignPct : 0) +
              +this.form.adsPct + +this.form.voucherPct) / 100;
    },

    calc(p, cost, packaging, opts) {
      const fixed = +p.fixedFee || 0;
      const feePct = this.totalFeePct(p);
      const warning = "";

      if (feePct >= 1) {
        return { error: true, warning: "ค่าธรรมเนียมรวม ≥ 100% ของราคาขาย — ไม่สามารถคำนวณได้ (หารด้วยศูนย์)", price: 0, profit: 0, marginPct: 0, commissionFee: 0, paymentFee: 0, serviceFee: 0, campaignFee: 0, adsFee: 0, totalCost: 0 };
      }

      let price;
      if (opts.mode === "target") {
        price = (cost + packaging + opts.targetProfit + fixed) / (1 - feePct);
      } else {
        price = opts.sellPrice;
      }

      const commissionFee = price * p.commissionPct / 100;
      const paymentFee    = price * p.paymentPct / 100;
      const serviceFee    = price * p.servicePct / 100;
      const campaignFee   = p.campaignOn ? price * p.campaignPct / 100 : 0;
      const adsFee        = price * ((+this.form.adsPct + +this.form.voucherPct) / 100);
      const profit        = price - (commissionFee + paymentFee + serviceFee + campaignFee + adsFee) - fixed - cost - packaging;
      const marginPct     = price > 0 ? (profit / price) * 100 : 0;

      let warn = "";
      if (opts.mode === "target" && opts.targetProfit <= 0 && profit < 0) warn = "กำไรเป้าหมายติดลบ — โปรดตรวจสอบต้นทุน";
      if (opts.mode === "evaluate" && profit < 0) warn = "⚠️ ขายที่ราคานี้จะขาดทุน ฿" + this.fmt(Math.abs(profit)) + " ต่อชิ้น";
      if (price > 0 && price < cost + packaging) warn = warn || "⚠️ ราคาขายต่ำกว่าต้นทุนสินค้าและบรรจุภัณฑ์";

      return {
        error: false, warning: warn, price, profit, marginPct,
        commissionFee, paymentFee, serviceFee, campaignFee, adsFee,
        totalCost: price - profit,
      };
    },

    /* Single-mode result for a platform card */
    result(p) {
      return this.calc(p, +this.form.cost, +this.form.packaging, {
        mode: this.form.calcMode,
        targetProfit: +this.form.targetProfit,
        sellPrice: +this.form.sellPrice,
      });
    },

    /* Bulk-row result */
    bulkRowResult(row, p) {
      return this.calc(p, +row.cost, +row.packaging, {
        mode: "target", targetProfit: +row.targetProfit, sellPrice: 0,
      });
    },

    /* ═══════════ CHARTS ═══════════ */
    renderCharts() {
      this.platforms.forEach(p => {
        const el = document.getElementById("chart-" + p.id);
        if (!el || !p.enabled) return;
        const r = this.result(p);
        const feeTotal = (r.error ? 0 : r.commissionFee + r.paymentFee + r.serviceFee + r.campaignFee + r.adsFee + (+p.fixedFee || 0));
        const profit = Math.max(0, r.error ? 0 : r.profit);
        const data = [+this.form.cost + +this.form.packaging, feeTotal, profit];

        if (this.charts[p.id]) { this.charts[p.id].data = { datasets: [{ data }] }; this.charts[p.id].update(); return; }
        this.charts[p.id] = new Chart(el, {
          type: "doughnut",
          data: {
            labels: ["ต้นทุนสินค้า", "ค่าธรรมเนียมแพลตฟอร์ม", "กำไรสุทธิ"],
            datasets: [{ data, backgroundColor: ["#f59e0b", "#64748b", "#10b981"], borderWidth: 2, borderColor: "#fff" }],
          },
          options: {
            responsive: true, cutout: "62%",
            plugins: {
              legend: { position: "bottom", labels: { font: { family: "Kanit", size: 11 }, boxWidth: 12, padding: 10 } },
              tooltip: {
                callbacks: { label: (ctx) => ctx.label + ": ฿" + this.fmt(ctx.parsed) }
              },
            },
          },
        });
      });
    },

    /* ═══════════ ACTIONS ═══════════ */
    saveHistory() {
      const best = this.platforms.filter(p => p.enabled).map(p => ({ p, r: this.result(p) })).filter(x => !x.r.error);
      if (!best.length) { this.showToast("กรุณาเปิดอย่างน้อย 1 ช่องทางที่คำนวณได้"); return; }
      const now = new Date();
      best.forEach(({ p, r }) => {
        this.history.unshift({
          date: now.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" }) + " " + now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
          sku: this.form.sku, price: r.price, profit: r.profit, platform: p.name,
        });
      });
      localStorage.setItem("pricing_history", JSON.stringify(this.history.slice(0, 100)));
      this.showToast("บันทึกลงประวัติเรียบร้อยแล้ว");
    },

    clearHistory() { this.history = []; localStorage.removeItem("pricing_history"); },

    exportSingleCSV() {
      const head = ["ชื่อสินค้า", "ช่องทาง", "โหมด", "ต้นทุน", "บรรจุภัณฑ์", "ราคาขาย", "กำไรสุทธิ", "กำไร(%)", "คอมฯ", "ชำระเงิน", "ค่าบริการ", "แคมเปญ", "โฆษณา/วอลเชอร์", "ค่าธรรมเนียม(฿)"];
      const rows = this.platforms.filter(p => p.enabled).map(p => {
        const r = this.result(p);
        return [this.form.sku, p.name, this.form.calcMode === "target" ? "หาราคาขาย" : "ดูกำไร",
          this.form.cost, this.form.packaging, r.error ? "-" : r.price.toFixed(2), r.error ? "-" : r.profit.toFixed(2), r.error ? "-" : r.marginPct.toFixed(2),
          r.commissionFee.toFixed(2), r.paymentFee.toFixed(2), r.serviceFee.toFixed(2), r.campaignFee.toFixed(2), r.adsFee.toFixed(2), (+p.fixedFee || 0).toFixed(2)];
      });
      this.downloadCSV(head, rows, "pricing_single.csv");
    },

    exportBulkCSV() {
      const active = this.platforms.filter(p => p.enabled);
      const head = ["SKU", "ต้นทุน", "บรรจุภัณฑ์", "กำไรเป้าหมาย", ...active.map(p => p.name + " ราคาขาย"), ...active.map(p => p.name + " กำไร(%)")];
      const rows = this.bulkRows.map(row => {
        const prices = active.map(p => { const r = this.bulkRowResult(row, p); return r.error ? "-" : r.price.toFixed(2); });
        const margins = active.map(p => { const r = this.bulkRowResult(row, p); return r.error ? "-" : r.marginPct.toFixed(2); });
        return [row.sku, row.cost, row.packaging, row.targetProfit, ...prices, ...margins];
      });
      this.downloadCSV(head, rows, "pricing_bulk.csv");
    },

    downloadCSV(head, rows, filename) {
      const esc = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
      const csv = "\uFEFF" + [head, ...rows].map(r => r.map(esc).join(",")).join("\r\n"); // BOM for Thai in Excel
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = filename; a.click();
      URL.revokeObjectURL(a.href);
      this.showToast("ดาวน์โหลด " + filename + " แล้ว");
    },

    async shareCalc() {
      const best = this.platforms.filter(p => p.enabled && !this.result(p).error)
        .map(p => `${p.name}: ราคา ฿${this.fmt(this.result(p).price)} กำไร ฿${this.fmt(this.result(p).profit)}`)
        .join("\n");
      const text = `📊 การคำนวณราคาขาย${this.form.sku ? " — " + this.form.sku : ""}\n` + best;
      if (navigator.share) {
        try { await navigator.share({ title: "การคำนวณราคาขาย", text }); } catch { /* user cancelled */ }
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        this.showToast("คัดลอกข้อความแชร์แล้ว");
      }
    },

    addBulkRow() { this.bulkRows.push({ sku: "", cost: 0, packaging: 0, targetProfit: 0 }); },

    /* ---------- utils ---------- */
    fmt(n) { return (Math.round((+n || 0) * 100) / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
    showToast(msg) {
      this.toast = msg;
      clearTimeout(this._tt);
      this._tt = setTimeout(() => this.toast = "", 2500);
    },
  };
}

/* Refresh lucide icons on every Alpine update (cheap enough for this app) */
document.addEventListener("alpine:initialized", () => lucide.createIcons());
