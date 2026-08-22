
/* ═══════════════════════════════════════════════════════════
   Multi-Platform Pricing Calculator — Frontend Logic (Vanilla JS)
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════
   Preset ค่าธรรมเนียม Shopee (ปรับปรุงตามนโยบายลงวันที่ 4 สิงหาคม 2026)
   ค่าคอมมิชชัน (รวม VAT 7% แล้ว) แยกตามหมวดหมู่ × ประเภทร้านค้า:
     nonmall       = ร้านค้าทั่วไป (7.49% – 17.12%)
     nonmall_small = ร้านค้าทั่วไป ผู้ขายรายเล็ก (6.96% – 15.52%)
     mall          = Shopee Mall (7.49% – 19.26%)
     mall_small    = Shopee Mall ผู้ขายรายเล็ก (6.96% – 17.66%)
   ค่าธรรมเนียมชำระเงิน: ปกติ 3.21% | SPayLater 4.28% – 7.49%
   ค่าบริการโปรแกรมส่งฟรี/แคชแบ็ก: 3.21% – 5.35% (0% ถ้าไม่เข้าร่วม)
   ค่าธรรมเนียมโครงสร้างพื้นฐาน: 1.07 บาท/ออเดอร์ (1 บาท + VAT 7%)
   ═══════════════════════════════════════════════════════════════════ */
const SHOPEE_COMM_PRESETS = {
  fashion:     { nonmall: 17.12, nonmall_small: 15.52, mall: 19.26, mall_small: 17.66 },
  electronics: { nonmall: 16.05, nonmall_small: 14.52, mall: 18.08, mall_small: 16.58 },
  health:      { nonmall: 14.98, nonmall_small: 13.90, mall: 17.12, mall_small: 16.05 },
  fmcg:        { nonmall: 7.49,  nonmall_small: 6.96,  mall: 8.56,  mall_small: 7.49  }
};

/* ค่าธรรมเนียมชำระเงิน Shopee ตามวิธีการชำระ */
const SHOPEE_PAY_METHODS = [
  { id: 'normal',    label: 'ชำระปกติ (QR / บัตร / ShopeePay)', pct: 3.21 },
  { id: 'spl_4',     label: 'SPayLater ผ่อน 3–4 เดือน',          pct: 4.28 },
  { id: 'spl_6',     label: 'SPayLater ผ่อน 6 เดือน',            pct: 5.35 },
  { id: 'spl_10',    label: 'SPayLater ผ่อน 9–10 เดือน',         pct: 6.42 },
  { id: 'spl_12',    label: 'SPayLater ผ่อน 12 เดือน',           pct: 7.49 }
];

/* Preset ของ TikTok Shop (รวม VAT 7% แล้ว)
   Commission: Mall 5.35% – 11.77% | Non-Mall 6.42% – 10.70%
   Commerce Growth Fee (บังคับ): อิเล็กทรอนิกส์ 6.96% (รายเล็ก 6.42%) |
                                  หมวดอื่น 8.03% (รายเล็ก 7.49%) — เพดานหัก ≤ 199 บาท/ชิ้น
   Transaction Fee: 3.21% | ค่าธรรมเนียมคงที่: 1.07 บาท/ออเดอร์ */
const TIKTOK_COMM_PRESETS = {
  fashion:     { nonmall: 10.70, mall: 11.77 },
  electronics: { nonmall: 6.42,  mall: 5.35  },
  health:      { nonmall: 8.56,  mall: 9.63  },
  fmcg:        { nonmall: 7.49,  mall: 6.42  }
};
const TIKTOK_GROWTH = {
  electronics: { normal: 6.96, small: 6.42 },
  other:       { normal: 8.03, small: 7.49 }
};
const TIKTOK_GROWTH_CAP = 199; // เพดานหักต่อชิ้น (บาท)

/* Preset ของ Lazada (รวม VAT 7% แล้ว)
   Commission: LazMall 5.35% – 10.70% | Non-Mall 4.28% – 7.49%
   Payment Fee: 3.21% | Free Shipping Max/Cashback: 3.21% – 5.35% (ถ้าเข้าร่วม)
   ค่าธรรมเนียมคงที่: 1.07 บาท/ออเดอร์ */
const LAZADA_COMM_PRESETS = {
  fashion:     { nonmall: 7.49, mall: 10.70 },
  electronics: { nonmall: 4.28, mall: 5.35  },
  health:      { nonmall: 6.42, mall: 8.56  },
  fmcg:        { nonmall: 5.35, mall: 7.49  }
};

