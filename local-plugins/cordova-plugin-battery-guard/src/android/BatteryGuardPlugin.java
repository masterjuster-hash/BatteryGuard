package com.custom.batteryguard;

import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CallbackContext;
import org.apache.cordova.PluginResult;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.app.Activity;
import android.media.RingtoneManager;

import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONException;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

public class BatteryGuardPlugin extends CordovaPlugin {

    private CallbackContext soundCallbackContext = null;
    private String currentSelectingType = "";
    private static final int REQUEST_CODE_PICK_SOUND = 999;

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
        Context context = this.cordova.getActivity().getApplicationContext();

        if (action.equals("saveSettings")) {
            int lowLimit = args.getInt(0);
            int highLimit = args.getInt(1);
            int intervalMin = args.getInt(2);
            String lowSound = args.getString(3);
            String highSound = args.getString(4);

            // Сохраняем настройки в SharedPreferences (надежное нативное хранилище)
            SharedPreferences sharedPref = context.getSharedPreferences("BatteryGuardPrefs", Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = sharedPref.edit();
            editor.putInt("lowLimit", lowLimit);
            editor.putInt("highLimit", highLimit);
            editor.putInt("intervalMin", intervalMin);
            editor.putString("lowSound", lowSound);
            editor.putString("highSound", highSound);
            editor.apply();

            // Запускаем или обновляем Foreground Service (Фоновые процессы)
            Intent serviceIntent = new Intent(context, BatteryForegroundService.class);
            ContextCompat.startForegroundService(context, serviceIntent);

            callbackContext.success("Служба запущена и настройки сохранены");
            return true;
        }

        if (action.equals("stopService")) {
            Intent serviceIntent = new Intent(context, BatteryForegroundService.class);
            context.stopService(serviceIntent);
            callbackContext.success("Служба полностью остановлена");
            return true;
        }

        if (action.equals("selectSound")) {
            this.soundCallbackContext = callbackContext;
            this.currentSelectingType = args.getString(0);

            // Открываем универсальный системный диалог выбора аудио (Рингтоны + Проводник файлов)
            Intent intent = new Intent(RingtoneManager.ACTION_RINGTONE_PICKER);
            intent.putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_ALL);
            intent.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true);
            intent.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false);

            this.cordova.startActivityForResult(this, intent, REQUEST_CODE_PICK_SOUND);
            
            // Говорим Cordova, что ответ будет асинхронным (чуть позже)
            PluginResult r = new PluginResult(PluginResult.Status.NO_RESULT);
            r.setKeepCallback(true);
            callbackContext.sendPluginResult(r);
            return true;
        }

        return false;
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQUEST_CODE_PICK_SOUND && soundCallbackContext != null) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                Uri uri = data.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI);
                if (uri != null) {
                    String uriString = uri.toString();
                    Context context = this.cordova.getActivity().getApplicationContext();

                    // Защита от потери прав (Error 908 / SecurityException):
                    // Если выбран локальный файл пользователя (content://), копируем его во внутренний кэш приложения
                    if (uriString.startsWith("content://") && !uriString.contains("media/internal")) {
                        String localPath = copyFileToInternalStorage(context, uri, "alarm_" + currentSelectingType + ".mp3");
                        if (localPath != null) {
                            uriString = localPath;
                        }
                    }

                    soundCallbackContext.success(uriString);
                } else {
                    soundCallbackContext.error("Звук не выбран");
                }
            } else {
                soundCallbackContext.error("Выбор отменен");
            }
            soundCallbackContext = null;
        }
    }

    // Вспомогательный метод для физического копирования файлов в изолированную память приложения
    private String copyFileToInternalStorage(Context context, Uri uri, String newFileName) {
        try {
            InputStream inputStream = context.getContentResolver().openInputStream(uri);
            if (inputStream == null) return null;

            File outputDir = context.getFilesDir();
            File outputFile = new File(outputDir, newFileName);

            FileOutputStream outputStream = new FileOutputStream(outputFile);
            byte[] buffer = new byte[4096];
            int bytesRead;
            while ((bytesRead = inputStream.read(buffer)) != -1) {
                outputStream.write(buffer, 0, bytesRead);
            }

            inputStream.close();
            outputStream.close();

            // Возвращаем прямой путь к файлу в файловой системе
            return outputFile.getAbsolutePath();
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }
}