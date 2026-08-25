// In-memory persistent presence store for live user online/active status

if (!global.userPresence) {
  global.userPresence = new Map(); // key: userId/email/alias -> timestamp ms
}

export function recordUserHeartbeat(userId, email) {
  const now = Date.now();
  if (userId) {
    global.userPresence.set(String(userId), now);
  }
  if (email) {
    const cleanEmail = String(email).toLowerCase().trim();
    global.userPresence.set(cleanEmail, now);
    global.userPresence.set('user-' + cleanEmail.replace(/[^a-z0-9]/g, ''), now);
  }
}

export function getUserLastSeen(userId, email, fallbackIso = null) {
  let latestTimestamp = 0;

  if (userId && global.userPresence.has(String(userId))) {
    latestTimestamp = Math.max(latestTimestamp, global.userPresence.get(String(userId)));
  }

  if (email) {
    const cleanEmail = String(email).toLowerCase().trim();
    if (global.userPresence.has(cleanEmail)) {
      latestTimestamp = Math.max(latestTimestamp, global.userPresence.get(cleanEmail));
    }
    const userKey = 'user-' + cleanEmail.replace(/[^a-z0-9]/g, '');
    if (global.userPresence.has(userKey)) {
      latestTimestamp = Math.max(latestTimestamp, global.userPresence.get(userKey));
    }
  }

  if (latestTimestamp > 0) {
    return new Date(latestTimestamp).toISOString();
  }

  return fallbackIso || null;
}