/* ---------- นิยามแพลตฟอร์ม ---------- */
const PLATFORMS = [
  {
    id: 'shopee', name: 'Shopee', cls: 'pc-shopee', enabled: true,
    campaignLabel: 'Shopee ส่งฟรีพิเศษ / เหรียญแคชแบ็ก',
    campaignOn: true, campaignPct: 5.35,
    commissionPct: 16.05, paymentPct: 3.21, servicePct: 0, infraFee: 1.07,
    custom: false, showFees: false, open: false
  },
  {
    id: 'tiktok', name: 'TikTok Shop', cls: 'pc-tiktok', enabled: true,
    campaignLabel: 'TikTok Seller Campaign',
    hasCampaign: false, campaignOn: false, campaignPct: 2.0,
    commissionPct: 6.42, paymentPct: 3.21, servicePct: 0, infraFee: 1.07,
    growthPct: 6.96, growthCap: TIKTOK_GROWTH_CAP,   // Commerce Growth Fee (บังคับ, เพดาน ≤199฿)
    custom: false, showFees: false, open: false
  },
  {
    id: 'lazada', name: 'Lazada', cls: 'pc-lazada', enabled: true,
    campaignLabel: 'Lazada Free Shipping Max / Cashback',
    hasCampaign: true, campaignOn: false, campaignPct: 5.35,
    commissionPct: 4.28, paymentPct: 3.21, servicePct: 0, infraFee: 1.07,
    custom: false, showFees: false, open: false
  },
  {
    id: 'custom', name: 'ช่องทางของฉัน', cls: 'pc-custom', enabled: false,
    campaignLabel: 'แคมเปญของช่องทางนี้',
    campaignOn: false, campaignPct: 2.0,
    commissionPct: 5.0, paymentPct: 2.0, servicePct: 0, infraFee: 0,
    custom: true, showFees: true, open: false
  }
];

const charts = {};
let bulkRows = [];

/* ═══════════════════════════════════════════════════════════
   Tip Jar / Donation — ใช้ฟรีทั้งหมด หารายได้จากการสนับสนุน
   แก้ค่าด้านล่างนี้เป็นข้อมูลจริงของคุณได้เลย
   ═══════════════════════════════════════════════════════════ */
const DONATE = {
  message: 'เครื่องมือนี้ใช้ฟรีไม่มีเงื่อนไข ถ้าช่วยประหยัดเวลา/เงินให้คุณบ้าง<br>เลี้ยงกาแฟเจ้าของเว็บสักแก้วกำลังใจได้เลยครับ ☕',
  promptPayName: 'ชื่อเจ้าของบัญชี PromptPay',
  promptPayId: '0812345678',                                  // เบอร์/เลขบัตรประชาชน ที่ใช้รับ PromptPay
  promptPayQr: 'https://lh3.googleusercontent.com/d/YOUR_QR_IMAGE_ID', // ใส่ลิงก์รูป QR PromptPay (สร้างได้ที่เว็บธนาคารหรือคิวอาร์ PromptPay)
  trueMoney: '0812345678',                                    // เบอร์ TrueMoney Wallet
  bank: { name: 'ธนาคารกสิกรไทย (KBank)', account: '123-4-56789-0', holder: 'ชื่อ-นามสกุล' },
  links: {
    kofi: '',        // เช่น https://buymeacoffee.com/yourname
    paypal: ''       // เช่น https://paypal.me/yourname
  }
};

function copyText(text, label) {
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
    .then(() => Swal.fire({ icon: 'success', title: 'คัดลอกแล้ว', text: label + ': ' + text, timer: 1500, showConfirmButton: false }))
    .catch(() => Swal.fire({ icon: 'info', title: label, text: text, confirmButtonColor: '#EE4D2D' }));
}

function openDonateModal() {
  const links = [
    DONATE.links.kofi ? `<a class="btn btn-sm btn-donate rounded-pill me-2 mb-2" href="${DONATE.links.kofi}" target="_blank" rel="noopener"><i class="bi bi-cup-hot-fill me-1"></i>Buy Me a Coffee</a>` : '',
    DONATE.links.paypal ? `<a class="btn btn-sm btn-outline-light rounded-pill mb-2" href="${DONATE.links.paypal}" target="_blank" rel="noopener"><i class="bi bi-paypal me-1"></i>PayPal</a>` : ''
  ].join('');
  Swal.fire({
    title: '<i class="bi bi-heart-fill" style="color:#f59e0b"></i> สนับสนุนเครื่องมือฟรีนี้',
    html: `
      <div style="text-align:left;font-size:.92rem;line-height:1.7">
        <p style="margin-bottom:.9rem">${DONATE.message}</p>
        <div style="text-align:center;margin-bottom:1rem">
          <img src="${DONATE.promptPayQr}" alt="PromptPay QR" style="width:200px;border-radius:12px;background:#fff;padding:8px" onerror="this.style.display='none'">
          <div style="margin-top:.4rem;color:#fbbf24">สแกนจ่ายผ่านแอปธนาคาร / TrueMoney</div>
        </div>
        <div class="donate-method"><i class="bi bi-qr-code"></i>
          <div class="flex-grow-1 text-start"><b>PromptPay</b> — ${DONATE.promptPayName}<div class="text-secondary small">${DONATE.promptPayId}</div></div>
          <button class="btn btn-sm btn-outline-light" onclick="copyText('${DONATE.promptPayId}','PromptPay')">คัดลอก</button>
        </div>
        <div class="donate-method"><i class="bi bi-wallet2"></i>
          <div class="flex-grow-1 text-start"><b>${DONATE.bank.name}</b><div class="text-secondary small">${DONATE.bank.account} · ${DONATE.bank.holder}</div></div>
          <button class="btn btn-sm btn-outline-light" onclick="copyText('${DONATE.bank.account}','เลขบัญชี')">คัดลอก</button>
        </div>
        <div class="donate-method"><i class="bi bi-phone"></i>
          <div class="flex-grow-1 text-start"><b>TrueMoney Wallet</b><div class="text-secondary small">${DONATE.trueMoney}</div></div>
          <button class="btn btn-sm btn-outline-light" onclick="copyText('${DONATE.trueMoney}','TrueMoney')">คัดลอก</button>
        </div>
        ${links ? `<div class="mt-3">${links}</div>` : ''}
      </div>`,
    confirmButtonText: 'ปิด',
    confirmButtonColor: '#EE4D2D',
    width: 480
  });
}

