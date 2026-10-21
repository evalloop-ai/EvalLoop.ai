
(() => {
  'use strict';

  // Keep these public values aligned with the existing EvalLoop AI login page.
  const SUPABASE_URL =
    'https://vonknmobshxkhbewdoie.supabase.co';

  const SUPABASE_PUBLISHABLE_KEY =
    'sb_publishable_J_eboKnioENyrRqnp8uTkg_5I9rrE8t';

  const page = document.body.dataset.page;
  const $ = (id) => document.getElementById(id);

  function notice(id, msg, type = 'success') {
    const el = $(id);

    if (el) {
      el.textContent = msg;
      el.className = 'notice ' + type;
      el.hidden = false;
    }
  }

  function hide(id) {
    if ($(id)) $(id).hidden = true;
  }

  if (!window.supabase) {
    notice(
      'pageNotice',
      'Supabase failed to load. Refresh and try again.',
      'error'
    );
    return;
  }

  const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === page) {
      a.classList.add('active');
    }
  });

  async function auth() {
    const {
      data: { session },
      error
    } = await db.auth.getSession();

    if (error || !session?.user) {
      location.replace(
        '/login/?next=' + encodeURIComponent(location.pathname)
      );
      return null;
    }

    return session;
  }

  function initials(value) {
    return (
      (value || 'EL')
        .trim()
        .split(/[\s@._-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('') || 'EL'
    );
  }

  $('logoutButton')?.addEventListener('click', async () => {
    const { error } = await db.auth.signOut();

    if (error) {
      notice(
        'pageNotice',
        'Could not log out. Please try again.',
        'error'
      );
    } else {
      location.replace('/login/');
    }
  });

  // ACCOUNT PAGE
  async function account(user) {
    $('summaryEmail').textContent = user.email || '';
    $('accountEmail').textContent = user.email || '—';

    $('createdAt').textContent = user.created_at
      ? new Date(user.created_at).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      : '—';

    let { data: profile, error } = await db
      .from('user_profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;

    if (!profile) {
      const result = await db
        .from('user_profiles')
        .upsert(
          {
            user_id: user.id,
            display_name:
              user.user_metadata?.display_name ||
              user.user_metadata?.full_name ||
              ''
          },
          { onConflict: 'user_id' }
        )
        .select()
        .single();

      if (result.error) throw result.error;
      profile = result.data;
    }

    const name = profile.display_name || '';

    $('displayName').value = name;
    $('summaryName').textContent = name || 'Your account';
    $('avatar').textContent = initials(name || user.email);

    $('displayName').addEventListener('input', () => {
      const value = $('displayName').value.trim();

      $('summaryName').textContent = value || 'Your account';
      $('avatar').textContent = initials(
        $('displayName').value || user.email
      );
    });

    $('profileForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      hide('profileNotice');

      const display_name = $('displayName').value.trim();

      if (!display_name) {
        notice(
          'profileNotice',
          'Enter a display name.',
          'error'
        );
        return;
      }

      const { error } = await db
        .from('user_profiles')
        .upsert(
          {
            user_id: user.id,
            display_name,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id' }
        );

      if (error) {
        notice('profileNotice', error.message, 'error');
      } else {
        notice('profileNotice', 'Profile changes saved.');
      }
    });
  }

  // SETTINGS PAGE
  async function settings(user) {
    let { data: settingsData, error } = await db
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;

    if (!settingsData) {
      const result = await db
        .from('user_settings')
        .upsert(
          { user_id: user.id },
          { onConflict: 'user_id' }
        )
        .select()
        .single();

      if (result.error) throw result.error;
      settingsData = result.data;
    }

    $('defaultType').value =
      settingsData.default_evaluation_type || 'general';

    $('responseStyle').value =
      settingsData.default_response_style || 'balanced';

    $('saveHistory').checked =
      settingsData.save_evaluation_history !== false;

    $('allowFeedback').checked =
      settingsData.allow_product_improvement_feedback === true;

    $('settingsForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      hide('settingsNotice');

      const row = {
        user_id: user.id,
        default_evaluation_type: $('defaultType').value,
        default_response_style: $('responseStyle').value,
        save_evaluation_history: $('saveHistory').checked,
        allow_product_improvement_feedback:
          $('allowFeedback').checked,
        updated_at: new Date().toISOString()
      };

      const { error } = await db
        .from('user_settings')
        .upsert(row, { onConflict: 'user_id' });

      if (error) {
        notice('settingsNotice', error.message, 'error');
      } else {
        notice(
          'settingsNotice',
          'Settings saved successfully.'
        );
      }
    });
  }

  // USAGE PAGE
  // Uses the existing shared quota endpoint.
  // Do not replace this with /api/profile-usage.
  async function usage(session) {
    const response = await fetch('/api/usage', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        Accept: 'application/json'
      },
      cache: 'no-store'
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        `Unable to load usage (HTTP ${response.status}).`
      );
    }

    // Support the existing API's response field names.
    const limitValue =
      data.limit ?? data.daily_limit ?? 35;

    const usedValue =
      data.used ?? data.used_count;

    const remainingValue =
      data.remaining ?? data.remaining_count;

    const limit = Number(limitValue);

    if (!Number.isFinite(limit) || limit <= 0) {
      throw new Error(
        'The usage API returned an invalid daily limit.'
      );
    }

    // Derive a missing value only when the API provides enough information.
    let used = Number(usedValue);
    let remaining = Number(remainingValue);

    if (!Number.isFinite(used) && Number.isFinite(remaining)) {
      used = Math.max(0, limit - remaining);
    }

    if (!Number.isFinite(remaining) && Number.isFinite(used)) {
      remaining = Math.max(0, limit - used);
    }

    if (!Number.isFinite(used) || !Number.isFinite(remaining)) {
      throw new Error(
        'The usage API response is missing used or remaining counts.'
      );
    }

    used = Math.max(0, used);
    remaining = Math.max(0, remaining);

    const percentage = Math.min(
      100,
      Math.round((used / limit) * 100)
    );

    $('usedCount').textContent = `${used} / ${limit}`;
    $('remainingCount').textContent = remaining;

    $('usagePercent').textContent =
      `${percentage}% of daily limit used`;

    $('usageProgressFill').style.width = `${percentage}%`;

    $('usageProgress').setAttribute('aria-valuenow', used);
    $('usageProgress').setAttribute('aria-valuemax', limit);

    const usageDate =
      data.date ||
      data.usage_date ||
      new Date().toISOString().slice(0, 10);

    $('usageDate').textContent = `${usageDate} · UTC`;

    const reset = new Date();
    reset.setUTCHours(24, 0, 0, 0);

    const minutesRemaining = Math.max(
      0,
      Math.floor((reset.getTime() - Date.now()) / 60000)
    );

    $('resetTime').textContent =
      `Resets in ${Math.floor(minutesRemaining / 60)}h ` +
      `${minutesRemaining % 60}m (UTC)`;

    // The shared quota tracks total usage, not per-tool totals.
    for (const key of ['general', 'compare', 'safety']) {
      const count = $(`${key}Count`);
      const bar = $(`${key}Bar`);

      if (count) count.textContent = '—';
      if (bar) bar.style.width = '0%';
    }

    notice(
      'usageNotice',
      'Your daily total is shared across General, Compare, and Safety. ' +
      'Per-tool totals are not currently recorded.',
      'info'
    );
  }

  // INITIALIZE THE CURRENT PAGE
  (async () => {
    try {
      const session = await auth();

      if (!session) return;

      if (page === 'account') {
        await account(session.user);
      }

      if (page === 'settings') {
        await settings(session.user);
      }

      if (page === 'usage') {
        await usage(session);
      }
    } catch (error) {
      console.error('EvalLoop profile page error:', error);

      const noticeId =
        page === 'account'
          ? 'profileNotice'
          : page === 'settings'
            ? 'settingsNotice'
            : 'usageNotice';

      notice(
        noticeId,
        error.message || 'Could not load this page. Please try again.',
        'error'
      );
    }
  })();

  db.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      location.replace('/login/');
    }
  });
})();
