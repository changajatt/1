/* Tyvante Digital: sales page behaviour (vanilla JS, no dependencies) */

/* =====================================================================
   PURCHASE CONFIGURATION: the only block you need to edit before launch.
   Use null for anything not yet confirmed. Nothing here is shown as fact
   until it is filled in, and invalid values are ignored safely.

   MUST BE SUPPLIED BEFORE CHECKOUT CAN GO LIVE:
   - checkoutUrl            real https:// link from your payment provider
   - checkoutProvider       the provider's name (e.g. the company that processes payment)
   - deliveryDescription    exactly how and when the buyer gets the files
   - refundPolicy           your real refund terms (or leave null)
   - contactEmail           a real, monitored support address (or leave null)
   - promotionStartDate / promotionEndDate  real launch dates (see below)

   PRICING (provisional test: $29 regular / $19 launch; adjust freely):
   - currency               ISO code, e.g. "USD"
   - regularPrice           the intended regular price
   - launchPrice            the launch price (must be lower than regularPrice)
   - promotionEnabled       true/false master switch for the launch offer
   - promotionStartDate     ISO date-time WITH timezone, e.g. "2026-12-01T00:00:00Z"; null = no start limit
   - promotionEndDate       ISO date-time WITH timezone; null = no end shown. When this
                            moment passes, the page stops advertising the launch offer
                            and shows regularPrice. It never restarts on refresh.
   - maxEligibleBuyers      number or null. A static page CANNOT count sales. Only set it
                            if you will really enforce the limit, and switch
                            promotionEnabled to false yourself when it is reached.

   IMPORTANT: this page only DISPLAYS prices. The price actually charged is set in
   your checkout provider. Keep both in sync, and change the provider's price when
   the launch offer ends. The page clock is the visitor's device clock, so treat the
   dates as display logic, not as enforcement.
   ===================================================================== */
const PURCHASE_CONFIG = {
  productName: "The Ultimate AI Content Creation & Growth System — 2027 Edition",

  currency: "USD",
  regularPrice: 29,
  launchPrice: 19,
  promotionEnabled: true,
  promotionStartDate: null,
  promotionEndDate: null,
  maxEligibleBuyers: null,
  promotionText: null,          // optional extra sentence shown while the offer is active

  checkoutUrl: null,
  secondaryCheckoutUrl: null,   // shown only if checkoutUrl is also valid
  secondaryLabel: "Alternative checkout",
  checkoutProvider: null,

  deliveryDescription: null,
  refundPolicy: null,
  contactEmail: null,

  price: null                   // legacy field: used as regularPrice if regularPrice is null
};

