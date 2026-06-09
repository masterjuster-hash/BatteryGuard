const fs = require('fs');
const path = require('path');

module.exports = function(context) {
    const projectRoot = context.opts.projectRoot;
    const platformRoot = path.join(projectRoot, 'platforms/android');
    if (!fs.existsSync(platformRoot)) return;

    // 1. Находим и хирургически отключаем проверку versioncompare внутри CordovaLib
    const cordovaGradlePath = path.join(platformRoot, 'CordovaLib/cordova.gradle');
    if (fs.existsSync(cordovaGradlePath)) {
        try {
            let cordovaGradleContent = fs.readFileSync(cordovaGradlePath, 'utf8');
            let lines = cordovaGradleContent.split('\n');
            let modified = false;

            for (let i = 0; i < lines.length; i++) {
                // Комментируем импорт класса
                if (lines[i].includes('import com.g00fy2.versioncompare.Version')) {
                    lines[i] = '// ' + lines[i];
                    modified = true;
                }
                // Комментируем инициализацию объектов этого класса
                if (lines[i].includes('new Version(')) {
                    lines[i] = '// ' + lines[i];
                    modified = true;
                }
            }

            if (modified) {
                fs.writeFileSync(cordovaGradlePath, lines.join('\n'), 'utf8');
                console.log('--- [Hook] Successfully disabled versioncompare inside cordova.gradle');
            }
        } catch (e) {
            console.error('--- [Hook] Failed to patch cordova.gradle:', e);
        }
    }

    // 2. Исправляем репозитории jcenter во всех сгенерированных .gradle файлах
    function walk(dir) {
        let results = [];
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            file = path.join(dir, file);
            const stat = fs.statSync(file);
            if (stat && stat.isDirectory()) {
                results = results.concat(walk(file));
            } else {
                if (file.endsWith('.