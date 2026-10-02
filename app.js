/* =========================================================
   EvalLoop AI
   Build → Evaluate → Improve → Repeat
   Main site interactions
   ========================================================= */
(() => {
  "use strict";
  /* =========================================================
     BASIC ELEMENTS
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
  const prefersReducedMotion =
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
    const documentHeight =
      document.documentElement.scrollHeight -
      window.innerHeight;
    if (documentHeight <= 0) {
      pageProgress.style.width = "0%";
      return;
    }
    const progress =
      (scrollTop / documentHeight) * 100;
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
          mobileNav.classList.toggle("active");
        mobileMenuButton.setAttribute(
          "aria-expanded",
          String(isOpen)
        );
        body.classList.toggle(
          "menu-open",
          isOpen
        );
      }
    );
    /* Close menu when a navigation link is selected */
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
          body.classList.remove(
            "menu-open"
          );
        }
      );
    });
  }
  /* =========================================================
     SCROLL REVEAL
     ========================================================= */
  const revealElements =
    document.querySelectorAll(".reveal");
  if (
    revealElements.length &&
    !prefersReducedMotion
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
            "0px 0px -40px 0px"
        }
      );
    revealElements.forEach((element) => {
      revealObserver.observe(element);
    });
  } else {
    revealElements.forEach((element) => {
      element.classList.add("visible");
    });
  }
  /* =========================================================
     FAQ ACCORDION
     ========================================================= */
  const faqItems =
    document.querySelectorAll(".faq-item");
  faqItems.forEach((item) => {
    const button =
      item.querySelector(".faq-question");
    if (!button) {
      return;
    }
    button.addEventListener(
      "click",
      () => {
        const isOpen =
          item.classList.contains("active");
        /* Close every other FAQ */
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
        if (!isOpen) {
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
     SMOOTH ANCHOR SCROLLING
     ========================================================= */
  const anchorLinks =
    document.querySelectorAll(
      'a[href^="#"]'
    );
  anchorLinks.forEach((link) => {
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
          document.querySelector(targetId);
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
        const extraOffset = 18;
        const targetPosition =
          target.getBoundingClientRect().top +
          window.scrollY -
          headerHeight -
          announcementHeight -
          extraOffset;
        window.scrollTo({
          top: Math.max(
            targetPosition,
            0
          ),
          behavior:
            prefersReducedMotion
              ? "auto"
              : "smooth"
        });
      }
    );
  });
  /* =========================================================
     LOOP VISUAL
     ========================================================= */
  const loopVisual =
    document.querySelector(".hero-visual");
  const loopNodes =
    document.querySelectorAll(".loop-node");
  if (loopNodes.length) {
    let activeIndex = 0;
    const activateLoopNode = () => {
      loopNodes.forEach(
        (node, index) => {
          node.classList.toggle(
            "active",
            index === activeIndex
          );
        }
      );
      activeIndex =
        (activeIndex + 1) %
        loopNodes.length;
    };
    /* Start with the first stage */
    activateLoopNode();
    /* Automatic cycle */
    if (!prefersReducedMotion) {
      window.setInterval(
        activateLoopNode,
        2200
      );
    }
  }
  /* =========================================================
     HERO VISUAL MOUSE PARALLAX
     ========================================================= */
  if (
    loopVisual &&
    !prefersReducedMotion
  ) {
    const finePointer =
      window.matchMedia(
        "(pointer: fine)"
      ).matches;
    if (finePointer) {
      loopVisual.addEventListener(
        "mousemove",
        (event) => {
          const rect =
            loopVisual.getBoundingClientRect();
          const x =
            (event.clientX - rect.left) /
            rect.width -
            0.5;
          const y =
            (event.clientY - rect.top) /
            rect.height -
            0.5;
          loopVisual.style.setProperty(
            "--mouse-x",
            `${x * 12}px`
          );
          loopVisual.style.setProperty(
            "--mouse-y",
            `${y * 12}px`
          );
        }
      );
      loopVisual.addEventListener(
        "mouseleave",
        () => {
          loopVisual.style.setProperty(
            "--mouse-x",
            "0px"
          );
          loopVisual.style.setProperty(
            "--mouse-y",
            "0px"
          );
        }
      );
    }
  }
  /* =========================================================
     CUSTOM CURSOR
     ========================================================= */
  const cursorDot =
    document.querySelector(".cursor-dot");
  const cursorRing =
    document.querySelector(".cursor-ring");
  const finePointer =
    window.matchMedia(
      "(pointer: fine)"
    ).matches;
  if (
    cursorDot &&
    cursorRing &&
    finePointer &&
    !prefersReducedMotion
  ) {
    let mouseX = 0;
    let mouseY = 0;
    let ringX = 0;
    let ringY = 0;
    document.addEventListener(
      "mousemove",
      (event) => {
        mouseX = event.clientX;
        mouseY = event.clientY;
        cursorDot.style.transform =
          `translate3d(${mouseX}px, ${mouseY}px, 0)`;
      }
    );
    const animateCursor = () => {
      ringX +=
        (mouseX - ringX) * 0.15;
      ringY +=
        (mouseY - ringY) * 0.15;
      cursorRing.style.transform =
        `translate3d(${ringX}px, ${ringY}px, 0)`;
      requestAnimationFrame(
        animateCursor
      );
    };
    animateCursor();
    const interactiveElements =
      document.querySelectorAll(
        "a, button, .product-card, .loop-card, .about-card, .approach-step"
      );
    interactiveElements.forEach(
      (element) => {
        element.addEventListener(
          "mouseenter",
          () => {
            cursorRing.classList.add(
              "active"
            );
          }
        );
        element.addEventListener(
          "mouseleave",
          () => {
            cursorRing.classList.remove(
              "active"
            );
          }
        );
      }
    );
    document.addEventListener(
      "mouseleave",
      () => {
        cursorDot.style.opacity = "0";
        cursorRing.style.opacity = "0";
      }
    );
    document.addEventListener(
      "mouseenter",
      () => {
        cursorDot.style.opacity = "1";
        cursorRing.style.opacity = "1";
      }
    );
  }
  /* =========================================================
     KEYBOARD ACCESSIBILITY
     ========================================================= */
  document.addEventListener(
    "keydown",
    (event) => {
      /* Escape closes mobile menu */
      if (
        event.key === "Escape" &&
        mobileNav &&
        mobileMenuButton
      ) {
        mobileNav.classList.remove(
          "active"
        );
        mobileMenuButton.setAttribute(
          "aria-expanded",
          "false"
        );
        body.classList.remove(
          "menu-open"
        );
      }
    }
  );
  /* =========================================================
     CONSOLE BRANDING
     ========================================================= */
  console.log(
    "%cEvalLoop AI_",
    "color:#3ecf8e;font-family:monospace;font-size:18px;font-weight:bold;"
  );
  console.log(
    "%cBuild → Evaluate → Improve → Repeat",
    "color:#a4aaa6;font-family:monospace;font-size:11px;"
  );
})();