/* ---------- Utils ---------- */
const fmt = n => (Math.round((+n || 0) * 100) / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const $id = id => document.getElementById(id);

/* ---------- อ่านค่าจากฟอร์ม ---------- */
function readForm() {
  return {
    productName: $id('productName').value.trim(),
    productCost: num($id('productCost').value),
    packCost: num($id('packCost').value),
    targetProfit: num($id('targetProfit').value),
    sellPrice: num($id('sellPrice').value),
    adsFee: num($id('adsFee').value),
    voucherFee: num($id('voucherFee').value),
    calcMode: document.querySelector('input[name="calcMode"]:checked').value,
    category: $id('categoryPreset').value
  };
}

/* ═══════════ CORE MATH ENGINE ═══════════
   Evaluate:  profit = price − ค่าธรรมเนียมทั้งหมด(ที่ราคานี้) − ต้นทุน
   Target:    หาราคาที่ทำให้กำไร = เป้าหมาย
              (TikTok Growth Fee มีเพดานหัก ≤ 199฿ ทำให้ค่าธรรมเนียมไม่เป็นเชิงเส้น
               จึงแก้สมการด้วย bisection แทนสูตรย้อนกลับตรง ๆ)        */

/* คำนวณค่าธรรมเนียมแต่ละรายการ ณ ราคาขาย "price" */
function platformFees(p, price, form) {
  const commissionFee = price * p.commissionPct / 100;
  const paymentFee    = price * p.paymentPct / 100;
  const serviceFee    = price * p.servicePct / 100;
  const campaignFee   = p.campaignOn ? price * p.campaignPct / 100 : 0;
  const growthFee     = p.growthPct ? Math.min(price * p.growthPct / 100, p.growthCap || Infinity) : 0;
  const adsFeeBaht    = price * ((form.adsFee + form.voucherFee) / 100);
  return { commissionFee, paymentFee, serviceFee, campaignFee, growthFee, adsFeeBaht };
}

function calcPlatform(p, form) {
  const totalCost = form.productCost + form.packCost;
  const pctSum = p.commissionPct + p.paymentPct + p.servicePct +
                 (p.campaignOn ? p.campaignPct : 0) + form.adsFee + form.voucherFee;
  const feeDecimal = pctSum / 100;
  const totalFeePercent = pctSum + (p.growthPct || 0);

  /* ส่วนเชิงเส้น (ไม่มีเพดาน) ต้องต่ำกว่า 100% จึงจะคำนวณได้ */
  if (feeDecimal >= 1) {
    return { error: true, warning: 'ค่าธรรมเนียมรวม (ส่วนที่ไม่มีเพดาน) ≥ 100% — ไม่สามารถคำนวณได้', price: 0, profit: 0, marginPercent: 0,
             commissionFee: 0, paymentFee: 0, serviceFee: 0, campaignFee: 0, growthFee: 0, adsFeeBaht: 0, totalFeePercent, totalDeduction: 0, totalCost: 0 };
  }

  let price;
  if (form.calcMode === 'target') {
    /* กำไรขากลับที่ราคา p: g(p) = p − fees(p) − infra − totalCost  (เพิ่มขึ้นตามราคาเสมอ) */
    const g = pr => {
      const f = platformFees(p, pr, form);
      return pr - (f.commissionFee + f.paymentFee + f.serviceFee + f.campaignFee + f.growthFee + f.adsFeeBaht) - p.infraFee - totalCost;
    };
    /* ค่าตั้งต้นจากสูตรเชิงเส้น (แม่นยำเมื่อไม่มี growth fee) */
    let lo = 0, hi = (totalCost + form.targetProfit + p.infraFee) / (1 - feeDecimal);
    if (g(hi) < form.targetProfit) {
      /* ยังไม่ถึงเป้า → ขยายขอบบนจนกว่าจะเกินเป้า (สูงสุด 60 รอบ กันลูปไม่รู้จบ) */
      let ok = false;
      for (let i = 0; i < 60 && hi < 1e9; i++) { hi *= 1.5; if (g(hi) >= form.targetProfit) { ok = true; break; } }
      if (!ok) return { error: true, warning: 'ไม่พบราคาขายที่ทำให้ได้กำไรตามเป้าหมาย', price: 0, profit: 0, marginPercent: 0,
        commissionFee: 0, paymentFee: 0, serviceFee: 0, campaignFee: 0, growthFee: 0, adsFeeBaht: 0, totalFeePercent, totalDeduction: 0, totalCost };
    }
    /* bisection 50 รอบ → แม่นยำระดับสตาง */
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      (g(mid) < form.targetProfit) ? lo = mid : hi = mid;
    }
    price = (lo + hi) / 2;
  } else {
    price = form.sellPrice;
  }

  const f = platformFees(p, price, form);
  const totalDeduction = f.commissionFee + f.paymentFee + f.serviceFee + f.campaignFee + f.growthFee + f.adsFeeBaht + p.infraFee;
  const profit = price - totalDeduction - totalCost;
  const marginPercent = price > 0 ? (profit / price) * 100 : 0;

  let warning = '';
  if (form.calcMode === 'evaluate' && profit < 0) warning = '⚠️ ขายที่ราคานี้จะขาดทุน ฿' + fmt(Math.abs(profit)) + ' ต่อชิ้น';
  if (!warning && price > 0 && price < totalCost) warning = '⚠️ ราคาขายต่ำกว่าต้นทุนสินค้า+บรรจุภัณฑ์';

  return { error: false, warning, price, profit, marginPercent,
           commissionFee: f.commissionFee, paymentFee: f.paymentFee, serviceFee: f.serviceFee,
           campaignFee: f.campaignFee, growthFee: f.growthFee, adsFeeBaht: f.adsFeeBaht,
           totalDeduction, totalFeePercent, totalCost };
}

