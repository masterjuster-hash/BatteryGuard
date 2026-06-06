package com.custom.batteryguard;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.widget.Toast;

import java.io.File;

public class BatteryForegroundService extends Service {

    private static final int NOTIFICATION_ID = 8472;
    private static final String CHANNEL_ID = "BatteryGuardChannel";

    private BroadcastReceiver batteryReceiver = null;
    private MediaPlayer mediaPlayer = null;
    private PowerManager.WakeLock wakeLock = null;
    private AudioManager audioManager = null;

    // Нативные хэндлеры для реализации кулдауна (интервалов повтора)
    private Handler lowHandler = new Handler(Looper.getMainLooper());
    private Handler highHandler = new Handler(Looper.getMainLooper());

    private boolean isLowTimerRunning = false;
    private boolean isHighTimerRunning = false;

    @Override
    public void onCreate() {
        super.onCreate();
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        
        // Регистрация событийного мониторинга батареи средствами ОС Android
        batteryReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                checkBatteryStatus(intent);
            }
        };
        IntentFilter filter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
        registerReceiver(batteryReceiver, filter);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Создание Notification Channel для Android 9.0+ (Android 6.0 пропускает ветвление)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "BatteryGuard Monitoring",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }

        // Построение неудаляемого статус-уведомления
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        Notification notification = builder
                .setContentTitle("BatteryGuard")
                .setContentText("Мониторинг батареи активен в фоне")
                .setSmallIcon(android.R.drawable.ic_lock_idle_low_battery)
                .setOngoing(true) // Защита от смахивания
                .build();

        // Перевод службы в статус Foreground Service
        startForeground(NOTIFICATION_ID, notification);

        return START_STICKY; // Приказ ОС автоматически воскрешать сервис при нехватке памяти
    }

    private void checkBatteryStatus(Intent intent) {
        if (intent == null) return;

        // Чтение актуальных параметров из SharedPreferences
        SharedPreferences prefs = getSharedPreferences("BatteryGuardPrefs", Context.MODE_PRIVATE);
        int lowLimit = prefs.getInt("lowLimit", 20);
        int highLimit = prefs.getInt("highLimit", 80);
        final int intervalMin = prefs.getInt("intervalMin", 5);
        final String lowSound = prefs.getString("lowSound", "default");
        final String highSound = prefs.getString("highSound", "default");

        // Расчет текущего уровня заряда
        int level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
        int scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
        final int currentPercentage = (int) ((level / (float) scale) * 100);

        // Статус подключения зарядного устройства
        int status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
        final boolean isCharging = (status == BatteryManager.BATTERY_STATUS_CHARGING || 
                                    status == BatteryManager.BATTERY_STATUS_FULL);

        // --- ЛОГИКА ТРИГГЕРА РАЗРЯДКИ ---
        if (currentPercentage <= lowLimit && !isCharging) {
            if (!isLowTimerRunning) {
                triggerAlert("Батарея разряжена! Заряд: " + currentPercentage + "%", lowSound);
                isLowTimerRunning = true;

                // Запуск кулдауна postDelayed вместо бесконечных циклов
                lowHandler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        isLowTimerRunning = false;
                        // Форсируем принудительную перепроверку состояния по истечении X минут
                        Intent currentIntent = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
                        checkBatteryStatus(currentIntent);
                    }
                }, intervalMin * 60 * 1000L);
            }
        } else {
            // Мгновенный сброс таймера удержания, если условия пришли в норму
            if (isLowTimerRunning) {
                lowHandler.removeCallbacksAndMessages(null);
                isLowTimerRunning = false;
            }
        }

        // --- ЛОГИКА ТРИГГЕРА ЗАРЯДКИ ---
        if (currentPercentage >= highLimit && isCharging) {
            if (!isHighTimerRunning) {
                triggerAlert("Батарея заряжена! Заряд: " + currentPercentage + "%", highSound);
                isHighTimerRunning = true;

                highHandler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        isHighTimerRunning = false;
                        Intent currentIntent = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
                        checkBatteryStatus(currentIntent);
                    }
                }, intervalMin * 60 * 1000L);
            }
        } else {
            // Мгновенный сброс таймера удержания, если кабель отключен или заряд упал
            if (isHighTimerRunning) {
                highHandler.removeCallbacksAndMessages(null);
                isHighTimerRunning = false;
            }
        }
    }

    private void triggerAlert(final String message, String soundUriString) {
        // 1. Динамическое обновление текста в Foreground-уведомлении
        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            Notification.Builder builder;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                builder = new Notification.Builder(this, CHANNEL_ID);
            } else {
                builder = new Notification.Builder(this);
            }
            Notification notification = builder
                    .setContentTitle("ТРЕВОГА: BatteryGuard")
                    .setContentText(message)
                    .setSmallIcon(android.R.drawable.ic_lock_idle_low_battery)
                    .setOngoing(true)
                    .build();
            notificationManager.notify(NOTIFICATION_ID, notification);
        }

        // 2. Вывод Toast-сообщения, изолированного от WebView, через Handler основного потока
        new Handler(Looper.getMainLooper()).post(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(getApplicationContext(), message, Toast.LENGTH_LONG).show();
            }
        });

        // 3. Защита от Doze Mode (Удержание процессора на время воспроизведения)
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null && (wakeLock == null || !wakeLock.isHeld())) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "BatteryGuard::AlertWakeLock");
            wakeLock.acquire(10000); // Максимум 10 секунд работы
        }

        // 4. Воспроизведение звука тревоги
        playSound(soundUriString);
    }

    private void playSound(String uriString) {
        try {
            if (mediaPlayer != null) {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
                mediaPlayer = null;
            }

            mediaPlayer = new MediaPlayer();

            // Запрос аудиофокуса устройства, чтобы звук гарантированно пробился через тишину
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                AudioAttributes playbackAttributes = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build();
                AudioFocusRequest focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                        .setAudioAttributes(playbackAttributes)
                        .build();
                audioManager.requestAudioFocus(focusRequest);
                mediaPlayer.setAudioAttributes(playbackAttributes);
            } else {
                audioManager.requestAudioFocus(null, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
                mediaPlayer.setAudioStreamType(AudioManager.STREAM_ALARM);
            }

            // Установка источника данных (переключатель между внутренним кэшем приложения и системным URI)
            if (uriString.startsWith("/")) {
                // Это скопированный локальный пользовательский .mp3 файл приложения
                File file = new File(uriString);
                if (file.exists()) {
                    mediaPlayer.setDataSource(file.getAbsolutePath());
                } else {
                    // Откат на системный дефолтный звук, если файл поврежден
                    mediaPlayer.setDataSource(this, android.provider.Settings.System.DEFAULT_ALARM_ALERT_URI);
                }
            } else if (uriString.equals("default") || uriString.isEmpty()) {
                // Системный дефолтный звук
                mediaPlayer.setDataSource(this, android.provider.Settings.System.DEFAULT_ALARM_ALERT_URI);
            } else {
                // Системный рингтон из прошивки устройства
                mediaPlayer.setDataSource(this, Uri.parse(uriString));
            }

            mediaPlayer.prepare();
            mediaPlayer.start();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        // Полная очистка ресурсов при легальной остановке через кнопку «Остановить приложение»
        if (batteryReceiver != null) {
            unregisterReceiver(batteryReceiver);
            batteryReceiver = null;
        }
        if (mediaPlayer != null) {
            if (mediaPlayer.isPlaying()) mediaPlayer.stop();
            mediaPlayer.release();
            mediaPlayer = null;
        }
        lowHandler.removeCallbacksAndMessages(null);
        highHandler.removeCallbacksAndMessages(null);
        
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }

        // Убираем Foreground-уведомление
        stopForeground(true);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}