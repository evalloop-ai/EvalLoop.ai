/* =========================================================
EVALLOOP AI
MAIN JAVASCRIPT
========================================================= */

(() => {
“use strict”;

/* =======================================================
ELEMENTS
======================================================= */

const body = document.body;

const cursorDot =
document.querySelector(”.cursor-dot”);

const cursorRing =
document.querySelector(”.cursor-ring”);

const pageProgress =
document.querySelector(”.page-progress”);

const menuToggle =
document.getElementById(“menuToggle”);

const mobileNav =
document.getElementById(“mobileNav”);

/* =======================================================
REDUCED MOTION
======================================================= */

const reducedMotion =
window.matchMedia(
“(prefers-reduced-motion: reduce)”
).matches;

/* =======================================================
CUSTOM CURSOR
======================================================= */

const finePointer =
window.matchMedia(
“(pointer: fine)”
).matches;

if (
finePointer &&
cursorDot &&
cursorRing
) {

let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let ringX = mouseX;
let ringY = mouseY;
let cursorStarted = false;
/* -----------------------------------------------------
   Mouse position
   ----------------------------------------------------- */
window.addEventListener(
  "mousemove",
  (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (!cursorStarted) {
      cursorStarted = true;
      body.classList.add(
        "cursor-active"
      );
    }
    cursorDot.style.left =
      `${mouseX}px`;
    cursorDot.style.top =
      `${mouseY}px`;
  },
  {
    passive: true
  }
);
/* -----------------------------------------------------
   Smooth ring movement
   ----------------------------------------------------- */
const animateCursor = () => {
  const easing = reducedMotion
    ? 1
    : 0.16;
  ringX +=
    (mouseX - ringX) * easing;
  ringY +=
    (mouseY - ringY) * easing;
  cursorRing.style.left =
    `${ringX}px`;
  cursorRing.style.top =
    `${ringY}px`;
  requestAnimationFrame(
    animateCursor
  );
};
animateCursor();
/* -----------------------------------------------------
   Interactive cursor states
   ----------------------------------------------------- */
const interactiveElements =
  document.querySelectorAll(
    "a, button, summary, input, textarea, select"
  );
interactiveElements.forEach(
  (element) => {
    element.addEventListener(
      "mouseenter",
      () => {
        body.classList.add(
          "cursor-hover"
        );
      }
    );
    element.addEventListener(
      "mouseleave",
      () => {
        body.classList.remove(
          "cursor-hover"
        );
      }
    );
  }
);
/* -----------------------------------------------------
   Hide cursor when leaving page
   ----------------------------------------------------- */
document.addEventListener(
  "mouseleave",
  () => {
    body.classList.remove(
      "cursor-active"
    );
  }
);
document.addEventListener(
  "mouseenter",
  () => {
    if (cursorStarted) {
      body.classList.add(
        "cursor-active"
      );
    }
  }
);

}

/* =======================================================
PAGE SCROLL PROGRESS
======================================================= */

const updateProgress = () => {

if (!pageProgress) {
  return;
}
const scrollTop =
  window.scrollY || window.pageYOffset;
const documentHeight =
  document.documentElement.scrollHeight;
const viewportHeight =
  window.innerHeight;
const scrollable =
  documentHeight - viewportHeight;
if (scrollable <= 0) {
  pageProgress.style.width =
    "100%";
  return;
}
const progress =
  Math.min(
    100,
    Math.max(
      0,
      (scrollTop / scrollable) * 100
    )
  );
pageProgress.style.width =
  `${progress}%`;

};

window.addEventListener(
“scroll”,
updateProgress,
{
passive: true
}
);

window.addEventListener(
“resize”,
updateProgress,
{
passive: true
}
);

updateProgress();

/* =======================================================
SCROLL REVEAL
======================================================= */

const revealElements =
document.querySelectorAll(
“.reveal”
);

if (
reducedMotion ||
!(“IntersectionObserver” in window)
) {

revealElements.forEach(
  (element) => {
    element.classList.add(
      "visible"
    );
  }
);

} else {

const revealObserver =
  new IntersectionObserver(
    (entries, observer) => {
      entries.forEach(
        (entry) => {
          if (!entry.isIntersecting) {
            return;
          }
          entry.target.classList.add(
            "visible"
          );
          observer.unobserve(
            entry.target
          );
        }
      );
    },
    {
      threshold: 0.12,
      rootMargin:
        "0px 0px -40px 0px"
    }
  );
revealElements.forEach(
  (element) => {
    revealObserver.observe(
      element
    );
  }
);

}

/* =======================================================
MOBILE NAVIGATION
======================================================= */

if (
menuToggle &&
mobileNav
) {

const closeMobileMenu = () => {
  menuToggle.classList.remove(
    "active"
  );
  mobileNav.classList.remove(
    "open"
  );
  menuToggle.setAttribute(
    "aria-expanded",
    "false"
  );
  menuToggle.setAttribute(
    "aria-label",
    "Open navigation menu"
  );
  mobileNav.setAttribute(
    "aria-hidden",
    "true"
  );
};
const openMobileMenu = () => {
  menuToggle.classList.add(
    "active"
  );
  mobileNav.classList.add(
    "open"
  );
  menuToggle.setAttribute(
    "aria-expanded",
    "true"
  );
  menuToggle.setAttribute(
    "aria-label",
    "Close navigation menu"
  );
  mobileNav.setAttribute(
    "aria-hidden",
    "false"
  );
};
/* -----------------------------------------------------
   Toggle menu
   ----------------------------------------------------- */
menuToggle.addEventListener(
  "click",
  () => {
    const isOpen =
      menuToggle.getAttribute(
        "aria-expanded"
      ) === "true";
    if (isOpen) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  }
);
/* -----------------------------------------------------
   Close after clicking navigation link
   ----------------------------------------------------- */
const mobileLinks =
  mobileNav.querySelectorAll(
    "a"
  );
mobileLinks.forEach(
  (link) => {
    link.addEventListener(
      "click",
      () => {
        closeMobileMenu();
      }
    );
  }
);
/* -----------------------------------------------------
   Close with Escape
   ----------------------------------------------------- */
document.addEventListener(
  "keydown",
  (event) => {
    if (
      event.key === "Escape"
    ) {
      closeMobileMenu();
      menuToggle.blur();
    }
  }
);
/* -----------------------------------------------------
   Close when switching back to desktop
   ----------------------------------------------------- */
window.addEventListener(
  "resize",
  () => {
    if (
      window.innerWidth > 900
    ) {
      closeMobileMenu();
    }
  }
);

}

/* =======================================================
SMOOTH ANCHOR NAVIGATION
======================================================= */

const anchorLinks =
document.querySelectorAll(
‘a[href^=”#”]’
);

anchorLinks.forEach(
(link) => {

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
      const offset =
        headerHeight +
        announcementHeight +
        18;
      const targetPosition =
        target.getBoundingClientRect().top +
        window.scrollY -
        offset;
      window.scrollTo({
        top: Math.max(
          0,
          targetPosition
        ),
        behavior:
          reducedMotion
            ? "auto"
            : "smooth"
      });
    }
  );
}

);

/* =======================================================
FAQ
======================================================= */

const faqItems =
document.querySelectorAll(
“.faq-item”
);

faqItems.forEach(
(item) => {

  item.addEventListener(
    "toggle",
    () => {
      if (!item.open) {
        return;
      }
      faqItems.forEach(
        (otherItem) => {
          if (
            otherItem !== item &&
            otherItem.open
          ) {
            otherItem.open = false;
          }
        }
      );
    }
  );
}

);

/* =======================================================
INITIAL PAGE STATE
======================================================= */

requestAnimationFrame(
() => {

  document.documentElement.classList.add(
    "page-ready"
  );
}

);

})();