(function () {
  "use strict";

  var cfg = PURCHASE_CONFIG;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- Validation helpers ---------- */
  function filled(v) { return typeof v === "string" && v.trim() !== ""; }

  function validCheckout(url, label) {
    if (url === null || url === undefined || url === "") return null;
    var bad = function (why) { if (window.console) console.warn("PURCHASE_CONFIG." + label + " ignored: " + why); return null; };
    if (typeof url !== "string") return bad("not a string");
    var u;
    try { u = new URL(url.trim()); } catch (e) { return bad("not a valid URL"); }
    if (u.protocol !== "https:") return bad("must start with https://");
    if (u.username || u.password) return bad("must not contain credentials");
    var host = u.hostname.toLowerCase();
    if (host.indexOf(".") < 1 || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return bad("hostname looks invalid");
    if (/(^|\.)(example\.(com|org|net)|localhost|invalid|test)$/.test(host)) return bad("placeholder domain");
    if (/your[-_ ]?|placeholder|xxxx|changeme/i.test(u.href)) return bad("looks like a placeholder");
    return u.href;
  }

  function validEmail(v) {
    return filled(v) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? v.trim() : null;
  }

  function validCurrency(code) {
    if (!filled(code) || !/^[A-Za-z]{3}$/.test(code.trim())) return null;
    var c = code.trim().toUpperCase();
    try {
      if (typeof Intl.supportedValuesOf === "function" && Intl.supportedValuesOf("currency").indexOf(c) === -1) return null;
      new Intl.NumberFormat("en-US", { style: "currency", currency: c });
    } catch (e) { return null; }
    return c;
  }

  function validAmount(n) {
    return typeof n === "number" && isFinite(n) && n > 0 ? n : null;
  }

  function parseDate(v) {
    if (v === null || v === undefined || v === "") return { set: false, date: null };
    var d = new Date(v);
    return isNaN(d.getTime()) ? { set: true, date: null } : { set: true, date: d };
  }

  function fmtMoney(amount, cur) {
    var whole = Math.round(amount) === amount;
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur,
      minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(amount) + " " + cur;
  }

  function fmtDate(d) {
    try {
      return d.toLocaleString(undefined, { year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
    } catch (e) { return d.toUTCString(); }
  }

  function text(el, t) { if (el) el.textContent = t; }
  function show(el, on) { if (el) el.hidden = !on; }

  /* ---------- Mobile menu ---------- */
  var menuBtn = $("#menuBtn"), nav = $("#nav");
  function setMenu(open) {
    if (!menuBtn || !nav) return;
    menuBtn.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("open", open);
  }
  if (menuBtn && nav) {
    menuBtn.addEventListener("click", function () { setMenu(menuBtn.getAttribute("aria-expanded") !== "true"); });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menuBtn.getAttribute("aria-expanded") === "true") { setMenu(false); menuBtn.focus(); }
    });
    var mq = window.matchMedia("(min-width: 960px)");
    var onMq = function (e) { if (e.matches) setMenu(false); };
    if (mq.addEventListener) mq.addEventListener("change", onMq); else if (mq.addListener) mq.addListener(onMq);
  }

  /* ---------- FAQ accordion ---------- */
  $$(".faq button[aria-controls]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var panel = document.getElementById(btn.getAttribute("aria-controls"));
      if (!panel) return;
      var open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      panel.hidden = open;
    });
  });

  /* ---------- Purchase logic ---------- */
  var el = {
    pricing: $("#pricing"), pending: $("#pricePending"), label: $("#promoLabel"), main: $("#priceMain"),
    sub: $("#priceSub"), terms: $("#promoTerms"), hero: $("#heroNote"),
    primary: $("#buyPrimary"), off: $("#buyUnavailable"), second: $("#buySecondary"), status: $("#buyStatus"),
    tProvider: $("#tProvider"), tDelivery: $("#tDelivery"), tRefund: $("#tRefund"), tSupport: $("#tSupport"),
    faq: $("#a8text"), contact: $("#contactLine")
  };
  var timer = null;

  function promoState(now, enabled, regular, launch, start, end) {
    if (!enabled || !launch || !regular || launch >= regular) return "off";
    if (start.set && !start.date) return "off";   // invalid dates fail safe: no promotion
    if (end.set && !end.date) return "off";
    if (start.date && now < start.date) return "upcoming";
    if (end.date && now >= end.date) return "ended";
    return "active";
  }

  function render() {
    var now = new Date();
    var cur = validCurrency(cfg.currency);
    var regular = validAmount(cfg.regularPrice !== null && cfg.regularPrice !== undefined ? cfg.regularPrice : cfg.price);
    var launch = validAmount(cfg.launchPrice);
    var start = parseDate(cfg.promotionStartDate), end = parseDate(cfg.promotionEndDate);
    var checkout = validCheckout(cfg.checkoutUrl, "checkoutUrl");
    var second = validCheckout(cfg.secondaryCheckoutUrl, "secondaryCheckoutUrl");
    if (second && (!checkout || second === checkout)) second = null;   // never show a lone or duplicate secondary
    var state = promoState(now, cfg.promotionEnabled === true, regular, launch, start, end);
    var hasPrice = !!(cur && regular);

    /* Pricing block */
    show(el.pricing, hasPrice); show(el.pending, !hasPrice);
    show(el.label, false); show(el.sub, false); show(el.terms, false);
    var priceNow = null, heroText = "";
    if (hasPrice) {
      if (state === "active") {
        priceNow = launch;
        text(el.label, "Launch offer");
        show(el.label, true);
        text(el.main, fmtMoney(launch, cur));
        var pct = Math.round((regular - launch) / regular * 100);
        text(el.sub, "Planned regular price: " + fmtMoney(regular, cur) + ". You save " + fmtMoney(regular - launch, cur) + " (about " + pct + "%) at the launch price.");
        show(el.sub, true);
        var parts = [];
        if (end.date) parts.push("Launch price available until " + fmtDate(end.date) + ".");
        if (typeof cfg.maxEligibleBuyers === "number" && cfg.maxEligibleBuyers > 0) parts.push("Offered to the first " + Math.floor(cfg.maxEligibleBuyers) + " buyers.");
        if (filled(cfg.promotionText)) parts.push(cfg.promotionText.trim());
        if (parts.length) { text(el.terms, parts.join(" ")); show(el.terms, true); }
        heroText = "Launch offer: " + fmtMoney(launch, cur) + " (planned regular price: " + fmtMoney(regular, cur) + ")";
      } else {
        priceNow = regular;
        text(el.main, fmtMoney(regular, cur));
        if (state === "upcoming") {
          text(el.terms, "A launch offer of " + fmtMoney(launch, cur) + " is planned to start on " + fmtDate(start.date) + ".");
          show(el.terms, true);
        }
        heroText = fmtMoney(regular, cur);
      }
    }
    text(el.hero, heroText); show(el.hero, !!heroText);

    /* Buttons and links */
    var ctas = $$("[data-cta]");
    if (checkout) {
      ctas.forEach(function (a) { a.href = checkout; a.rel = "noopener noreferrer"; });
      if (el.primary) { el.primary.href = checkout; el.primary.rel = "noopener noreferrer"; }
      show(el.primary, true); show(el.off, false);
      text(el.status, "");
    } else {
      ctas.forEach(function (a) { a.setAttribute("href", "#purchase"); a.removeAttribute("rel"); });
      show(el.primary, false); show(el.off, true);
      text(el.status, "Checkout has not been set up yet, so purchases cannot be made on this page." + (hasPrice ? " Prices shown are planned prices and apply once checkout opens." : ""));
    }
    if (el.second) {
      if (second) {
        el.second.href = second; el.second.rel = "noopener noreferrer";
        text(el.second, filled(cfg.secondaryLabel) ? cfg.secondaryLabel.trim() : "Alternative checkout");
      }
      show(el.second, !!second);
    }

    /* Purchase facts: only confirmed values, otherwise a neutral notice */
    var NC = "Not yet confirmed";
    text(el.tProvider, filled(cfg.checkoutProvider) ? cfg.checkoutProvider.trim() : NC);
    text(el.tDelivery, filled(cfg.deliveryDescription) ? cfg.deliveryDescription.trim() : NC);
    text(el.tRefund, filled(cfg.refundPolicy) ? cfg.refundPolicy.trim() : NC);
    var email = validEmail(cfg.contactEmail);
    if (el.tSupport) {
      el.tSupport.textContent = "";
      if (email) { var a = document.createElement("a"); a.href = "mailto:" + email; a.textContent = email; el.tSupport.appendChild(a); }
      else el.tSupport.textContent = NC;
    }
    if (el.contact) {
      el.contact.textContent = "";
      if (email) {
        el.contact.appendChild(document.createTextNode("Contact: "));
        var b = document.createElement("a"); b.href = "mailto:" + email; b.textContent = email; el.contact.appendChild(b);
      }
      show(el.contact, !!email);
    }
    if (el.faq) {
      var bits = [];
      bits.push(filled(cfg.deliveryDescription) ? "Delivery: " + cfg.deliveryDescription.trim() : "Delivery details have not been confirmed yet.");
      bits.push(filled(cfg.refundPolicy) ? "Refunds: " + cfg.refundPolicy.trim() : "Refund terms have not been confirmed yet.");
      el.faq.textContent = bits.join(" ");
    }

    /* Structured data only when a real checkout and a valid price exist */
    var old = document.getElementById("ld-product");
    if (old) old.remove();
    if (checkout && priceNow && cur) {
      var offer = { "@type": "Offer", "price": String(priceNow), "priceCurrency": cur, "url": checkout, "availability": "https://schema.org/InStock" };
      if (state === "active" && end.date) offer.priceValidUntil = end.date.toISOString().slice(0, 10);
      var ld = document.createElement("script");
      ld.type = "application/ld+json"; ld.id = "ld-product";
      ld.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "Product",
        "name": cfg.productName, "brand": { "@type": "Brand", "name": "Tyvante Digital" },
        "description": "A practical ebook on AI content creation and growth, with a prompt vault, bonus tools and 30-day and 90-day plans.",
        "offers": offer });
      document.head.appendChild(ld);
    }

    /* Re-render exactly when the offer starts or ends (no countdown is displayed) */
    if (timer) { clearTimeout(timer); timer = null; }
    var next = null;
    [start.date, end.date].forEach(function (d) { if (d && d > now && (!next || d < next)) next = d; });
    if (next) {
      var ms = next - now + 500;
      if (ms < 2147483647) timer = setTimeout(render, ms);
    }
  }

  render();
  document.addEventListener("visibilitychange", function () { if (!document.hidden) render(); });
})();
