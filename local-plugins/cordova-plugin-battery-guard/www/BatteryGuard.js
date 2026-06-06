var exec = require('cordova/exec');

var BatteryGuard = {
    saveSettings: function(lowLimit, highLimit, intervalMin, lowSound, highSound, success, error) {
        exec(success, error, 'BatteryGuardPlugin', 'saveSettings', [lowLimit, highLimit, intervalMin, lowSound, highSound]);
    },
    stopService: function(success, error) {
        exec(success, error, 'BatteryGuardPlugin', 'stopService', []);
    },
    selectSound: function(soundType, success, error) {
        exec(success, error, 'BatteryGuardPlugin', 'selectSound', [soundType]);
    }
};

module.exports = BatteryGuard;