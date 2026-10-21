
(() => {
  'use strict';

  const SUPABASE_URL =
    'https://vonknmobshxkhbewdoie.supabase.co';

  const SUPABASE_PUBLISHABLE_KEY =
    'sb_publishable_J_eboKnioENyrRqnp8uTkg_5I9rrE8t';

  const page = document.body.dataset.page;
  const $ = (id) => document.getElementById(id);

  function notice(id, message, type = 'success') {
    const element = $(id);
    if (!element) return;

    element.textContent = message;
    element.className = `notice ${type}`;
    element.hidden = false;
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

  document.querySelectorAll('[data-nav]').forEach((link) => {
    if (link.dataset.nav === page) {
      link.classList.add('active');
    }
  });

  async function getSession() {
    const { data, error } = await db.auth.getSession();

    if (error || !data.session?.user) {
      location.replace(
        '/login/?next=' + encodeURIComponent(location.pathname)
      );
      return null;
    }

    return data.session;
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
      notice('pageNotice', 'Could not log out. Please try again.', 'error');
      return;
    }

    location.replace('/login/');
  });

  // ACCOUNT
  async function loadAccount(user) {
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
        .upsert({
          user_id: user.id,
          display_name:
            user.user_metadata?.display_name ||
            user.user_metadata?.full_name ||
            ''
        }, { onConflict: 'user_id' })
        .select()
        .single();

      if (result.error) throw result.error;
      profile = result.data;
    }

    $('displayName').value = profile.display_name || '';
    $('summaryName').textContent =
      profile.display_name || 'Your account';
    $('avatar').textContent = initials(
      profile.display_name || user.email
    );

    $('displayName').addEventListener('input', () => {
      $('summaryName').textContent =
        $('displayName').value.trim() || 'Your account';

      $('avatar').textContent = initials(
        $('displayName').value || user.email
      );
    });

    $('profileForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      hide('profileNotice');

      const display_name = $('displayName').value.trim();

      if (!display_name) {
        notice('profileNotice', 'Enter a display name.', 'error');
        return;
      }

      const { error } = await db
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          display_name,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) {
        notice('profileNotice', error.message, 'error');
        return;
      }

      notice('profileNotice', 'Profile changes saved.');
    });
  }

  // SETTINGS
  async function loadSettings(user) {
    let { data: settings, error } = await db
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;

    if (!settings) {
      const result = await db
        .from('user_settings')
        .upsert({ user_id: user.id }, { onConflict: 'user_id' })
        .select()
        .single();

      if (result.error) throw result.error;
      settings = result.data;
    }

    $('defaultType').value =
      settings.default_evaluation_type || 'general';

    $('responseStyle').value =
      settings.default_response_style || 'balanced';

    $('saveHistory').checked =
      settings.save_evaluation_history !== false;

    $('allowFeedback').checked =
      settings.allow_product_improvement_feedback === true;

    $('settingsForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      hide('settingsNotice');

      const row = {
        user_id: user.id,
        default_evaluation_type: $('defaultType').value,
        default_response_style: $('responseStyle').value,
        save_evaluation_history: $('saveHistory').checked,
        allow_product_improvement_feedback: $('allowFeedback').checked,
        updated_at: new Date().toISOString()
      };

      const { error } = await db
        .from('user_settings')
        .upsert(row, { onConflict: 'user_id' });

      if (error) {
        notice('settingsNotice', error.message, 'error');
        return;
      }

      notice('settingsNotice', 'Settings saved successfully.');
    });
  }

  // USAGE — use the existing shared quota endpoint.
  // Do not call /api/profile-usage here.
  async function loadUsage(session) {
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

    const limit = Number(data.limit ?? data.daily_limit ?? 35);

    let used = Number(data.used ?? data.used_count);
    let remaining = Number(
      data.remaining ?? data.remaining_count
    );

    if (!Number.isFinite(limit) || limit <= 0) {
      throw new Error('The usage API returned an invalid daily limit.');
    }

    if (!Number.isFinite(used) && Number.isFinite(remaining)) {
      used = limit - remaining;
    }

    if (!Number.isFinite(remaining) && Number.isFinite(used)) {
      remaining = limit - used;
    }

    if (!Number.isFinite(used) || !Number.isFinite(remaining)) {
      throw new Error(
        'The usage API response is missing usage counts.'
      );
    }

    used = Math.max(0, used);
    remaining = Math.max(0, remaining);

    const percentage = Math.min(
      100,
      Math.round((used / limit) * 100)
    );

    $('usedCount').textContent = `${used} / ${limit}`;
    $('remainingCount').textContent = String(remaining);
    $('usagePercent').textContent =
      `${percentage}% of daily limit used`;

    $('usageProgressFill').style.width = `${percentage}%`;
    $('usageProgress').setAttribute('aria-valuenow', String(used));
    $('usageProgress').setAttribute('aria-valuemax', String(limit));

    const date =
      data.date ||
      data.usage_date ||
      new Date().toISOString().slice(0, 10);

    $('usageDate').textContent = `${date} · UTC`;

    const reset = new Date();
    reset.setUTCHours(24, 0, 0, 0);

    const minutes = Math.max(
      0,
      Math.floor((reset.getTime() - Date.now()) / 60000)
    );

    $('resetTime').textContent =
      `Resets in ${Math.floor(minutes / 60)}h ${minutes % 60}m (UTC)`;

    // The shared usage endpoint reports total quota usage, not
    // separate totals for each evaluation tool.
    for (const key of ['general', 'compare', 'safety']) {
      const count = $(`${key}Count`);
      const bar = $(`${key}Bar`);

      if (count) count.textContent = '—';
      if (bar) bar.style.width = '0%';
    }

    notice(
      'usageNotice',
      'Daily usage is shared across General, Compare, and Safety. ' +
      'Separate per-tool totals are not available from the shared quota endpoint.',
      'info'
    );
  }

  // INITIALIZE
  (async () => {
    try {
      const session = await getSession();
      if (!session) return;

      if (page === 'account') await loadAccount(session.user);
      if (page === 'settings') await loadSettings(session.user);
      if (page === 'usage') await loadUsage(session);
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

  db.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      location.replace('/login/');
    }
  });
})();
