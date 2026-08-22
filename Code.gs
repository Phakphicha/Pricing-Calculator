/**
 * ═══════════════════════════════════════════════════════════════
 *  Multi-Platform Pricing Calculator (TH) — Google Apps Script
 *  Backend: doGet() แสดงหน้าเว็บ + saveDataToSheet() บันทึกลง Sheet
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * ฟังก์ชันหลักแสดงผลหน้า Web App
 */
function doGet(e) {
  try {
    var template = HtmlService.createTemplateFromFile('index');
    var htmlOutput = template.evaluate()
      .setTitle('ระบบคำนวณและบันทึกการตั้งราคาขาย Multi-Platform')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setFaviconUrl('https://lh3.googleusercontent.com/d/1NtrGos_fPqyMJcmIPH_6kiAVAzi8bd_t?.png');

    return htmlOutput.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return HtmlService.createHtmlOutput('<h3>เกิดข้อผิดพลาดในการโหลดหน้าเว็บ:</h3><p>' + err.toString() + '</p>');
  }
}

/**
 * JSON API (สำหรับโฮสต์ภายนอก เช่น GitHub Pages / Cloudflare Pages)
 * POST { action: 'activateVIP', key: 'VIP-XXXXXX-0000' } → { status, expiry }
 */
function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    if (req.action === 'activateVIP') return jsonOut_(activateVIP(req.key));
    return jsonOut_({ status: 'error', message: 'action ไม่ถูกต้อง' });
  } catch (err) {
    return jsonOut_({ status: 'error', message: err.toString() });
  }
}
function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ═══════════ ระบบสมาชิก VIP (VIP Key) ═══════════ */

/**
 * ตรวจสอบรหัส VIP จากชีต VIP_KEYS
 * คอลัมน์: key | status (active/disabled) | expiry (วันที่หมดอายุ) | activatedAt
 */
function activateVIP(key) {
  try {
    if (!key) return { status: 'error', message: 'กรุณากรอกรหัส VIP' };
    var sheet = getOrCreateVipSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { status: 'error', message: 'ไม่พบรหัส VIP นี้ในระบบ' };

    var data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim().toUpperCase() === String(key).trim().toUpperCase()) {
        if (String(data[i][1]).trim() !== 'active')
          return { status: 'error', message: 'รหัสนี้ถูกปิดใช้งานแล้ว กรุณาติดต่อผู้ขาย' };
        var exp = new Date(data[i][2]);
        if (!isNaN(exp.getTime())) {
          if (exp < new Date())
            return { status: 'error', message: 'รหัส VIP นี้หมดอายุแล้ว (' + Utilities.formatDate(exp, 'Asia/Bangkok', 'dd/MM/yyyy') + ')' };
          var expiryText = Utilities.formatDate(exp, 'Asia/Bangkok', 'dd/MM/yyyy');
        }
        if (!data[i][3]) sheet.getRange(i + 2, 4).setValue(new Date()); // บันทึกวันที่เริ่มใช้งาน
        return { status: 'success', message: 'ยืนยันรหัส VIP สำเร็จ ยินดีต้อนรับสมาชิก VIP!', expiry: expiryText || '' };
      }
    }
    return { status: 'error', message: 'ไม่พบรหัส VIP นี้ในระบบ' };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * (สำหรับเจ้าของร้าน) สร้างรหัส VIP จำนวน count รหัส อายุ days วัน
 * รันใน Apps Script Editor แล้วดูผลใน Log
 */
function generateVipKeys(count, days) {
  var sheet = getOrCreateVipSheet();
  var expiry = new Date(Date.now() + (days || 30) * 86400000);
  var keys = [], rows = [];
  for (var i = 0; i < (count || 1); i++) {
    var code = Utilities.base64Encode(Utilities.getUuid()).replace(/[^a-zA-Z]/g, '')
      .substring(0, 6).toUpperCase();
    var key = 'VIP-' + code + '-' + Math.floor(1000 + Math.random() * 9000);
    keys.push(key);
    rows.push([key, 'active', expiry, '']);
  }
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
  Logger.log(keys.join('\n'));
  return keys;
}

/* ---------- Helper: หา/สร้างชีต VIP_KEYS ---------- */
function getOrCreateVipSheet() {
  var SHEET_ID = '1tkLmF-Zqwm3AqapMxdM2ClIds7Ma38iEcfhkvJdwxYw';
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('VIP_KEYS');
  if (!sheet) {
    sheet = ss.insertSheet('VIP_KEYS');
    var headers = ['รหัส VIP', 'สถานะ (active/disabled)', 'วันหมดอายุ', 'วันที่เริ่มใช้งาน'];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#fbbf24')
      .setFontColor('#1c1814');
  }
  return sheet;
}