/* ---------- Render: การ์ดแพลตฟอร์ม ---------- */
function renderPlatforms() {
  const form = readForm();
  const grid = $id('platformGrid');
  grid.innerHTML = PLATFORMS.map(p => {
    const r = calcPlatform(p, form);
    const feeTotal = r.error ? 0 : r.totalDeduction;
    const profitPart = r.error || r.profit < 0 ? 0 : r.profit;

    const headline = form.calcMode === 'target'
      ? `<span class="d-block small opacity-75 mb-1">ราคาขายที่แนะนำ</span>
         <span class="price-big">฿${fmt(r.price)}</span>
         <span class="d-block small opacity-75 mt-1">รวมกำไรเป้าหมาย ฿${fmt(form.targetProfit)}/ชิ้น</span>`
      : `<span class="d-block small opacity-75 mb-1">กำไรสุทธิ ณ ราคานี้</span>
         <span class="price-big ${r.profit < 0 ? 'text-warning' : ''}">฿${fmt(r.profit)}</span>
         <span class="d-block small opacity-75 mt-1">อัตรากำไร ${fmt(r.marginPercent)}%</span>`;

    const feeEditor = p.showFees ? `
      <div class="rounded-3 p-2 mb-2" style="background:rgba(0,0,0,.25)">
        ${p.custom ? `
        <input type="text" class="form-control form-control-sm mb-2" id="custName-${p.id}"
               value="${p.name.replace(/"/g, '&quot;')}" placeholder="ชื่อช่องทาง เช่น LINE SHOPPING" oninput="renamePlatform('${p.id}', this.value)">` : `
        <div class="small opacity-75 mb-2">แก้ไขอัตรา % ตรง ๆ (การเปลี่ยนหมวดหมู่/ประเภทร้านจะเขียนทับค่าเหล่านี้)</div>`}
        <div class="row g-2">
          <div class="col-4"><label class="form-label small mb-0 opacity-75">คอมฯ %</label>
            <input type="number" step="0.01" class="form-control form-control-sm" value="${p.commissionPct}" onchange="setPlatformFee('${p.id}','commissionPct',this.value)"></div>
          <div class="col-4"><label class="form-label small mb-0 opacity-75">ชำระเงิน %</label>
            <input type="number" step="0.01" class="form-control form-control-sm" value="${p.paymentPct}" onchange="setPlatformFee('${p.id}','paymentPct',this.value)"></div>
          <div class="col-4"><label class="form-label small mb-0 opacity-75">ค่าธรรมเนียม ฿</label>
            <input type="number" step="0.01" class="form-control form-control-sm" value="${p.infraFee}" onchange="setPlatformFee('${p.id}','infraFee',this.value)"></div>
        </div>
      </div>` : '';

    return `
    <div class="col-md-6">
      <div class="platform-card ${p.cls} ${p.enabled ? '' : 'disabled'} h-100 d-flex flex-column">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>
            <h5 class="mb-0 fw-semibold">${p.name}</h5>
            <div class="form-check form-switch mt-2">
              <input class="form-check-input" type="checkbox" role="switch" id="en-${p.id}" ${p.enabled ? 'checked' : ''}
                     onchange="togglePlatform('${p.id}', this.checked)">
              <label class="form-check-label small opacity-75" for="en-${p.id}">เปิดเปรียบเทียบช่องทางนี้</label>
            </div>
          </div>
          <button class="btn btn-sm btn-outline-light border-0" title="แก้ไขค่าธรรมเนียม" onclick="toggleFeePanel('${p.id}')"><i class="bi bi-gear"></i></button>
        </div>

        ${p.enabled ? `
        ${feeEditor}
        <div class="result-box p-3 text-center mb-2">${headline}</div>

        ${r.warning ? `<div class="small rounded-2 px-3 py-2 mb-2" style="background:rgba(220,38,38,.25)">${r.warning}</div>` : ''}

        <div class="mt-auto">
          <button class="btn btn-sm btn-link text-white text-decoration-none p-0" onclick="toggleBreakdown('${p.id}')">
            <i class="bi bi-receipt me-1"></i>รายละเอียดการหักค่าธรรมเนียม
            <i class="bi bi-chevron-down ms-1" id="chev-${p.id}" style="transition:transform .2s"></i>
          </button>
          <div id="bd-${p.id}" class="mt-2 rounded-3 p-2 d-none" style="background:rgba(0,0,0,.22)">
            <div class="breakdown-item"><span>ค่าคอมมิชชัน (${p.commissionPct}%)</span><span>-฿${fmt(r.commissionFee)}</span></div>
            <div class="breakdown-item"><span>ค่าธรรมเนียมชำระเงิน (${p.paymentPct}%)</span><span>-฿${fmt(r.paymentFee)}</span></div>
            ${p.servicePct > 0 ? `<div class="breakdown-item"><span>ค่าบริการอื่น (${p.servicePct}%)</span><span>-฿${fmt(r.serviceFee)}</span></div>` : ''}
            ${p.campaignOn ? `<div class="breakdown-item"><span>แคมเปญ (${p.campaignPct}%)</span><span>-฿${fmt(r.campaignFee)}</span></div>` : ''}
            ${p.growthPct ? `<div class="breakdown-item"><span>ค่าธรรมเนียมสนับสนุนการเติบโต (${p.growthPct}% ไม่เกิน ฿${p.growthCap})</span><span>-฿${fmt(r.growthFee)}</span></div>` : ''}
            <div class="breakdown-item"><span>Ads + วอลเชอร์ (${form.adsFee + form.voucherFee}%)</span><span>-฿${fmt(r.adsFeeBaht)}</span></div>
            ${p.infraFee > 0 ? `<div class="breakdown-item"><span>ค่าธรรมเนียมโครงสร้างพื้นฐาน</span><span>-฿${fmt(p.infraFee)}</span></div>` : ''}
            <div class="breakdown-item"><span>ต้นทุนสินค้า + บรรจุภัณฑ์</span><span>-฿${fmt(r.totalCost)}</span></div>
            <div class="breakdown-item breakdown-total"><span>รวม % ค่าธรรมเนียม</span><span>${fmt(r.totalFeePercent)}%</span></div>
            <div class="breakdown-item breakdown-total"><span>กำไรสุทธิ</span><span>฿${fmt(r.profit)}</span></div>
          </div>
        </div>` : ''}
      </div>
    </div>`;
  }).join('');

  renderCharts();
}

