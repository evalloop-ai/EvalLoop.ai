/* =========================================================
   EvalLoop AI
   Landing Page JavaScript
   ========================================================= */
(() => {
  "use strict";
  /* =========================================================
     ELEMENTS
     ========================================================= */
  const body = document.body;
  const pageProgress =
    document.getElementById("pageProgress");
  const mobileMenuButton =
    document.getElementById("mobileMenuButton");
  const mobileNav =
    document.getElementById("mobileNav");
  const currentYear =
    document.querySelector("[data-current-year]");
  const faqItems =
    document.querySelectorAll(".faq-item");
  const revealElements =
    document.querySelectorAll(".reveal");
  const reducedMotion =
    window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
  /* =========================================================
     CURRENT YEAR
     ========================================================= */
  if (currentYear) {
    currentYear.textContent =
      new Date().getFullYear();
  }
  /* =========================================================
     PAGE SCROLL PROGRESS
     ========================================================= */
  function updatePageProgress() {
    if (!pageProgress) {
      return;
    }
    const scrollTop =
      window.scrollY;
    const pageHeight =
      document.documentElement.scrollHeight -
      window.innerHeight;
    if (pageHeight <= 0) {
      pageProgress.style.width = "0%";
      return;
    }
    const progress =
      (scrollTop / pageHeight) * 100;
    pageProgress.style.width =
      `${Math.min(progress, 100)}%`;
  }
  window.addEventListener(
    "scroll",
    updatePageProgress,
    { passive: true }
  );
  updatePageProgress();
  /* =========================================================
     MOBILE MENU
     ========================================================= */
  if (
    mobileMenuButton &&
    mobileNav
  ) {
    mobileMenuButton.addEventListener(
      "click",
      () => {
        const isOpen =
          mobileNav.classList.toggle(
            "active"
          );
        mobileMenuButton.setAttribute(
          "aria-expanded",
          String(isOpen)
        );
        mobileMenuButton.setAttribute(
          "aria-label",
          isOpen
            ? "Close navigation"
            : "Open navigation"
        );
        body.classList.toggle(
          "menu-open",
          isOpen
        );
      }
    );
    /* Close after selecting a link */
    const mobileLinks =
      mobileNav.querySelectorAll("a");
    mobileLinks.forEach((link) => {
      link.addEventListener(
        "click",
        () => {
          mobileNav.classList.remove(
            "active"
          );
          mobileMenuButton.setAttribute(
            "aria-expanded",
            "false"
          );
          mobileMenuButton.setAttribute(
            "aria-label",
            "Open navigation"
          );
          body.classList.remove(
            "menu-open"
          );
        }
      );
    });
    /* Close menu with Escape */
    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Escape" &&
          mobileNav.classList.contains("active")
        ) {
          mobileNav.classList.remove(
            "active"
          );
          mobileMenuButton.setAttribute(
            "aria-expanded",
            "false"
          );
          mobileMenuButton.setAttribute(
            "aria-label",
            "Open navigation"
          );
          body.classList.remove(
            "menu-open"
          );
        }
      }
    );
  }
  /* =========================================================
     SCROLL REVEAL
     ========================================================= */
  if (
    revealElements.length &&
    !reducedMotion
  ) {
    const revealObserver =
      new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              return;
            }
            entry.target.classList.add(
              "visible"
            );
            observer.unobserve(
              entry.target
            );
          });
        },
        {
          threshold: 0.12,
          rootMargin:
            "0px 0px -45px 0px"
        }
      );
    revealElements.forEach((element) => {
      revealObserver.observe(element);
    });
  } else {
    revealElements.forEach((element) => {
      element.classList.add(
        "visible"
      );
    });
  }
  /* =========================================================
     FAQ ACCORDION
     ========================================================= */
  faqItems.forEach((item) => {
    const button =
      item.querySelector(
        ".faq-question"
      );
    if (!button) {
      return;
    }
    button.addEventListener(
      "click",
      () => {
        const wasOpen =
          item.classList.contains(
            "active"
          );
        /* Close every FAQ */
        faqItems.forEach((otherItem) => {
          otherItem.classList.remove(
            "active"
          );
          const otherButton =
            otherItem.querySelector(
              ".faq-question"
            );
          if (otherButton) {
            otherButton.setAttribute(
              "aria-expanded",
              "false"
            );
          }
        });
        /* Open selected FAQ */
        if (!wasOpen) {
          item.classList.add(
            "active"
          );
          button.setAttribute(
            "aria-expanded",
            "true"
          );
        }
      }
    );
  });
  /* =========================================================
     SMOOTH INTERNAL LINKS
     ========================================================= */
  const internalLinks =
    document.querySelectorAll(
      'a[href^="#"]'
    );
  internalLinks.forEach((link) => {
    link.addEventListener(
      "click",
      (event) => {
        const targetId =
          link.getAttribute("href");
        if (
          !targetId ||
          targetId === "#"
        ) {
          return;
        }
        const target =
          document.querySelector(
            targetId
          );
        if (!target) {
          return;
        }
        event.preventDefault();
        const header =
          document.querySelector(
            ".site-header"
          );
        const announcement =
          document.querySelector(
            ".announcement"
          );
        const headerHeight =
          header
            ? header.offsetHeight
            : 0;
        const announcementHeight =
          announcement
            ? announcement.offsetHeight
            : 0;
        const offset = 18;
        const targetPosition =
          target.getBoundingClientRect().top +
          window.scrollY -
          headerHeight -
          announcementHeight -
          offset;
        window.scrollTo({
          top:
            Math.max(
              targetPosition,
              0
            ),
          behavior:
            reducedMotion
              ? "auto"
              : "smooth"
        });
      }
    );
  });
  /* =========================================================
     HERO VISUAL SUBTLE PARALLAX
     ========================================================= */
  const heroVisual =
    document.querySelector(
      ".hero-visual"
    );
  const visualCore =
    document.querySelector(
      ".visual-core"
    );
  const finePointer =
    window.matchMedia(
      "(pointer: fine)"
    ).matches;
  if (
    heroVisual &&
    visualCore &&
    finePointer &&
    !reducedMotion
  ) {
    heroVisual.addEventListener(
      "mousemove",
      (event) => {
        const rect =
          heroVisual.getBoundingClientRect();
        const x =
          (event.clientX - rect.left) /
          rect.width -
          0.5;
        const y =
          (event.clientY - rect.top) /
          rect.height -
          0.5;
        const moveX =
          x * 12;
        const moveY =
          y * 12;
        visualCore.style.transform =
          `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;
      }
    );
    heroVisual.addEventListener(
      "mouseleave",
      () => {
        visualCore.style.transform =
          "translate(-50%, -50%)";
      }
    );
  }
  /* =========================================================
     PRODUCT CARD INTERACTION
     ========================================================= */
  const productCards =
    document.querySelectorAll(
      ".product-card"
    );
  productCards.forEach((card) => {
    card.addEventListener(
      "mouseenter",
      () => {
        card.classList.add(
          "is-hovered"
        );
      }
    );
    card.addEventListener(
      "mouseleave",
      () => {
        card.classList.remove(
          "is-hovered"
        );
      }
    );
  });
  /* =========================================================
     CONSOLE BRANDING
     ========================================================= */
  console.log(
    "%cEvalLoop AI_",
    "color:#3ecf8e;font-family:monospace;font-size:18px;font-weight:500;"
  );
  console.log(
    "%cPractical AI products for real work.",
    "color:#a4aaa6;font-family:monospace;font-size:11px;"
  );
})();