/**
 * ดึงข้อมูลประวัติย้อนหลังล่าสุดจาก Sheet (แสดงในหน้าเว็บ)
 */
function getHistory(limit) {
  try {
    var sheet = getOrCreateSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { status: 'success', data: [] };

    var values = sheet.getRange(2, 1, lastRow - 1, 16).getValues();
    var rows = values.reverse().slice(0, limit || 20).map(function (r) {
      return {
        date: Utilities.formatDate(new Date(r[0]), Session.getScriptTimeZone(), 'dd/MM/yy HH:mm'),
        sku: r[2],
        platform: r[1],
        price: r[12],
        profit: r[13],
        margin: r[14]
      };
    });
    return { status: 'success', data: rows };
  } catch (error) {
    return { status: 'error', message: error.toString(), data: [] };
  }
}

/**
 * ฟังก์ชันบันทึกข้อมูลลง Google Sheet โดยตรง
 * รองรับหลายแพลตฟอร์ม: บันทึก 1 แถว ต่อ 1 แพลตฟอร์มที่เลือกเปรียบเทียบ
 */
function saveDataToSheet(data) {
  try {
    var sheet = getOrCreateSheet();

    // data.items = array ของผลการคำนวณแต่ละแพลตฟอร์ม
    var items = data.items || [];
    if (!items.length) {
      return { status: 'error', message: 'ไม่มีข้อมูลแพลตฟอร์มที่เลือกไว้สำหรับบันทึก' };
    }

    var now = new Date();
    var rows = items.map(function (it) {
      return [
        now,                                                   // วัน-เวลาที่บันทึก
        it.platform,                                           // แพลตฟอร์ม
        data.productName || 'ไม่ระบุชื่อ',                     // ชื่อ/SKU
        num(data.productCost),                                 // ต้นทุนสินค้า
        num(data.packCost),                                    // ค่าบรรจุภัณฑ์
        num(data.targetProfit),                                // กำไรที่ต้องการ
        num(it.commFee),                                       // ค่าคอมมิชชัน (%)
        num(it.payFee),                                        // ค่าธรรมเนียมชำระเงิน (%)
        num(it.serviceFee),                                    // ค่าบริการ/แคมเปญ (%)
        num(data.adsFee),                                      // เผื่องบ Ads/โค้ด (%)
        num(it.totalFeePercent),                               // รวม % ค่าธรรมเนียม
        num(it.infraFee),                                      // ค่าธรรมเนียมคงที่ (฿)
        num(it.recommendedPrice),                              // ราคาขายที่แนะนำ
        num(it.finalNetProfit),                                // กำไรสุทธิคงเหลือ
        num(it.marginPercent),                                 // อัตรากำไรสุทธิ (%)
        it.calcMode || 'target'                                // โหมดการคำนวณ
      ];
    });

    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

    return {
      status: 'success',
      message: 'บันทึกข้อมูล ' + rows.length + ' รายการลง Google Sheet เรียบร้อยแล้ว!'
    };
  } catch (error) {
    return { status: 'error', message: 'เกิดข้อผิดพลาด: ' + error.toString() };
  }
}

/* ---------- Helper: หา/สร้างชีต DATA ---------- */
function getOrCreateSheet() {
  var SHEET_ID = '1tkLmF-Zqwm3AqapMxdM2ClIds7Ma38iEcfhkvJdwxYw';
  var SHEET_NAME = 'DATA';

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    var headers = [
      'วัน-เวลาที่บันทึก', 'แพลตฟอร์ม', 'ชื่อ/SKU สินค้า',
      'ต้นทุนสินค้า (บาท)', 'ค่าบรรจุภัณฑ์ (บาท)', 'กำไรที่ต้องการ (บาท)',
      'ค่าคอมมิชชัน (%)', 'ค่าธรรมเนียมการชำระเงิน (%)', 'ค่าบริการ/แคมเปญ (%)',
      'เผื่องบ Ads/โค้ด (%)', 'รวม % ค่าธรรมเนียม', 'ค่าธรรมเนียมคงที่ (บาท)',
      'ราคาขายที่แนะนำ (บาท)', 'กำไรสุทธิคงเหลือ (บาท)', 'อัตรากำไรสุทธิ (%)', 'โหมด'
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#EE4D2D')
      .setFontColor('#FFFFFF');
  }
  return sheet;
}

/* ---------- Helper: แปลงเป็นตัวเลขอย่างปลอดภัย ---------- */
function num(v) {
  var n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}