/* ---------- Charts ---------- */
function renderCharts() {
  const form = readForm();
  PLATFORMS.forEach(p => {
    const el = $id('chart-' + p.id);
    if (!el) return;
    const r = calcPlatform(p, form);
    const data = [form.productCost + form.packCost,
                  r.error ? 0 : r.totalDeduction,
                  r.error || r.profit < 0 ? 0 : r.profit];
    if (charts[p.id]) { charts[p.id].data.datasets[0].data = data; charts[p.id].update(); }
    else charts[p.id] = new Chart(el, {
      type: 'doughnut',
      data: {
        labels: ['ต้นทุนสินค้า', 'ค่าธรรมเนียมแพลตฟอร์ม', 'กำไรสุทธิ'],
        datasets: [{ data, backgroundColor: ['#f59e0b', '#94a3b8', '#10b981'], borderWidth: 2, borderColor: 'rgba(0,0,0,.35)' }]
      },
      options: {
        responsive: true, cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'Kanit', size: 11 }, color: 'rgba(255,255,255,.85)', boxWidth: 12, padding: 8 } },
          tooltip: { callbacks: { label: ctx => ctx.label + ': ฿' + fmt(ctx.parsed) } }
        }
      }
    });
  });
}

/* ---------- แคมเปญ toggles ---------- */
function renderCampaigns() {
  $id('campaignList').innerHTML = PLATFORMS.map(p => {
    /* TikTok: Commerce Growth Fee เป็นค่าธรรมเนียมบังคับ (ไม่มีสวิตช์ปิด) */
    if (p.hasCampaign === false) {
      return `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <div>
          <div class="small">${p.name} — ค่าธรรมเนียมสนับสนุนการเติบโต (บังคับ)</div>
          <div class="text-secondary" style="font-size:.78rem">${p.growthPct}% ของราคาขาย (เพดานหักไม่เกิน ฿${p.growthCap}/ชิ้น)</div>
        </div>
        <span class="badge text-bg-secondary">หักทุกออเดอร์</span>
      </div>`;
    }
    /* Shopee / Lazada: เลือกเปิด-ปิด + เลือกระดับ % ได้ (3.21% – 5.35%) */
    const pctCtrl = `
      <select class="form-select form-select-sm mt-1" style="max-width:150px" onchange="setCampaignPct('${p.id}', this.value)">
        ${[3.21, 4.28, 5.35].map(v => `<option value="${v}" ${p.campaignPct === v ? 'selected' : ''}>${v}%</option>`).join('')}
      </select>`;
    return `
    <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
      <div>
        <div class="small">${p.campaignLabel}</div>
        ${pctCtrl}
      </div>
      <div class="form-check form-switch ms-2">
        <input class="form-check-input" type="checkbox" role="switch" id="camp-${p.id}" ${p.campaignOn ? 'checked' : ''}
               onchange="toggleCampaign('${p.id}', this.checked)">
      </div>
    </div>`;
  }).join('');
}
function setCampaignPct(id, val) {
  PLATFORMS.find(x => x.id === id).campaignPct = num(val); renderPlatforms();
}

