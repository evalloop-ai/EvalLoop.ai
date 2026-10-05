(() => {
  "use strict";

  const SUPABASE_URL =
    "https://vonknmobshxkhbewdoie.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "YOUR_PUBLISHABLE_KEY";

  // --------------------------------------------------
  // Check Supabase library
  // --------------------------------------------------

  if (!window.supabase) {
    console.error(
      "EvalLoop AI: Supabase library was not loaded."
    );
    return;
  }

  const supabaseClient =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );

  // Make available to other page scripts if needed.
  window.evalLoopSupabase = supabaseClient;

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------

  function getInitials(name, email) {
    const value = (name || "").trim();

    if (value) {
      const parts = value.split(/\s+/);

      if (parts.length >= 2) {
        return (
          parts[0].charAt(0) +
          parts[parts.length - 1].charAt(0)
        ).toUpperCase();
      }

      return value.substring(0, 2).toUpperCase();
    }

    if (email) {
      return email.substring(0, 2).toUpperCase();
    }

    return "EL";
  }

  function getUserName(user) {
    if (!user) return "Account";

    const metadata = user.user_metadata || {};

    return (
      metadata.full_name ||
      metadata.name ||
      metadata.user_name ||
      user.email?.split("@")[0] ||
      "Account"
    );
  }

  function getAvatar(user) {
    if (!user) return null;

    const metadata = user.user_metadata || {};

    return (
      metadata.avatar_url ||
      metadata.picture ||
      null
    );
  }

  // --------------------------------------------------
  // Desktop auth state
  // --------------------------------------------------

  function updateDesktopAuth(user) {
    const loggedOut =
      document.getElementById("authLoggedOut");

    const loggedIn =
      document.getElementById("authLoggedIn");

    if (!loggedOut || !loggedIn) return;

    if (user) {
      const name = getUserName(user);
      const email = user.email || "";
      const initials = getInitials(name, email);
      const avatar = getAvatar(user);

      loggedOut.hidden = true;
      loggedIn.hidden = false;

      const profileName =
        document.getElementById("profileName");

      const profileEmail =
        document.getElementById("profileMenuEmail");

      const profileMenuName =
        document.getElementById("profileMenuName");

      const profileAvatar =
        document.getElementById("profileAvatar");

      const profileMenuAvatar =
        document.getElementById("profileMenuAvatar");

      if (profileName) {
        profileName.textContent = name;
      }

      if (profileMenuName) {
        profileMenuName.textContent = name;
      }

      if (profileEmail) {
        profileEmail.textContent = email;
      }

      if (profileAvatar) {
        if (avatar) {
          profileAvatar.innerHTML =
            `<img src="${avatar}" alt="">`;
        } else {
          profileAvatar.textContent = initials;
        }
      }

      if (profileMenuAvatar) {
        if (avatar) {
          profileMenuAvatar.innerHTML =
            `<img src="${avatar}" alt="">`;
        } else {
          profileMenuAvatar.textContent = initials;
        }
      }
    } else {
      loggedOut.hidden = false;
      loggedIn.hidden = true;
    }
  }

  // --------------------------------------------------
  // Mobile auth state
  // --------------------------------------------------

  function updateMobileAuth(user) {
    const loggedOut =
      document.getElementById("mobileAuthLoggedOut");

    const loggedIn =
      document.getElementById("mobileAuthLoggedIn");

    if (!loggedOut || !loggedIn) return;

    if (user) {
      const name = getUserName(user);
      const email = user.email || "";
      const initials = getInitials(name, email);
      const avatar = getAvatar(user);

      loggedOut.hidden = true;
      loggedIn.hidden = false;

      const nameElement =
        document.getElementById("mobileProfileName");

      const emailElement =
        document.getElementById("mobileProfileEmail");

      const avatarElement =
        document.getElementById("mobileProfileAvatar");

      if (nameElement) {
        nameElement.textContent = name;
      }

      if (emailElement) {
        emailElement.textContent = email;
      }

      if (avatarElement) {
        if (avatar) {
          avatarElement.innerHTML =
            `<img src="${avatar}" alt="">`;
        } else {
          avatarElement.textContent = initials;
        }
      }
    } else {
      loggedOut.hidden = false;
      loggedIn.hidden = true;
    }
  }

  // --------------------------------------------------
  // Complete auth state
  // --------------------------------------------------

  function setAuthState(user) {
    updateDesktopAuth(user);
    updateMobileAuth(user);

    window.evalLoopCurrentUser = user || null;

    window.dispatchEvent(
      new CustomEvent("evalloop-auth-change", {
        detail: {
          user: user || null
        }
      })
    );
  }

  // --------------------------------------------------
  // Profile dropdown
  // --------------------------------------------------

  function setupProfileMenu() {
    const trigger =
      document.getElementById("profileTrigger");

    const menu =
      document.getElementById("profileMenu");

    if (!trigger || !menu) return;

    function closeMenu() {
      trigger.setAttribute(
        "aria-expanded",
        "false"
      );

      menu.setAttribute(
        "aria-hidden",
        "true"
      );

      menu.classList.remove("is-open");
    }

    function openMenu() {
      trigger.setAttribute(
        "aria-expanded",
        "true"
      );

      menu.setAttribute(
        "aria-hidden",
        "false"
      );

      menu.classList.add("is-open");
    }

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();

      const isOpen =
        trigger.getAttribute("aria-expanded") ===
        "true";

      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    document.addEventListener("click", (event) => {
      if (
        !menu.contains(event.target) &&
        !trigger.contains(event.target)
      ) {
        closeMenu();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    });
  }

  // --------------------------------------------------
  // Sign out
  // --------------------------------------------------

  async function signOut() {
    try {
      const { error } =
        await supabaseClient.auth.signOut();

      if (error) {
        console.error(
          "EvalLoop AI: Sign out failed.",
          error
        );
        return;
      }

      window.location.href = "/";
    } catch (error) {
      console.error(
        "EvalLoop AI: Sign out error.",
        error
      );
    }
  }

  function setupLogout() {
    const desktopLogout =
      document.getElementById("profileLogout");

    const mobileLogout =
      document.getElementById("mobileProfileLogout");

    if (desktopLogout) {
      desktopLogout.addEventListener(
        "click",
        signOut
      );
    }

    if (mobileLogout) {
      mobileLogout.addEventListener(
        "click",
        signOut
      );
    }
  }

  // --------------------------------------------------
  // Initialize
  // --------------------------------------------------

  async function initializeAuth() {
    setupProfileMenu();
    setupLogout();

    const {
      data: {
        session
      },
      error
    } =
      await supabaseClient.auth.getSession();

    if (error) {
      console.error(
        "EvalLoop AI: Could not read session.",
        error
      );

      setAuthState(null);
      return;
    }

    setAuthState(
      session?.user || null
    );

    supabaseClient.auth.onAuthStateChange(
      (_event, session) => {
        setAuthState(
          session?.user || null
        );
      }
    );
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initializeAuth
    );
  } else {
    initializeAuth();
  }
})();
