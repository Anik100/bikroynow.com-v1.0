package com.bikroynow.bd;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.concurrent.atomic.AtomicBoolean;

public class BadgeSyncReceiver extends BroadcastReceiver {

    public static final String ACTION_SYNC_BADGE = "com.bikroynow.bd.ACTION_SYNC_BADGE";
    private static final AtomicBoolean isSyncing = new AtomicBoolean(false);

    @Override
    public void onReceive(final Context context, Intent intent) {
        performSync(context);
    }

    public static void performSync(final Context context) {
        if (context == null) return;
        final SharedPreferences prefs = context.getSharedPreferences("bikroynow_prefs", Context.MODE_PRIVATE);
        final String userId = prefs.getString("user_id", null);

        if (userId == null || userId.trim().isEmpty()) {
            scheduleNext(context);
            return;
        }

        if (!isSyncing.compareAndSet(false, true)) {
            return;
        }

        new Thread(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection conn = null;
                try {
                    String queryUrl = "https://www.bikroynow.com/api/chats/list?user_id=" +
                            URLEncoder.encode(userId.trim(), "UTF-8") + "&t=" + System.currentTimeMillis();

                    URL url = new URL(queryUrl);
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setConnectTimeout(5000);
                    conn.setReadTimeout(5000);
                    conn.setRequestMethod("GET");
                    conn.setRequestProperty("User-Agent", "BikroyNowNativeApp/1.0");

                    if (conn.getResponseCode() == 200) {
                        BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                        StringBuilder sb = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) {
                            sb.append(line);
                        }
                        reader.close();

                        JSONObject json = new JSONObject(sb.toString());
                        if (json.has("chats")) {
                            JSONArray chats = json.getJSONArray("chats");
                            int totalUnread = 0;
                            String latestContent = null;
                            String targetChatId = null;
                            String latestMsgId = null;
                            String targetPartnerName = null;

                            for (int i = 0; i < chats.length(); i++) {
                                JSONObject c = chats.getJSONObject(i);
                                int u = c.optInt("unreadCount", 0);
                                totalUnread += u;
                                if (u > 0 && latestContent == null) {
                                    targetChatId = c.optString("id", null);
                                    JSONObject partner = c.optJSONObject("partner");
                                    if (partner != null) {
                                        targetPartnerName = partner.optString("name", partner.optString("fullName", "BikroyNow"));
                                    }
                                    JSONObject lastMsg = c.optJSONObject("lastMsg");
                                    if (lastMsg != null) {
                                        latestMsgId = lastMsg.optString("id", lastMsg.optString("created_at", ""));
                                        latestContent = lastMsg.optString("content", "নতুন মেসেজ এসেছে 💬");
                                    }
                                }
                            }

                            if (totalUnread <= 0) {
                                // No unread messages: clear stored notification key and remove notification
                                prefs.edit().remove("last_notified_msg_key").apply();
                                MainActivity.updateBadgeFromContext(context, 0, null, null, null);
                            } else {
                                // Construct unique fingerprint for the newest message: chat + msgId + count
                                String currentMsgKey = (targetChatId != null ? targetChatId : "") + "_" +
                                        (latestMsgId != null ? latestMsgId : "") + "_" + totalUnread;
                                String lastNotifiedKey = prefs.getString("last_notified_msg_key", "");

                                if (!currentMsgKey.equals(lastNotifiedKey)) {
                                    // New message arrived! Alert immediately
                                    prefs.edit().putString("last_notified_msg_key", currentMsgKey).apply();
                                    MainActivity.updateBadgeFromContext(context, totalUnread, latestContent, targetChatId, targetPartnerName);
                                } else {
                                    // Same unread message already notified: keep app icon badge synced without ringing/vibrating again
                                    try {
                                        me.leolin.shortcutbadger.ShortcutBadger.applyCount(context.getApplicationContext(), totalUnread);
                                    } catch (Throwable ignored) {}
                                }
                            }
                        }
                    }
                } catch (Throwable ignored) {
                    // Suppress network drops silently in background
                } finally {
                    isSyncing.set(false);
                    if (conn != null) {
                        try { conn.disconnect(); } catch (Throwable ignored) {}
                    }
                    scheduleNext(context);
                }
            }
        }).start();
    }

    public static void scheduleNext(Context context) {
        if (context == null) return;
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;

            Intent intent = new Intent(context, BadgeSyncReceiver.class);
            intent.setAction(ACTION_SYNC_BADGE);

            PendingIntent pi = PendingIntent.getBroadcast(
                    context,
                    100,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            // Fast 8-second interval when app is closed / in background
            long triggerAt = System.currentTimeMillis() + 8000;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                am.setAlarmClock(new AlarmManager.AlarmClockInfo(triggerAt, pi), pi);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pi);
            }
        } catch (Throwable ignored) {}
    }
}
