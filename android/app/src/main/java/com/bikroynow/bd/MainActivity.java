package com.bikroynow.bd;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import androidx.core.app.NotificationCompat;
import me.leolin.shortcutbadger.ShortcutBadger;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.RelativeLayout;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends AppCompatActivity {

    private static final String APP_URL = "https://www.bikroynow.com";
    private static final int FILE_CHOOSER_RESULT_CODE = 1001;
    private static final int PERMISSIONS_REQUEST_CODE = 1002;

    private WebView mWebView;
    private ProgressBar mProgressBar;
    private SwipeRefreshLayout mSwipeRefresh;
    private RelativeLayout mSplashLayout;
    private LinearLayout mErrorLayout;
    private Button mBtnRetry;
    private ValueCallback<Uri[]> mFilePathCallback;

    private boolean isSplashDismissed = false;
    private long splashLaunchTime;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Configure full native light status bar (crisp white background with dark system icons)
        setupNativeStatusBar();

        setContentView(R.layout.activity_main);

        mWebView = findViewById(R.id.webView);
        mProgressBar = findViewById(R.id.progressBar);
        mSwipeRefresh = findViewById(R.id.swipeRefresh);
        mSplashLayout = findViewById(R.id.splashLayout);
        mErrorLayout = findViewById(R.id.errorLayout);
        mBtnRetry = findViewById(R.id.btnRetry);

        splashLaunchTime = System.currentTimeMillis();
        mSplashLayout.setVisibility(View.VISIBLE);

        final ProgressBar splashLoader = findViewById(R.id.splashLoader);
        if (mSplashLayout != null && splashLoader != null) {
            mSplashLayout.post(new Runnable() {
                @Override
                public void run() {
                    int layoutHeight = mSplashLayout.getHeight();
                    int layoutWidth = mSplashLayout.getWidth();
                    if (layoutHeight > 0 && layoutWidth > 0) {
                        float targetX = (layoutWidth - splashLoader.getWidth()) / 2f;
                        float targetY = (layoutHeight * 0.79125f) - (splashLoader.getHeight() / 2f);
                        splashLoader.setX(targetX);
                        splashLoader.setY(targetY);
                    }
                }
            });
        }

        setupPullToRefresh();
        initWebView();
        initNotificationChannel();
        checkAndRequestPermissions();

        // Safety timeout: smoothly dismiss splash after 3.5s if network is exceptionally slow
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                dismissSplash();
            }
        }, 3500);

        mBtnRetry.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                mErrorLayout.setVisibility(View.GONE);
                mWebView.setVisibility(View.VISIBLE);
                mWebView.reload();
            }
        });

        // Handle initial deep link if app opened via intent
        if (getIntent() != null && getIntent().getData() != null) {
            handleDeepLink(getIntent());
        } else if (savedInstanceState == null) {
            mWebView.loadUrl(APP_URL);
        } else {
            mWebView.restoreState(savedInstanceState);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleDeepLink(intent);
    }

    private void handleDeepLink(Intent intent) {
        if (intent == null) return;

        if (intent.hasExtra("target_url")) {
            String target = intent.getStringExtra("target_url");
            if (target != null && !target.isEmpty()) {
                if (mWebView != null) {
                    mWebView.loadUrl(APP_URL + target);
                }
                return;
            }
        }

        Uri data = intent.getData();
        if (data == null) return;

        String uriStr = data.toString();

        // Check for login callback (custom scheme or https auth/callback)
        if (uriStr.startsWith("bikroynow://login-callback") ||
            uriStr.startsWith("io.supabase.bikroynow://login-callback") ||
            uriStr.contains("bikroynow.com/auth/callback")) {

            String fragment = data.getFragment();
            String query = data.getQuery();

            String targetUrl = APP_URL + "/";
            if (fragment != null && !fragment.isEmpty()) {
                targetUrl += "#" + fragment;
            } else if (query != null && !query.isEmpty()) {
                targetUrl += "?" + query;
            }

            // Immediately clear any error screen and reveal WebView
            if (mErrorLayout != null) {
                mErrorLayout.setVisibility(View.GONE);
            }
            if (mWebView != null) {
                mWebView.setVisibility(View.VISIBLE);
                mWebView.loadUrl(targetUrl);
            }
            return;
        }

        if (uriStr.startsWith("http://") || uriStr.startsWith("https://")) {
            if (mErrorLayout != null) {
                mErrorLayout.setVisibility(View.GONE);
            }
            if (mWebView != null) {
                mWebView.setVisibility(View.VISIBLE);
                mWebView.loadUrl(uriStr);
            }
        }
    }

    private void setupNativeStatusBar() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Window window = getWindow();
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(Color.WHITE);
            View decor = window.getDecorView();
            decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }
    }

    private void setupPullToRefresh() {
        mSwipeRefresh.setEnabled(false); // Disabled initially while splash is visible
        mSwipeRefresh.setColorSchemeColors(
                Color.parseColor("#EAB308"), // Brand Gold
                Color.parseColor("#CA8A04"), // Deep Gold
                Color.parseColor("#0284C7")  // Accent Blue
        );
        mSwipeRefresh.setProgressBackgroundColorSchemeColor(Color.WHITE);
        mSwipeRefresh.setDistanceToTriggerSync(300);

        // Crucial: Only trigger pull-to-refresh when user is at the absolute top (scrollY == 0)
        mSwipeRefresh.setOnChildScrollUpCallback(new SwipeRefreshLayout.OnChildScrollUpCallback() {
            @Override
            public boolean canChildScrollUp(@NonNull SwipeRefreshLayout parent, @Nullable View child) {
                return mWebView != null && mWebView.getScrollY() > 0;
            }
        });

        mSwipeRefresh.setOnRefreshListener(new SwipeRefreshLayout.OnRefreshListener() {
            @Override
            public void onRefresh() {
                if (mWebView != null) {
                    mWebView.reload();
                }
                // Safety timeout: auto dismiss spinner after 4 seconds
                new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        if (mSwipeRefresh != null && mSwipeRefresh.isRefreshing()) {
                            mSwipeRefresh.setRefreshing(false);
                        }
                    }
                }, 4000);
            }
        });
    }

    private void dismissSplash() {
        if (isSplashDismissed || mSplashLayout == null) return;
        isSplashDismissed = true;

        long elapsed = System.currentTimeMillis() - splashLaunchTime;
        long minDisplayDuration = 2000; // 2 seconds so user sees the custom splash artwork cleanly
        long remaining = Math.max(0, minDisplayDuration - elapsed);

        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                if (mSwipeRefresh != null) {
                    mSwipeRefresh.setEnabled(true);
                }
                if (mSplashLayout != null && mSplashLayout.getVisibility() == View.VISIBLE) {
                    mSplashLayout.animate()
                            .alpha(0f)
                            .setDuration(450)
                            .withEndAction(new Runnable() {
                                @Override
                                public void run() {
                                    mSplashLayout.setVisibility(View.GONE);
                                }
                            })
                            .start();
                }
            }
        }, remaining);
    }

    private void checkAndRequestPermissions() {
        if (Build.VERSION.SDK_INT >= 33) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{
                        Manifest.permission.POST_NOTIFICATIONS,
                        Manifest.permission.CAMERA
                }, PERMISSIONS_REQUEST_CODE);
            }
        }
    }

    private void initWebView() {
        // Enable Hardware Acceleration for 60/120Hz smooth scrolling
        mWebView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        mWebView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
        mWebView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        mWebView.setVerticalScrollBarEnabled(false);
        mWebView.setHorizontalScrollBarEnabled(false);

        // Prevent browser long-press text selection / context menu
        mWebView.setOnLongClickListener(new View.OnLongClickListener() {
            @Override
            public boolean onLongClick(View v) {
                return true;
            }
        });
        mWebView.setHapticFeedbackEnabled(false);

        WebSettings settings = mWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setGeolocationEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        // Remove 300ms touch delay by disabling double-tap zoom
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setRenderPriority(WebSettings.RenderPriority.HIGH);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
            CookieManager cookieManager = CookieManager.getInstance();
            cookieManager.setAcceptCookie(true);
            cookieManager.setAcceptThirdPartyCookies(mWebView, true);
            cookieManager.setCookie(APP_URL, "is_native_app=true; path=/; max-age=31536000");
        }

        String defaultUa = settings.getUserAgentString();
        settings.setUserAgentString(defaultUa + " BikroyNowApp/1.0");

        mWebView.addJavascriptInterface(new WebAppInterface(this), "AndroidNative");

        mWebView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                mProgressBar.setVisibility(View.VISIBLE);
                mErrorLayout.setVisibility(View.GONE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                mProgressBar.setVisibility(View.GONE);
                if (mSwipeRefresh != null) {
                    mSwipeRefresh.setRefreshing(false);
                }
                injectNativeStyles(view);
                dismissSplash();

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    CookieManager.getInstance().flush();
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.getUrl() != null) {
                    String scheme = request.getUrl().getScheme();
                    String fullUrl = request.getUrl().toString();
                    // Do not show error layout for non-http(s) schemes or auth callback transitions
                    if (scheme != null && !scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https")) {
                        return;
                    }
                    if (fullUrl.contains("auth/callback") || fullUrl.contains("login-callback")) {
                        return;
                    }
                }
                if (request.isForMainFrame()) {
                    mProgressBar.setVisibility(View.GONE);
                    if (mSwipeRefresh != null) {
                        mSwipeRefresh.setRefreshing(false);
                    }
                    mWebView.setVisibility(View.GONE);
                    mErrorLayout.setVisibility(View.VISIBLE);
                    dismissSplash();
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUrl(request.getUrl().toString());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrl(url);
            }
        });

        mWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    mProgressBar.setVisibility(View.VISIBLE);
                    mProgressBar.setProgress(newProgress);
                } else {
                    mProgressBar.setVisibility(View.GONE);
                }
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    request.grant(request.getResources());
                }
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (mFilePathCallback != null) {
                    mFilePathCallback.onReceiveValue(null);
                }
                mFilePathCallback = filePathCallback;

                Intent intent = null;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    try {
                        intent = fileChooserParams.createIntent();
                    } catch (Exception ignored) {}
                }
                if (intent == null) {
                    intent = new Intent(Intent.ACTION_GET_CONTENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("image/*");
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                }

                try {
                    startActivityForResult(Intent.createChooser(intent, "ছবি নির্বাচন করুন (Select Photo)"), FILE_CHOOSER_RESULT_CODE);
                } catch (ActivityNotFoundException e) {
                    mFilePathCallback = null;
                    Toast.makeText(MainActivity.this, "গ্যালারি খুলতে ব্যর্থ হয়েছে", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });
    }

    private void injectNativeStyles(WebView view) {
        String css = "* { -webkit-tap-highlight-color: transparent !important; -webkit-touch-callout: none !important; } " +
                     "a, button, img { -webkit-user-select: none !important; user-select: none !important; } " +
                     "::-webkit-scrollbar { display: none !important; width: 0 !important; }";
        String js = "(function() {" +
                    "  var id = 'bikroynow-native-style';" +
                    "  if (!document.getElementById(id)) {" +
                    "    var el = document.createElement('style');" +
                    "    el.id = id;" +
                    "    el.innerHTML = '" + css + "';" +
                    "    document.head.appendChild(el);" +
                    "  }" +
                    "})();";
        view.evaluateJavascript(js, null);
    }

    private boolean handleUrl(String url) {
        if (url == null) return false;

        // 0. Handle intent:// URLs safely without triggering ERR_UNKNOWN_URL_SCHEME
        if (url.startsWith("intent://")) {
            try {
                Intent parsedIntent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                if (parsedIntent != null) {
                    if (parsedIntent.getPackage() != null && parsedIntent.getPackage().equals(getPackageName())) {
                        handleDeepLink(parsedIntent);
                        return true;
                    }
                    if (getPackageManager().resolveActivity(parsedIntent, 0) != null) {
                        startActivity(parsedIntent);
                        return true;
                    }
                    String fallbackUrl = parsedIntent.getStringExtra("browser_fallback_url");
                    if (fallbackUrl != null) {
                        mWebView.loadUrl(fallbackUrl);
                        return true;
                    }
                }
            } catch (Exception ignored) {}
            return true;
        }

        // 1. Google OAuth flow - Open in Google Chrome so user's saved Google accounts are available
        if (url.contains("accounts.google.com") || 
            (url.contains("supabase.co/auth/v1/authorize") && url.contains("provider=google"))) {
            openInChromeOrBrowser(url);
            return true;
        }

        // 2. Custom Scheme Deep Link callback
        if (url.startsWith("bikroynow://") || url.startsWith("io.supabase.bikroynow://")) {
            handleDeepLink(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            return true;
        }

        if (url.startsWith("tel:")) {
            try {
                Intent intent = new Intent(Intent.ACTION_DIAL, Uri.parse(url));
                startActivity(intent);
                return true;
            } catch (Exception ignored) {}
        }

        if (url.startsWith("mailto:")) {
            try {
                Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.parse(url));
                startActivity(intent);
                return true;
            } catch (Exception ignored) {}
        }

        if (url.startsWith("whatsapp:") || url.contains("api.whatsapp.com") || url.contains("wa.me")) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                startActivity(intent);
                return true;
            } catch (Exception ignored) {}
        }

        if (url.contains("bikroynow.com")) {
            return false;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            startActivity(intent);
            return true;
        } catch (Exception ignored) {}

        return false;
    }

    private void openInChromeOrBrowser(String url) {
        Uri uri = Uri.parse(url);
        // Try launching directly in Google Chrome so the user's logged-in Google accounts are immediately available
        try {
            Intent chromeIntent = new Intent(Intent.ACTION_VIEW, uri);
            chromeIntent.setPackage("com.android.chrome");
            chromeIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(chromeIntent);
            return;
        } catch (Exception ignored) {}

        // Fallback to default browser
        try {
            Intent browserIntent = new Intent(Intent.ACTION_VIEW, uri);
            browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(browserIntent);
        } catch (Exception e) {
            Toast.makeText(this, "ব্রাউজার খুলতে ব্যর্থ হয়েছে", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_RESULT_CODE) {
            if (mFilePathCallback != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK && data != null) {
                    String dataString = data.getDataString();
                    ClipData clipData = data.getClipData();
                    if (clipData != null) {
                        results = new Uri[clipData.getItemCount()];
                        for (int i = 0; i < clipData.getItemCount(); i++) {
                            results[i] = clipData.getItemAt(i).getUri();
                        }
                    } else if (dataString != null) {
                        results = new Uri[]{Uri.parse(dataString)};
                    }
                }
                mFilePathCallback.onReceiveValue(results);
                mFilePathCallback = null;
            }
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    public static boolean isAppForeground = false;

    @Override
    protected void onResume() {
        super.onResume();
        isAppForeground = true;
    }

    @Override
    protected void onPause() {
        super.onPause();
        isAppForeground = false;
        BadgeSyncReceiver.scheduleNext(this);
    }

    @Override
    protected void onStop() {
        super.onStop();
        isAppForeground = false;
        BadgeSyncReceiver.scheduleNext(this);
    }

    @Override
    public void onBackPressed() {
        if (mWebView != null && mWebView.canGoBack()) {
            // First attempt instant SPA back navigation via JavaScript popstate
            mWebView.evaluateJavascript(
                "(function() {" +
                "  if (window.history && window.history.length > 1) {" +
                "    window.history.back();" +
                "    return 'true';" +
                "  }" +
                "  return 'false';" +
                "})()",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if (!"\"true\"".equals(value) && !"true".equals(value)) {
                            if (mWebView != null && mWebView.canGoBack()) {
                                mWebView.goBack();
                            } else {
                                MainActivity.super.onBackPressed();
                            }
                        }
                    }
                }
            );
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (mWebView != null) {
            mWebView.saveState(outState);
        }
    }

    private static final String CHANNEL_ID = "bikroynow_chat_alerts_v2";
    private static final int BADGE_NOTIFICATION_ID = 9001;

    private void initNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                // Delete legacy silent channels so new high-priority channel takes full effect
                try {
                    manager.deleteNotificationChannel("bikroynow_silent_badge_channel");
                    manager.deleteNotificationChannel("bikroynow_silent_badge_v3");
                } catch (Throwable ignored) {}

                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        "BikroyNow মেসেজ নোটিফিকেশন",
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("নতুন চ্যাট ও মেসেজ নোটিফিকেশন");
                channel.setShowBadge(true);
                channel.enableVibration(true);
                channel.setVibrationPattern(new long[]{0, 250, 150, 250});

                Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                        .build();
                channel.setSound(soundUri, audioAttributes);

                manager.createNotificationChannel(channel);
            }
        }
    }

    public static void showAppNotification(final Context context, final String title, final String message, final int count) {
        if (context == null) return;
        new Handler(Looper.getMainLooper()).post(new Runnable() {
            @Override
            public void run() {
                try {
                    // 1. ShortcutBadger for OEM Launchers (Vivo, Xiaomi, Oppo, Samsung, Huawei, etc.)
                    if (count > 0) {
                        ShortcutBadger.applyCount(context.getApplicationContext(), count);
                    } else {
                        ShortcutBadger.removeCount(context.getApplicationContext());
                    }

                    // 2. High-Priority Android System Notification with sound, vibration, heads-up banner & badge
                    NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                    if (manager != null) {
                        if (count <= 0) {
                            manager.cancel(BADGE_NOTIFICATION_ID);
                        } else {
                            Intent intent = new Intent(context.getApplicationContext(), MainActivity.class);
                            intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                            intent.putExtra("target_url", "/chat");
                            PendingIntent pendingIntent = PendingIntent.getActivity(
                                    context.getApplicationContext(),
                                    0,
                                    intent,
                                    PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
                            );

                            String notifTitle = (title != null && !title.isEmpty()) ? title : "BikroyNow: নতুন মেসেজ এসেছে 💬";
                            String notifText = (message != null && !message.isEmpty()) ? message : "আপনার নতুন অপঠিত মেসেজ রয়েছে";

                            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

                            NotificationCompat.Builder builder = new NotificationCompat.Builder(context.getApplicationContext(), CHANNEL_ID)
                                    .setSmallIcon(R.mipmap.ic_launcher)
                                    .setContentTitle(notifTitle)
                                    .setContentText(notifText)
                                    .setNumber(count)
                                    .setBadgeIconType(NotificationCompat.BADGE_ICON_SMALL)
                                    .setContentIntent(pendingIntent)
                                    .setAutoCancel(true)
                                    .setSound(soundUri)
                                    .setVibrate(new long[]{0, 250, 150, 250})
                                    .setDefaults(Notification.DEFAULT_LIGHTS | Notification.DEFAULT_SOUND)
                                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                                    .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

                            if (Build.VERSION.SDK_INT < 33 ||
                                    ContextCompat.checkSelfPermission(context.getApplicationContext(), Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
                                manager.notify(BADGE_NOTIFICATION_ID, builder.build());
                            }
                        }
                    }
                } catch (Throwable t) {
                    t.printStackTrace();
                }
            }
        });
    }

    public static void updateBadgeFromContext(final Context context, final int count, final String messageSnippet) {
        showAppNotification(context, "BikroyNow: নতুন মেসেজ এসেছে 💬", messageSnippet, count);
    }

    public void updateLauncherBadge(final int count) {
        showAppNotification(getApplicationContext(), "BikroyNow: নতুন মেসেজ এসেছে 💬", null, count);
    }

    public class WebAppInterface {
        Context mContext;

        WebAppInterface(Context c) {
            mContext = c;
        }

        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }

        @JavascriptInterface
        public void setUserId(String userId) {
            if (userId != null && !userId.trim().isEmpty()) {
                mContext.getSharedPreferences("bikroynow_prefs", Context.MODE_PRIVATE)
                        .edit().putString("user_id", userId.trim()).apply();
                BadgeSyncReceiver.scheduleNext(mContext);
            }
        }

        @JavascriptInterface
        public void setSwipeRefreshEnabled(final boolean enabled) {
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    if (mSwipeRefresh != null) {
                        mSwipeRefresh.setEnabled(enabled);
                    }
                }
            });
        }

        @JavascriptInterface
        public void showNotification(final String title, final String message, final int count) {
            showAppNotification(mContext, title, message, count);
        }

        @JavascriptInterface
        public void showToast(String toast) {
            Toast.makeText(mContext, toast, Toast.LENGTH_SHORT).show();
        }

        @JavascriptInterface
        public void openExternalUrl(String url) {
            openInChromeOrBrowser(url);
        }

        @JavascriptInterface
        public void setAppBadge(final int count) {
            updateLauncherBadge(count);
        }

        @JavascriptInterface
        public void clearAppBadge() {
            updateLauncherBadge(0);
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            if (Build.VERSION.SDK_INT >= 33) {
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(MainActivity.this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, PERMISSIONS_REQUEST_CODE);
                }
            }
        }
    }
}