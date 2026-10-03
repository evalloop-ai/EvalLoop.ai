/* =========================================================
   EVALLOOP AI
   SHARED COMPONENT LOADER
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

  const headerContainer =
    document.getElementById("global-header");

  const footerContainer =
    document.getElementById("global-footer");


  /* =======================================================
     LOAD COMPONENT
     ======================================================= */

  async function loadComponent(container, file) {

    if (!container) {
      return;
    }

    try {

      const response =
        await fetch(file);

      if (!response.ok) {
        throw new Error(
          `Failed to load ${file}`
        );
      }

      const html =
        await response.text();

      container.innerHTML = html;

    } catch (error) {

      console.error(
        `EvalLoop AI component error:`,
        error
      );

    }

  }


  /* =======================================================
     LOAD HEADER + FOOTER
     ======================================================= */

  await Promise.all([

    loadComponent(
      headerContainer,
      "/components/header.html"
    ),

    loadComponent(
      footerContainer,
      "/components/footer.html"
    )

  ]);


  /* =======================================================
     INITIALIZE HEADER
     ======================================================= */

  initializeHeader();

});


/* =========================================================
   HEADER FUNCTIONALITY
   ========================================================= */

function initializeHeader() {


  /* =======================================================
     DESKTOP DROPDOWNS
     ======================================================= */

  const dropdowns =
    document.querySelectorAll(
      ".global-nav-dropdown"
    );


  dropdowns.forEach((dropdown) => {

    const trigger =
      dropdown.querySelector(
        ".global-nav-dropdown-trigger"
      );

    if (!trigger) {
      return;
    }


    trigger.addEventListener(
      "click",
      (event) => {

        event.stopPropagation();

        const isOpen =
          dropdown.classList.contains(
            "is-open"
          );


        /* Close other dropdowns */

        dropdowns.forEach((item) => {

          if (item !== dropdown) {

            item.classList.remove(
              "is-open"
            );

            const itemTrigger =
              item.querySelector(
                ".global-nav-dropdown-trigger"
              );

            if (itemTrigger) {

              itemTrigger.setAttribute(
                "aria-expanded",
                "false"
              );

            }

          }

        });


        /* Toggle current dropdown */

        dropdown.classList.toggle(
          "is-open",
          !isOpen
        );

        trigger.setAttribute(
          "aria-expanded",
          String(!isOpen)
        );

      }

    );

  });


  /* =======================================================
     CLOSE DESKTOP DROPDOWNS WHEN CLICKING OUTSIDE
     ======================================================= */

  document.addEventListener(
    "click",
    () => {

      dropdowns.forEach((dropdown) => {

        dropdown.classList.remove(
          "is-open"
        );

        const trigger =
          dropdown.querySelector(
            ".global-nav-dropdown-trigger"
          );

        if (trigger) {

          trigger.setAttribute(
            "aria-expanded",
            "false"
          );

        }

      });

    }
  );


  /* =======================================================
     MOBILE MENU
     ======================================================= */

  const mobileButton =
    document.getElementById(
      "globalMobileMenuButton"
    );

  const mobileNav =
    document.getElementById(
      "globalMobileNav"
    );


  if (
    mobileButton &&
    mobileNav
  ) {

    mobileButton.addEventListener(
      "click",
      () => {

        const isOpen =
          mobileButton.classList.contains(
            "is-open"
          );


        mobileButton.classList.toggle(
          "is-open",
          !isOpen
        );

        mobileNav.classList.toggle(
          "is-open",
          !isOpen
        );


        mobileButton.setAttribute(
          "aria-expanded",
          String(!isOpen)
        );

      }
    );

  }


  /* =======================================================
     MOBILE DROPDOWNS
     ======================================================= */

  const mobileDropdowns =
    document.querySelectorAll(
      ".global-mobile-nav-dropdown"
    );


  mobileDropdowns.forEach(
    (dropdown) => {

      const trigger =
        dropdown.querySelector(
          ".global-mobile-nav-dropdown-trigger"
        );


      if (!trigger) {
        return;
      }


      trigger.addEventListener(
        "click",
        () => {

          const isOpen =
            dropdown.classList.contains(
              "is-open"
            );


          /* Close other mobile dropdowns */

          mobileDropdowns.forEach(
            (item) => {

              if (item !== dropdown) {

                item.classList.remove(
                  "is-open"
                );

                const itemTrigger =
                  item.querySelector(
                    ".global-mobile-nav-dropdown-trigger"
                  );

                if (itemTrigger) {

                  itemTrigger.setAttribute(
                    "aria-expanded",
                    "false"
                  );

                }

              }

            }
          );


          /* Toggle current */

          dropdown.classList.toggle(
            "is-open",
            !isOpen
          );

          trigger.setAttribute(
            "aria-expanded",
            String(!isOpen)
          );

        }
      );

    }
  );


  /* =======================================================
     CLOSE MOBILE MENU AFTER NAVIGATION
     ======================================================= */

  const mobileLinks =
    document.querySelectorAll(
      ".global-mobile-nav a"
    );


  mobileLinks.forEach((link) => {

    link.addEventListener(
      "click",
      () => {

        if (
          mobileButton &&
          mobileNav
        ) {

          mobileButton.classList.remove(
            "is-open"
          );

          mobileNav.classList.remove(
            "is-open"
          );

          mobileButton.setAttribute(
            "aria-expanded",
            "false"
          );

        }

      }
    );

  });


  /* =======================================================
     ESCAPE KEY
     ======================================================= */

  document.addEventListener(
    "keydown",
    (event) => {

      if (event.key !== "Escape") {
        return;
      }


      /* Close desktop dropdowns */

      dropdowns.forEach(
        (dropdown) => {

          dropdown.classList.remove(
            "is-open"
          );

          const trigger =
            dropdown.querySelector(
              ".global-nav-dropdown-trigger"
            );

          if (trigger) {

            trigger.setAttribute(
              "aria-expanded",
              "false"
            );

          }

        }
      );


      /* Close mobile menu */

      if (
        mobileButton &&
        mobileNav
      ) {

        mobileButton.classList.remove(
          "is-open"
        );

        mobileNav.classList.remove(
          "is-open"
        );

        mobileButton.setAttribute(
          "aria-expanded",
          "false"
        );

      }

    }
  );

}