/* ---------- Interactions ---------- */
function togglePlatform(id, on) {
  const p = PLATFORMS.find(x => x.id === id);
  p.enabled = on; renderPlatforms();
}
function toggleCampaign(id, on) {
  PLATFORMS.find(x => x.id === id).campaignOn = on; renderPlatforms();
}
function setPlatformFee(id, key, val) {
  PLATFORMS.find(x => x.id === id)[key] = num(val); renderPlatforms();
}
function renamePlatform(id, val) { PLATFORMS.find(x => x.id === id).name = val || 'ช่องทางของฉัน'; }
function toggleFeePanel(id) {
  const p = PLATFORMS.find(x => x.id === id);
  p.showFees = !p.showFees; renderPlatforms();
}
function toggleBreakdown(id) {
  const bd = $id('bd-' + id), chev = $id('chev-' + id);
  bd.classList.toggle('d-none');
  chev.style.transform = bd.classList.contains('d-none') ? '' : 'rotate(180deg)';
}
function applyPreset() {
  const cat = $id('categoryPreset').value;
  const sellerType = $id('sellerType').value;           // nonmall | nonmall_small | mall | mall_small
  const isSmall = sellerType.endsWith('_small');
  const isMall = sellerType.startsWith('mall');

  const shopee = PLATFORMS.find(p => p.id === 'shopee');
  const tiktok = PLATFORMS.find(p => p.id === 'tiktok');
  const lazada = PLATFORMS.find(p => p.id === 'lazada');

  /* Shopee: คอมมิชชันตาม หมวด × ประเภทร้าน (นโยบาย 4 ส.ค. 2026) */
  const shopeePreset = SHOPEE_COMM_PRESETS[cat];
  if (shopeePreset) shopee.commissionPct = shopeePreset[sellerType];

  /* TikTok: คอมมิชชันแยก Mall/Non-Mall + Commerce Growth Fee แยกรายเล็ก */
  const ttPreset = TIKTOK_COMM_PRESETS[cat];
  if (ttPreset) {
    tiktok.commissionPct = isMall ? ttPreset.mall : ttPreset.nonmall;
    const growth = cat === 'electronics' ? TIKTOK_GROWTH.electronics : TIKTOK_GROWTH.other;
    tiktok.growthPct = isSmall ? growth.small : growth.normal;
  }

  /* Lazada: คอมมิชชันแยก LazMall / ร้านทั่วไป */
  const lzPreset = LAZADA_COMM_PRESETS[cat];
  if (lzPreset) lazada.commissionPct = isMall ? lzPreset.mall : lzPreset.nonmall;

  /* ค่าธรรมเนียมชำระเงิน: TikTok / Lazada = 3.21% | Shopee ตามวิธีชำระที่เลือก */
  tiktok.paymentPct = 3.21;
  lazada.paymentPct = 3.21;
  const payMethod = SHOPEE_PAY_METHODS.find(m => m.id === $id('shopeePayMethod').value) || SHOPEE_PAY_METHODS[0];
  shopee.paymentPct = payMethod.pct;

  renderPlatforms();
}
function applyShopeePayMethod() {
  const shopee = PLATFORMS.find(p => p.id === 'shopee');
  const payMethod = SHOPEE_PAY_METHODS.find(m => m.id === $id('shopeePayMethod').value) || SHOPEE_PAY_METHODS[0];
  shopee.paymentPct = payMethod.pct;
  renderPlatforms();
}

/* ---------- โหมดคำนวณ (target/evaluate) ---------- */
document.querySelectorAll('input[name="calcMode"]').forEach(r => {
  r.addEventListener('change', () => {
    const target = $id('modeTarget').checked;
    $id('targetProfitBox').classList.toggle('d-none', !target);
    $id('sellPriceBox').classList.toggle('d-none', target);
    renderPlatforms();
  });
});

/* ---------- Global warning ---------- */
function updateGlobalWarning() {
  const form = readForm();
  const pctSum = PLATFORMS.filter(p => p.enabled).map(p =>
    p.commissionPct + p.paymentPct + p.servicePct + (p.campaignOn ? p.campaignPct : 0) + form.adsFee + form.voucherFee);
  const box = $id('globalWarning');
  if (pctSum.some(v => v >= 100)) {
    $id('globalWarningText').textContent = 'ค่าธรรมเนียมรวมของบางแพลตฟอร์ม ≥ 100% ของราคาขาย — ไม่สามารถคำนวณราคาได้ กรุณาลดอัตราค่าธรรมเนียม';
    box.classList.remove('d-none');
  } else {
    box.classList.add('d-none');
  }
}

