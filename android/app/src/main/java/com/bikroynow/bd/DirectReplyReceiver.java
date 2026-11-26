package com.bikroynow.bd;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import androidx.core.app.NotificationCompat;
import androidx.core.app.RemoteInput;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class DirectReplyReceiver extends BroadcastReceiver {
    public static final String ACTION_DIRECT_REPLY = "com.bikroynow.bd.ACTION_DIRECT_REPLY";

    @Override
    public void onReceive(final Context context, Intent intent) {
        if (intent == null || !ACTION_DIRECT_REPLY.equals(intent.getAction())) {
            return;
        }

        Bundle remoteInput = RemoteInput.getResultsFromIntent(intent);
        if (remoteInput == null) return;

        final CharSequence replyText = remoteInput.getCharSequence(MainActivity.KEY_TEXT_REPLY);
        final String chatId = intent.getStringExtra("chat_id");

        if (replyText == null || replyText.toString().trim().isEmpty() || chatId == null || chatId.trim().isEmpty()) {
            return;
        }

        final SharedPreferences prefs = context.getSharedPreferences("bikroynow_prefs", Context.MODE_PRIVATE);
        final String userId = prefs.getString("user_id", null);
        if (userId == null || userId.trim().isEmpty()) {
            return;
        }

        final String textToSend = replyText.toString().trim();
        final NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        // 1. Instantly update notification shade to confirm the reply was recorded
        if (manager != null) {
            NotificationCompat.Builder repliedBuilder = new NotificationCompat.Builder(context.getApplicationContext(), MainActivity.CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle("BikroyNow")
                    .setContentText("✓ উত্তর পাঠানো হয়েছে: " + textToSend)
                    .setOnlyAlertOnce(true)
                    .setAutoCancel(true);
            manager.notify(MainActivity.BADGE_NOTIFICATION_ID, repliedBuilder.build());

            // Auto-dismiss confirmation notification after 3 seconds
            new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
                @Override
                public void run() {
                    try {
                        manager.cancel(MainActivity.BADGE_NOTIFICATION_ID);
                    } catch (Throwable ignored) {}
                }
            }, 3000);
        }

        // 2. Transmit message directly to backend in background thread
        new Thread(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection conn = null;
                try {
                    URL url = new URL("https://www.bikroynow.com/api/chats/" + chatId.trim() + "/messages");
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setConnectTimeout(8000);
                    conn.setReadTimeout(8000);
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                    conn.setRequestProperty("User-Agent", "BikroyNowNativeApp/1.0");
                    conn.setDoOutput(true);

                    JSONObject body = new JSONObject();
                    body.put("sender_id", userId.trim());
                    body.put("content", textToSend);

                    byte[] out = body.toString().getBytes(StandardCharsets.UTF_8);
                    conn.setFixedLengthStreamingMode(out.length);
                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(out);
                    }

                    conn.getResponseCode();
                } catch (Throwable t) {
                    t.printStackTrace();
                } finally {
                    if (conn != null) {
                        try { conn.disconnect(); } catch (Throwable ignored) {}
                    }
                }
            }
        }).start();
    }
}
