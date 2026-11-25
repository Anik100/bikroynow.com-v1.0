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

public class BadgeSyncReceiver extends BroadcastReceiver {

    public static final String ACTION_SYNC_BADGE = "com.bikroynow.bd.ACTION_SYNC_BADGE";

    @Override
    public void onReceive(final Context context, Intent intent) {
        final SharedPreferences prefs = context.getSharedPreferences("bikroynow_prefs", Context.MODE_PRIVATE);
        final String userId = prefs.getString("user_id", null);

        if (userId == null || userId.trim().isEmpty()) {
            return;
        }

        // Perform lightweight network poll on background thread
        new Thread(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection conn = null;
                try {
                    String queryUrl = "https://www.bikroynow.com/api/chats/list?user_id=" +
                            URLEncoder.encode(userId.trim(), "UTF-8") + "&t=" + System.currentTimeMillis();

                    URL url = new URL(queryUrl);
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setConnectTimeout(8000);
                    conn.setReadTimeout(8000);
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

                            for (int i = 0; i < chats.length(); i++) {
                                JSONObject c = chats.getJSONObject(i);
                                int u = c.optInt("unreadCount", 0);
                                totalUnread += u;
                                if (u > 0 && latestContent == null) {
                                    JSONObject lastMsg = c.optJSONObject("lastMsg");
                                    if (lastMsg != null) {
                                        latestContent = lastMsg.optString("content", "নতুন মেসেজ এসেছে 💬");
                                    }
                                }
                            }

                            // Update launcher icon badge and native Android notification
                            MainActivity.updateBadgeFromContext(context, totalUnread, latestContent);
                        }
                    }
                } catch (Throwable t) {
                    // Suppress network drops silently in background
                } finally {
                    if (conn != null) {
                        try { conn.disconnect(); } catch (Throwable ignored) {}
                    }
                    // Schedule next check in 25 seconds
                    scheduleNext(context);
                }
            }
        }).start();
    }

    public static void scheduleNext(Context context) {
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

            long triggerAt = System.currentTimeMillis() + 25000; // 25 seconds
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
            } else {
                am.set(AlarmManager.RTC_WAKEUP, triggerAt, pi);
            }
        } catch (Throwable ignored) {}
    }
}