/* ═══════════ บันทึกลง Google Sheet ═══════════ */
function saveToSheet() {
  const form = readForm();
  if (!form.productName) {
    Swal.fire({ icon: 'warning', title: 'กรุณากรอกชื่อสินค้า', text: 'ระบุชื่อสินค้าหรือ SKU เพื่อใช้อ้างอิงในการบันทึกข้อมูล', confirmButtonColor: '#EE4D2D' });
    return;
  }
  const active = PLATFORMS.filter(p => p.enabled);
  if (!active.length) {
    Swal.fire({ icon: 'warning', title: 'ยังไม่ได้เลือกแพลตฟอร์ม', confirmButtonColor: '#EE4D2D' });
    return;
  }

  const items = active.map(p => {
    const r = calcPlatform(p, form);
    return {
      platform: p.name,
      commFee: p.commissionPct, payFee: p.paymentPct,
      serviceFee: p.servicePct + (p.campaignOn ? p.campaignPct : 0) + (p.growthPct || 0),
      infraFee: p.infraFee,
      totalFeePercent: r.totalFeePercent,
      recommendedPrice: r.price.toFixed(2),
      finalNetProfit: r.profit.toFixed(2),
      marginPercent: r.marginPercent.toFixed(2),
      calcMode: form.calcMode
    };
  });

  const payload = {
    productName: form.productName, productCost: form.productCost, packCost: form.packCost,
    targetProfit: form.calcMode === 'target' ? form.targetProfit : form.sellPrice,
    adsFee: form.adsFee + form.voucherFee, items
  };

  Swal.fire({ title: 'กำลังบันทึกข้อมูล...', text: 'ระบบกำลังส่งข้อมูลไปยัง Google Sheet', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(res => {
        if (res.status === 'success') {
          Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ!', text: res.message, confirmButtonColor: '#EE4D2D' });
          loadHistory();
        } else {
          Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: res.message, confirmButtonColor: '#EE4D2D' });
        }
      })
      .withFailureHandler(err => Swal.fire({ icon: 'error', title: 'เชื่อมต่อไม่สำเร็จ', text: err.toString(), confirmButtonColor: '#EE4D2D' }))
      .saveDataToSheet(payload);
  } else {
    setTimeout(() => Swal.fire({ icon: 'info', title: 'โหมดทดสอบในเบราว์เซอร์', text: 'คำนวณสำเร็จ (บันทึก Google Sheet จะทำงานเมื่อ Deploy บน Google Apps Script)', confirmButtonColor: '#EE4D2D' }), 500);
  }
}

/* ---------- ประวัติจาก Sheet ---------- */
function loadHistory() {
  if (typeof google === 'undefined' || !google.script || !google.script.run) return;
  google.script.run
    .withSuccessHandler(res => {
      if (!res.data || !res.data.length) return;
      $id('historyCard').classList.remove('d-none');
      $id('historyBody').innerHTML = res.data.map(h => `
        <tr>
          <td class="text-secondary small">${h.date}</td>
          <td>${h.sku}</td>
          <td>${h.platform}</td>
          <td class="fw-semibold">฿${fmt(h.price)}</td>
          <td class="${h.profit < 0 ? 'text-danger' : 'text-success'} fw-semibold">฿${fmt(h.profit)}</td>
        </tr>`).join('');
    })
    .getHistory(15);
}

/* ═══════════ CSV Export ═══════════ */
function downloadCSV(head, rows, filename) {
  const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const csv = '\uFEFF' + [head, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  URL.revokeObjectURL(a.href);
  Swal.fire({
    icon: 'success', title: 'ดาวน์โหลดสำเร็จ', text: filename,
    showCancelButton: true,
    confirmButtonText: '☕ เลี้ยงกาแฟเจ้าของเว็บ',
    confirmButtonColor: '#f59e0b',
    cancelButtonText: 'ปิด'
  }).then(r => { if (r.isConfirmed) openDonateModal(); });
}

function exportSingleCSV() {
  const form = readForm();
  const head = ['ชื่อสินค้า', 'แพลตฟอร์ม', 'โหมด', 'ต้นทุน', 'บรรจุภัณฑ์', 'ราคาขาย', 'กำไรสุทธิ', 'กำไร(%)', 'ค่าธรรมเนียมรวม(%)', 'รวมยอดหัก(฿)'];
  const rows = PLATFORMS.filter(p => p.enabled).map(p => {
    const r = calcPlatform(p, form);
    return [form.productName, p.name, form.calcMode === 'target' ? 'หาราคาขาย' : 'ดูกำไร',
            form.productCost, form.packCost, r.error ? '-' : r.price.toFixed(2), r.error ? '-' : r.profit.toFixed(2),
            r.error ? '-' : r.marginPercent.toFixed(2), r.totalFeePercent.toFixed(2), r.totalDeduction.toFixed(2)];
  });
  downloadCSV(head, rows, 'pricing_multiplatform.csv');
}

/* ═══════════ BULK MODE ═══════════ */
function renderBulk() {
  const active = PLATFORMS.filter(p => p.enabled);
  $id('bulkEmpty').classList.toggle('d-none', bulkRows.length > 0);
  $id('bulkHead').innerHTML =
    '<th>SKU</th><th>ต้นทุน (฿)</th><th>บรรจุภัณฑ์ (฿)</th><th>กำไรเป้าหมาย (฿)</th>' +
    active.map(p => `<th class="text-center">${p.name}<div class="text-secondary fw-normal" style="font-size:.72rem">ราคาขาย / กำไร%</div></th>`).join('') +
    '<th></th>';

  $id('bulkBody').innerHTML = bulkRows.map((row, i) => {
    const cells = active.map(p => {
      const r = calcPlatform(p, { ...readForm(), productCost: row.cost, packCost: row.packaging, targetProfit: row.targetProfit, calcMode: 'target' });
      if (r.error) return `<td class="text-center bulk-warn">-</td>`;
      return `<td class="text-center"><span class="bulk-price ${r.warning ? 'bulk-warn' : ''}">${fmt(r.price)}</span>
              <div class="text-secondary" style="font-size:.72rem">${r.warning ? 'ขาดทุน' : fmt(r.marginPercent) + '%'}</div></td>`;
    }).join('');
    return `<tr>
      <td><input type="text" class="form-control form-control-sm" style="min-width:140px" value="${(row.sku || '').replace(/"/g, '&quot;')}" oninput="bulkRows[${i}].sku=this.value"></td>
      <td><input type="number" step="0.01" class="form-control form-control-sm" style="width:100px" value="${row.cost}" onchange="bulkRows[${i}].cost=num(this.value);renderBulk()"></td>
      <td><input type="number" step="0.01" class="form-control form-control-sm" style="width:100px" value="${row.packaging}" onchange="bulkRows[${i}].packaging=num(this.value);renderBulk()"></td>
      <td><input type="number" step="0.01" class="form-control form-control-sm" style="width:110px" value="${row.targetProfit}" onchange="bulkRows[${i}].targetProfit=num(this.value);renderBulk()"></td>
      ${cells}
      <td><button class="btn btn-sm btn-outline-danger border-0" onclick="bulkRows.splice(${i},1);renderBulk()"><i class="bi bi-trash"></i></button></td>
    </tr>`;
  }).join('');
}

function exportBulkCSV() {
  const active = PLATFORMS.filter(p => p.enabled);
  const form = readForm();
  const head = ['SKU', 'ต้นทุน', 'บรรจุภัณฑ์', 'กำไรเป้าหมาย',
    ...active.map(p => p.name + ' ราคาขาย'), ...active.map(p => p.name + ' กำไร(%)')];
  const rows = bulkRows.map(row => {
    const rs = active.map(p => calcPlatform(p, { ...form, productCost: row.cost, packCost: row.packaging, targetProfit: row.targetProfit, calcMode: 'target' }));
    return [row.sku, row.cost, row.packaging, row.targetProfit,
      ...rs.map(r => r.error ? '-' : r.price.toFixed(2)),
      ...rs.map(r => r.error ? '-' : r.marginPercent.toFixed(2))];
  });
  downloadCSV(head, rows, 'pricing_bulk.csv');
}

/* ═══════════ Share ═══════════ */
async function shareCalc() {
  const form = readForm();
  const text = 'สรุปการคำนวณราคาขาย' + (form.productName ? ' — ' + form.productName : '') + '\n' +
    PLATFORMS.filter(p => p.enabled).map(p => {
      const r = calcPlatform(p, form);
      return p.name + ': ราคา ฿' + fmt(r.price) + ' กำไร ฿' + fmt(r.profit);
    }).join('\n');
  if (navigator.share) {
    try { await navigator.share({ title: 'การคำนวณราคาขาย', text }); } catch (e) { /* ผู้ใช้ยกเลิก */ }
  } else if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    Swal.fire({ icon: 'success', title: 'คัดลอกแล้ว', text: 'ข้อความแชร์ถูกคัดลอกไปยังคลิปบอร์ด', timer: 1600, showConfirmButton: false });
  }
}

