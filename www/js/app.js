document.addEventListener('deviceready', onDeviceReady, false);

var selectedLowSound = "default";
var selectedHighSound = "default";

function onDeviceReady() {
    // Восстанавливаем отображение ранее выбранных звуков в UI, если они есть
    if (localStorage.getItem('lowSoundPath')) {
        selectedLowSound = localStorage.getItem('lowSoundPath');
        document.getElementById('lowSoundPath').innerText = selectedLowSound;
    }
    if (localStorage.getItem('highSoundPath')) {
        selectedHighSound = localStorage.getItem('highSoundPath');
        document.getElementById('highSoundPath').innerText = selectedHighSound;
    }

    // Навешиваем обработчики на кнопки
    document.getElementById('btnSelectLow').addEventListener('click', function() {
        selectAudio('low');
    });

    document.getElementById('btnSelectHigh').addEventListener('click', function() {
        selectAudio('high');
    });

    document.getElementById('btnSave').addEventListener('click', saveAndStart);
    document.getElementById('btnStop').addEventListener('click', stopService);
}

// Вызов нативного диалога выбора звука
function selectAudio(type) {
    if (!cordova.plugins.BatteryGuard) {
        alert("Ошибка: Плагин не инициализирован");
        return;
    }

    cordova.plugins.BatteryGuard.selectSound(type, function(uri) {
        if (type === 'low') {
            selectedLowSound = uri;
            document.getElementById('lowSoundPath').innerText = uri;
            localStorage.setItem('lowSoundPath', uri);
        } else {
            selectedHighSound = uri;
            document.getElementById('highSoundPath').innerText = uri;
            localStorage.setItem('highSoundPath', uri);
        }
    }, function(err) {
        alert("Ошибка выбора звука: " + err);
    });
}

// Отправка всех пяти параметров в нативный Java-слой
function saveAndStart() {
    var lowLimit = parseInt(document.getElementById('lowLimit').value);
    var highLimit = parseInt(document.getElementById('highLimit').value);
    var intervalMin = parseInt(document.getElementById('intervalMin').value);

    if (isNaN(lowLimit) || lowLimit < 1 || lowLimit > 100 ||
        isNaN(highLimit) || highLimit < 1 || highLimit > 100 ||
        isNaN(intervalMin) || intervalMin < 1) {
        alert("Пожалуйста, введите корректные значения!");
        return;
    }

    if (!cordova.plugins.BatteryGuard) {
        alert("Ошибка: Плагин не найден");
        return;
    }

    cordova.plugins.BatteryGuard.saveSettings(
        lowLimit, 
        highLimit, 
        intervalMin, 
        selectedLowSound, 
        selectedHighSound, 
        function(msg) {
            alert("Настройки применены. Служба запущена!");
        }, 
        function(err) {
            alert("Ошибка запуска службы: " + err);
        }
    );
}

// Полная остановка службы
function stopService() {
    if (!cordova.plugins.BatteryGuard) return;

    cordova.plugins.BatteryGuard.stopService(function(msg) {
        alert("Служба полностью остановлена.");
    }, function(err) {
        alert("Ошибка при остановке: " + err);
    });
}