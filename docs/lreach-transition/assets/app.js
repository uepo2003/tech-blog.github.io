/* lreach transition — 閲覧用HTMLの共通スクリプト
   file:// から直接開けるよう、モジュールも外部依存も使わない。 */
(function () {
  "use strict";

  var root = document.documentElement;
  var STORE_THEME = "lt-theme";

  /* ---------------- テーマ ---------------- */
  function readStore(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeStore(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* file://で拒否される環境は無視 */ }
  }
  function currentTheme() {
    var explicit = root.getAttribute("data-theme");
    if (explicit) return explicit;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  var themeButton = document.getElementById("theme-toggle");
  if (themeButton) {
    themeButton.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      writeStore(STORE_THEME, next);
      themeButton.setAttribute("aria-label", next === "dark" ? "ライトテーマへ切り替え" : "ダークテーマへ切り替え");
    });
  }

  /* ---------------- セクションの開閉 ---------------- */
  var sections = [].slice.call(document.querySelectorAll(".sec"));
  var collapsed = Object.create(null);
  sections.forEach(function (sec) {
    collapsed[sec.id] = sec.classList.contains("is-collapsed");
  });

  function setExpanded(sec, expanded) {
    sec.classList.toggle("is-collapsed", !expanded);
    var head = sec.querySelector(".sec-head");
    if (head) head.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  document.addEventListener("click", function (event) {
    var head = event.target.closest ? event.target.closest(".sec-head") : null;
    if (!head) return;
    var sec = head.closest(".sec");
    var expanded = sec.classList.contains("is-collapsed");
    setExpanded(sec, expanded);
    collapsed[sec.id] = !expanded;
  });

  /* 上のフェーズカードから、閉じた曜日計画を一度で開く */
  document.addEventListener("click", function (event) {
    var trigger = event.target.closest ? event.target.closest("[data-open-section]") : null;
    if (!trigger) return;
    var id = trigger.getAttribute("data-open-section");
    var sec = id ? document.getElementById(id) : null;
    if (!sec || !sec.classList.contains("sec")) return;
    setExpanded(sec, true);
    collapsed[sec.id] = false;
  });

  function openHashTarget() {
    var id = (window.location.hash || "").slice(1);
    if (!id) return;
    var target = document.getElementById(id);
    if (!target) return;
    var sec = target.classList.contains("sec") ? target : target.closest(".sec");
    if (sec) {
      setExpanded(sec, true);
      collapsed[sec.id] = false;
    }
    if (target.tagName === "DETAILS") target.open = true;
  }
  openHashTarget();
  window.addEventListener("hashchange", openHashTarget);

  var toggleAll = document.getElementById("toggle-all");
  if (toggleAll) {
    toggleAll.addEventListener("click", function () {
      var anyOpen = sections.some(function (sec) {
        return !sec.hidden && !sec.classList.contains("is-collapsed");
      });
      sections.forEach(function (sec) {
        setExpanded(sec, !anyOpen);
        collapsed[sec.id] = anyOpen;
      });
      toggleAll.textContent = anyOpen ? "すべて開く" : "すべて閉じる";
    });
  }

  /* ---------------- 検索・絞り込み ---------------- */
  var search = document.getElementById("search");
  var segButtons = [].slice.call(document.querySelectorAll(".segmented button"));
  var countEl = document.getElementById("filter-count");
  var tocLinks = [].slice.call(document.querySelectorAll(".toc-list a"));
  var totalTasks = document.querySelectorAll("li.task").length;
  var mode = "all";

  function normalize(value) {
    return (value || "").toLowerCase();
  }

  function applyFilter() {
    var query = normalize(search ? search.value.trim() : "");
    var filtering = query !== "" || mode !== "all";
    document.body.classList.toggle("is-filtering", filtering);

    var shown = 0;
    var visibleIds = Object.create(null);

    sections.forEach(function (sec) {
      var titleEl = sec.querySelector(".sec-title");
      var titleHit = query !== "" && normalize(titleEl ? titleEl.textContent : "").indexOf(query) >= 0;
      var tasks = [].slice.call(sec.querySelectorAll("li.task"));
      var visibleTasks = 0;

      tasks.forEach(function (task) {
        var done = task.classList.contains("done");
        var modeOk = mode === "all" || (mode === "todo" ? !done : done);
        var textOk = query === "" || titleHit || normalize(task.textContent).indexOf(query) >= 0;
        var visible = modeOk && textOk;
        task.hidden = !visible;
        if (visible) visibleTasks += 1;
      });

      shown += visibleTasks;

      var bodyHit = query !== "" && normalize(sec.textContent).indexOf(query) >= 0;
      var visible;
      if (mode === "all") {
        visible = query === "" || titleHit || bodyHit;
      } else {
        visible = tasks.length > 0 && visibleTasks > 0 && (query === "" || titleHit || visibleTasks > 0);
      }
      sec.hidden = !visible;
      if (visible) {
        visibleIds[sec.id] = true;
        if (filtering) setExpanded(sec, true);
        else setExpanded(sec, !collapsed[sec.id]);
      }
    });

    tocLinks.forEach(function (link) {
      var id = (link.getAttribute("href") || "").slice(1);
      var owner = link.getAttribute("data-owner") || id;
      var item = link.parentNode;
      if (item && item.tagName === "LI") item.hidden = filtering && !visibleIds[owner];
    });

    if (countEl) {
      countEl.textContent = filtering
        ? "表示中 " + shown + " / 全 " + totalTasks + " 項目"
        : "チェック項目 " + totalTasks + " 件";
    }

    var empty = document.getElementById("empty-state");
    if (empty) {
      empty.hidden = sections.some(function (sec) { return !sec.hidden; });
    }
  }

  if (search) {
    search.addEventListener("input", applyFilter);
    search.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { search.value = ""; applyFilter(); search.blur(); }
    });
  }
  segButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      mode = button.getAttribute("data-mode") || "all";
      segButtons.forEach(function (other) {
        other.setAttribute("aria-pressed", other === button ? "true" : "false");
      });
      applyFilter();
    });
  });
  document.addEventListener("keydown", function (event) {
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
    var tag = document.activeElement ? document.activeElement.tagName : "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (!search) return;
    event.preventDefault();
    search.focus();
    search.select();
  });

  if (search || segButtons.length) applyFilter();

  /* ---------------- 目次のスクロール連動 ---------------- */
  var spyTargets = [].slice.call(document.querySelectorAll("[data-toc-target]"));
  if (tocLinks.length && spyTargets.length) {
    var ticking = false;
    var spy = function () {
      ticking = false;
      var offset = 120;
      var active = null;
      for (var i = 0; i < spyTargets.length; i += 1) {
        var target = spyTargets[i];
        if (target.hidden || target.offsetParent === null) continue;
        if (target.getBoundingClientRect().top - offset <= 0) active = target;
      }
      if (!active) active = spyTargets[0];
      var wanted = active ? "#" + active.id : "";
      tocLinks.forEach(function (link) {
        var hit = link.getAttribute("href") === wanted;
        link.classList.toggle("is-active", hit);
        if (!hit) return;
        var list = link.closest(".toc");
        if (!list || list.scrollHeight <= list.clientHeight) return;
        var lr = link.getBoundingClientRect();
        var cr = list.getBoundingClientRect();
        if (lr.top < cr.top || lr.bottom > cr.bottom) {
          list.scrollTop += lr.top - cr.top - list.clientHeight / 2 + lr.height;
        }
      });
    };
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(spy);
    }, { passive: true });
    spy();
  }

  /* ---------------- 学習パスのノード ---------------- */
  /* ロードマップのノードを押したら、該当フェーズと該当曜日カードを開いて中央に寄せる */
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function focusCard(card) {
    if (!card) return;
    card.classList.add("is-target");
    window.setTimeout(function () { card.classList.remove("is-target"); }, 2400);
    window.requestAnimationFrame(function () {
      try {
        card.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
      } catch (e) {
        card.scrollIntoView(true);
      }
    });
  }

  document.addEventListener("click", function (event) {
    var trigger = event.target.closest ? event.target.closest("[data-open-details]") : null;
    if (!trigger) return;
    var card = document.getElementById(trigger.getAttribute("data-open-details"));
    if (!card) return;
    var sec = card.closest ? card.closest(".sec") : null;
    if (sec) {
      setExpanded(sec, true);
      collapsed[sec.id] = false;
    }
    if (card.tagName === "DETAILS") card.open = true;
    focusCard(card);
  });

  /* ---------------- 進捗リングの描画 ---------------- */
  [].slice.call(document.querySelectorAll(".ring-fg[data-percent]")).forEach(function (circle) {
    var percent = Math.max(0, Math.min(100, Number(circle.getAttribute("data-percent")) || 0));
    if (reduceMotion) {
      circle.setAttribute("stroke-dasharray", percent + " 100");
      return;
    }
    circle.setAttribute("stroke-dasharray", "0 100");
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        circle.setAttribute("stroke-dasharray", percent + " 100");
      });
    });
  });

  /* ---------------- 進捗バーを伸ばす ---------------- */
  if (!reduceMotion) {
    [].slice.call(document.querySelectorAll(".bar > i")).forEach(function (fill) {
      var width = fill.style.width;
      if (!width) return;
      fill.style.width = "0%";
      fill.style.transition = "width .9s cubic-bezier(.22, 1, .36, 1)";
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () { fill.style.width = width; });
      });
    });
  }

  /* ---------------- 経験値などの数字を数え上げる ---------------- */
  [].slice.call(document.querySelectorAll("[data-countup]")).forEach(function (el) {
    var target = Number(el.getAttribute("data-countup"));
    if (!isFinite(target)) return;
    if (reduceMotion || target <= 0) {
      el.textContent = target.toLocaleString("ja-JP");
      return;
    }
    var started = null;
    var span = 900;
    var step = function (now) {
      if (started === null) started = now;
      var ratio = Math.min(1, (now - started) / span);
      var eased = 1 - Math.pow(1 - ratio, 3);
      el.textContent = Math.round(target * eased).toLocaleString("ja-JP");
      if (ratio < 1) window.requestAnimationFrame(step);
    };
    el.textContent = "0";
    window.requestAnimationFrame(step);
  });
})();
