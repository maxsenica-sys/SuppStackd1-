const CACHE = 'suppstackd-sw-v5';
const NOTIF_STORE = 'suppstackd_sw_notifs';

// Listen for messages from the main app
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_NOTIFS') {
    // Store supplement data in cache storage for later use
    caches.open(NOTIF_STORE).then(cache => {
      cache.put('/__sw_data__', new Response(JSON.stringify(e.data.payload)));
    });
    scheduleNotifs(e.data.payload);
  }
});

// On SW activation, reload stored data and reschedule
// Reschedule notifs on activate (notif data reload)
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.open(NOTIF_STORE).then(cache =>
      cache.match('/__sw_data__').then(res => {
        if (res) res.json().then(data => scheduleNotifs(data));
      })
    )
  );
});

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(['/']))
  );
});

self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
  }
});

// Purge old caches on activate
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== NOTIF_STORE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Clear old timers map on each schedule call
const timers = [];
function scheduleNotifs(data) {
  // Clear any existing timers
  timers.forEach(t => clearTimeout(t));
  timers.length = 0;

  const { supplements, scheduledTime } = data;
  if (!supplements || !supplements.length) return;

  const now = Date.now();

  // ── Daily log reminder at scheduled time ──
  if (scheduledTime && scheduledTime > now) {
    timers.push(setTimeout(() => {
      caches.open(NOTIF_STORE).then(cache =>
        cache.match('/__sw_data__').then(res => {
          if (!res) return;
          res.json().then(d => {
            const unlogged = (d.supplements || []).filter(s => s.lastLogged !== d.todayStr);
            if (unlogged.length > 0) {
              self.registration.showNotification('Suppstackd', {
                body: unlogged.length === 1
                  ? unlogged[0].name + ' not logged today.'
                  : unlogged.length + ' supplements not logged today.',
                tag: 'suppstackd-daily',
                silent: false
              });
            }
          });
        })
      );
    }, scheduledTime - now));
  }

  // ── Low stock alerts — fire after short delay on load ──
  const critical = supplements.filter(s => {
    if (!s.totalAmount || !s.servingSize || !s.servingsPerDay) return false;
    const rem = (s.totalAmount || 0) - (s.consumed || 0);
    const daysLeft = rem <= 0 ? 0 : Math.ceil(rem / (s.servingSize * s.servingsPerDay));
    return daysLeft >= 0 && daysLeft <= 7;
  });

  if (critical.length > 0) {
    // Only fire if not already shown today
    const todayKey = new Date().toISOString().slice(0, 10);
    caches.open(NOTIF_STORE).then(cache =>
      cache.match('/__sw_lastLowAlert__').then(res => {
        if (res) {
          res.text().then(t => {
            if (t === todayKey) return; // already shown today
            sendLowStockNotif(cache, critical, todayKey);
          });
        } else {
          sendLowStockNotif(cache, critical, todayKey);
        }
      })
    );
  }
}

function sendLowStockNotif(cache, critical, todayKey) {
  cache.put('/__sw_lastLowAlert__', new Response(todayKey));
  timers.push(setTimeout(() => {
    const names = critical.map(s => {
      const rem = (s.totalAmount || 0) - (s.consumed || 0);
      const d = rem <= 0 ? 0 : Math.ceil(rem / (s.servingSize * s.servingsPerDay));
      return s.name + ' (' + d + 'd)';
    }).join(', ');
    const body = critical.length === 1
      ? critical[0].name + ' — approx ' + (Math.ceil(((critical[0].totalAmount||0)-(critical[0].consumed||0))/(critical[0].servingSize*critical[0].servingsPerDay))) + ' days left. Time to reorder.'
      : critical.length + ' supps running low: ' + names;
    self.registration.showNotification('Suppstackd — Low stock', {
      body,
      tag: 'suppstackd-lowstock',
      silent: false
    });
  }, 2000));
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/'));
});
