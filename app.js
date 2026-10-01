/* =========================================================
   EVALLOOP AI
   Landing Page Interactions
   ========================================================= */


/* =========================================================
   PAGE PROGRESS
   ========================================================= */

const pageProgress = document.getElementById("pageProgress");

function updatePageProgress() {
  const scrollTop = window.scrollY;

  const documentHeight =
    document.documentElement.scrollHeight - window.innerHeight;

  if (documentHeight <= 0) {
    pageProgress.style.width = "0%";
    return;
  }

  const progress = (scrollTop / documentHeight) * 100;

  pageProgress.style.width = `${Math.min(progress, 100)}%`;
}

window.addEventListener("scroll", updatePageProgress, {
  passive: true
});

updatePageProgress();


/* =========================================================
   MOBILE MENU
   ========================================================= */

const mobileMenuButton =
  document.getElementById("mobileMenuButton");

const mobileNav =
  document.getElementById("mobileNav");

if (mobileMenuButton && mobileNav) {

  mobileMenuButton.addEventListener("click", () => {

    const isOpen =
      mobileMenuButton.classList.toggle("active");

    mobileNav.classList.toggle("active", isOpen);

    mobileMenuButton.setAttribute(
      "aria-expanded",
      String(isOpen)
    );

    document.body.classList.toggle(
      "menu-open",
      isOpen
    );

  });


  /* Close mobile menu after clicking a link */

  const mobileLinks =
    mobileNav.querySelectorAll("a");

  mobileLinks.forEach((link) => {

    link.addEventListener("click", () => {

      mobileMenuButton.classList.remove("active");

      mobileNav.classList.remove("active");

      mobileMenuButton.setAttribute(
        "aria-expanded",
        "false"
      );

      document.body.classList.remove(
        "menu-open"
      );

    });

  });

}


/* =========================================================
   SCROLL REVEAL
   ========================================================= */

const revealElements =
  document.querySelectorAll(".reveal");

const revealObserver =
  new IntersectionObserver(
    (entries, observer) => {

      entries.forEach((entry) => {

        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("visible");

        observer.unobserve(entry.target);

      });

    },
    {
      threshold: 0.12,
      rootMargin: "0px 0px -40px 0px"
    }
  );


revealElements.forEach((element) => {
  revealObserver.observe(element);
});


/* =========================================================
   FAQ ACCORDION
   ========================================================= */

const faqItems =
  document.querySelectorAll(".faq-item");

faqItems.forEach((item) => {

  const question =
    item.querySelector(".faq-question");

  if (!question) {
    return;
  }

  question.addEventListener("click", () => {

    const isCurrentlyActive =
      item.classList.contains("active");


    /* Close all FAQ items */

    faqItems.forEach((otherItem) => {
      otherItem.classList.remove("active");

      const otherQuestion =
        otherItem.querySelector(".faq-question");

      if (otherQuestion) {
        otherQuestion.setAttribute(
          "aria-expanded",
          "false"
        );
      }
    });


    /* Open clicked item */

    if (!isCurrentlyActive) {

      item.classList.add("active");

      question.setAttribute(
        "aria-expanded",
        "true"
      );

    }

  });

});


/* =========================================================
   CUSTOM CURSOR
   ========================================================= */

const cursorDot =
  document.getElementById("cursorDot");

const cursorRing =
  document.getElementById("cursorRing");

const finePointer =
  window.matchMedia("(pointer: fine)").matches;


if (finePointer && cursorDot && cursorRing) {

  let mouseX = 0;
  let mouseY = 0;

  let ringX = 0;
  let ringY = 0;


  document.addEventListener("mousemove", (event) => {

    mouseX = event.clientX;
    mouseY = event.clientY;

    cursorDot.style.left = `${mouseX}px`;
    cursorDot.style.top = `${mouseY}px`;

    cursorDot.style.opacity = "1";
    cursorRing.style.opacity = "1";

  });


  function animateCursor() {

    ringX += (mouseX - ringX) * 0.15;
    ringY += (mouseY - ringY) * 0.15;

    cursorRing.style.left = `${ringX}px`;
    cursorRing.style.top = `${ringY}px`;

    requestAnimationFrame(animateCursor);

  }

  animateCursor();


  /* Interactive cursor state */

  const interactiveElements =
    document.querySelectorAll(
      "a, button, .capability-card, .about-card, .process-step"
    );


  interactiveElements.forEach((element) => {

    element.addEventListener("mouseenter", () => {
      cursorRing.classList.add("active");
    });

    element.addEventListener("mouseleave", () => {
      cursorRing.classList.remove("active");
    });

  });


  document.addEventListener("mouseleave", () => {

    cursorDot.style.opacity = "0";
    cursorRing.style.opacity = "0";

  });


  document.addEventListener("mouseenter", () => {

    cursorDot.style.opacity = "1";
    cursorRing.style.opacity = "1";

  });

}