/* ═══════════ INIT ═══════════ */
function init() {
  // ทุก input ในหน้า single mode → คำนวณใหม่แบบ realtime
  document.querySelectorAll('#singleMode input, #singleMode select').forEach(el => {
    el.addEventListener('input', () => { renderPlatforms(); updateGlobalWarning(); });
  });

  $id('categoryPreset').addEventListener('change', applyPreset);
  $id('sellerType').addEventListener('change', applyPreset);
  $id('shopeePayMethod').addEventListener('change', applyShopeePayMethod);

  // สร้างตัวเลือกวิธีชำระเงิน Shopee (ปกติ 3.21% / SPayLater 4.28–7.49%)
  $id('shopeePayMethod').innerHTML = SHOPEE_PAY_METHODS
    .map(m => `<option value="${m.id}" ${m.id === 'normal' ? 'selected' : ''}>${m.label} — ${m.pct}%</option>`).join('');

  $id('btnSave').addEventListener('click', saveToSheet);
  $id('btnExportCSV').addEventListener('click', exportSingleCSV);
  $id('btnShare').addEventListener('click', shareCalc);
  $id('btnAddBulkRow').addEventListener('click', () => { bulkRows.push({ sku: '', cost: 0, packaging: 0, targetProfit: 0 }); renderBulk(); });
  $id('btnExportBulkCSV').addEventListener('click', exportBulkCSV);

  // Mode toggle
  $id('btnModeSingle').addEventListener('click', () => {
    $id('singleMode').classList.remove('d-none'); $id('bulkMode').classList.add('d-none');
    $id('btnModeSingle').classList.add('active', 'btn-light'); $id('btnModeSingle').classList.remove('btn-outline-light');
    $id('btnModeBulk').classList.remove('active', 'btn-light'); $id('btnModeBulk').classList.add('btn-outline-light');
    renderPlatforms();
  });
  $id('btnModeBulk').addEventListener('click', () => {
    $id('singleMode').classList.add('d-none'); $id('bulkMode').classList.remove('d-none');
    $id('btnModeBulk').classList.add('active', 'btn-light'); $id('btnModeBulk').classList.remove('btn-outline-light');
    $id('btnModeSingle').classList.remove('active', 'btn-light'); $id('btnModeSingle').classList.add('btn-outline-light');
    renderBulk();
  });

  applyPreset();
  renderCampaigns();
  renderPlatforms();
  loadHistory();
}
document.addEventListener('DOMContentLoaded', init);

/* ---------- PWA Install Prompt ---------- */
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e;
  $id('btnInstallApp').classList.remove('d-none');
});
$idSafe('btnInstallApp')?.addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') $id('btnInstallApp').classList.add('d-none');
    deferredPrompt = null;
  }
});
function $idSafe(id) { return document.getElementById(id); }