/* =========================================================
   SMOOTH ANCHOR HANDLING
   ========================================================= */

const anchorLinks =
  document.querySelectorAll('a[href^="#"]');

anchorLinks.forEach((link) => {

  link.addEventListener("click", (event) => {

    const targetId =
      link.getAttribute("href");

    if (
      !targetId ||
      targetId === "#" ||
      targetId.length < 2
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
      document.querySelector(".site-header");

    const headerHeight =
      header ? header.offsetHeight : 0;

    const announcement =
      document.querySelector(".announcement-bar");

    const announcementHeight =
      announcement
        ? announcement.offsetHeight
        : 0;

    const offset =
      headerHeight + announcementHeight + 15;

    const targetPosition =
      target.getBoundingClientRect().top +
      window.scrollY -
      offset;

    window.scrollTo({
      top: targetPosition,
      behavior: "smooth"
    });

  });

});


/* =========================================================
   HERO ORB MOUSE PARALLAX
   ========================================================= */

const heroVisual =
  document.querySelector(".hero-visual");

const heroOrb =
  document.querySelector(".evaluation-orb");

if (
  heroVisual &&
  heroOrb &&
  finePointer &&
  !window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches
) {

  heroVisual.addEventListener(
    "mousemove",
    (event) => {

      const rect =
        heroVisual.getBoundingClientRect();

      const x =
        (event.clientX - rect.left) /
        rect.width;

      const y =
        (event.clientY - rect.top) /
        rect.height;

      const moveX =
        (x - 0.5) * 12;

      const moveY =
        (y - 0.5) * 12;

      heroOrb.style.transform =
        `translate(${moveX}px, ${moveY}px)`;

    }
  );


  heroVisual.addEventListener(
    "mouseleave",
    () => {

      heroOrb.style.transform =
        "translate(0, 0)";

    }
  );

}


/* =========================================================
   QUALITY METER
   ========================================================= */

const qualityMeter =
  document.querySelector(".quality-meter-fill");

if (qualityMeter) {

  qualityMeter.style.transformOrigin =
    "left center";

  qualityMeter.style.transform =
    "scaleX(0)";

  const meterObserver =
    new IntersectionObserver(
      (entries, observer) => {

        entries.forEach((entry) => {

          if (!entry.isIntersecting) {
            return;
          }

          qualityMeter.style.transition =
            "transform 1.2s cubic-bezier(.22,.61,.36,1)";

          qualityMeter.style.transform =
            "scaleX(1)";

          observer.unobserve(entry.target);

        });

      },
      {
        threshold: 0.4
      }
    );

  meterObserver.observe(qualityMeter);

}


/* =========================================================
   SCORE BAR ANIMATION
   ========================================================= */

const scoreBars =
  document.querySelectorAll(".score-bar span");

if (scoreBars.length) {

  scoreBars.forEach((bar) => {

    const finalWidth =
      bar.style.width;

    bar.style.width = "0%";

    const observer =
      new IntersectionObserver(
        (entries, observerInstance) => {

          entries.forEach((entry) => {

            if (!entry.isIntersecting) {
              return;
            }

            bar.style.transition =
              "width 1.1s cubic-bezier(.22,.61,.36,1)";

            bar.style.width =
              finalWidth;

            observerInstance.unobserve(
              entry.target
            );

          });

        },
        {
          threshold: 0.5
        }
      );

    observer.observe(bar);

  });

}


/* =========================================================
   YEAR
   ========================================================= */

const yearElements =
  document.querySelectorAll(
    "[data-current-year]"
  );

yearElements.forEach((element) => {

  element.textContent =
    new Date().getFullYear();

});


/* =========================================================
   CONSOLE BRAND MESSAGE
   ========================================================= */

console.log(
  "%cEvalLoop AI_",
  "color:#3ecf8e;font-family:monospace;font-size:18px;"
);

console.log(
  "%cAI Evaluation & LLM Quality Platform",
  "color:#a4aaa6;font-family:monospace;font-size:11px;"
);
