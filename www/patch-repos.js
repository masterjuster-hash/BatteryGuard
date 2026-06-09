const fs = require('fs');
const path = require('path');

module.exports = function(context) {
    const platformRoot = path.join(context.opts.projectRoot, 'platforms/android');
    if (!fs.existsSync(platformRoot)) {
        console.log('--- [Hook] Android platform root not found yet, skipping.');
        return;
    }

    console.log('--- [Hook] Executing Precision-Surgical before_build patcher...');

    // 1. Возвращаем оригинальный файл, но аккуратно срезаем верхушку с Version
    const cordovaGradlePath = path.join(platformRoot, 'CordovaLib/cordova.gradle');
    if (fs.existsSync(cordovaGradlePath)) {
        try {
            let content = fs.readFileSync(cordovaGradlePath, 'utf8');
            let changed = false;

            // Глушим мертвый импорт
            if (content.indexOf('import com.g00fy2.versioncompare.Version') !== -1) {
                content = content.split('import com.g00fy2.versioncompare.Version').join('// Removed');
                changed = true;
            }

            // Находим ломающие методы и полностью заменяем их тела на безопасные заглушки
            if (content.indexOf('Boolean isSupportedVersion(String version) {') !== -1 && content.indexOf('// Patched OK') === -1) {
                
                // Нагло и точечно подменяем код методов, не ломая окружение вокруг них
                content = content.replace(
                    /Boolean isSupportedVersion[\s\S]*?String findLatestInstalledBuildTools[\s\S]*?return buildToolsVersion\s*\}/,
                    `Boolean isSupportedVersion(String version) {
                        // Patched OK
                        return true
                    }
                    String findLatestInstalledBuildTools(String buildToolsVersion) {
                        return buildToolsVersion
                    }`
                );
                changed = true;
                console.log('--- [Hook] Successfully amputated Version calls from native cordova.gradle');
            }

            if (changed) {
                fs.writeFileSync(cordovaGradlePath, content, 'utf8');
            }
        } catch (e) {
            console.error('--- [Hook] Failed to patch cordova.gradle:', e);
        }
    }

    // 2. Очистка репозиториев в остальных файлах
    function walk(dir) {
        let results = [];
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            file = path.join(dir, file);
            const stat = fs.statSync(file);
            if (stat && stat.isDirectory()) {
                results = results.concat(walk(file));
            } else {
                if (file.endsWith('.gradle')) results.push(file);
            }
        });
        return results;
    }

    try {
        const gradleFiles = walk(platformRoot);
        gradleFiles.forEach(file => {
            if (file.endsWith('cordova.gradle')) return;

            let content = fs.readFileSync(file, 'utf8');
            let changed = false;

            if (content.indexOf('com.g00fy2:versioncompare') !== -1) {
                let lines = content.split('\n');
                let filteredLines = lines.filter(function(line) {
                    return line.indexOf('com.g00fy2:versioncompare') === -1;
                });
                content = filteredLines.join('\n');
                changed = true;
            }

            if (content.indexOf('jcenter()') !== -1) {
                content = content.split('jcenter()').join('mavenCentral()');
                changed = true;
            }

            if (changed) {
                fs.writeFileSync(file, content, 'utf8');
                console.log('--- [Hook] Cleaned repositories in: ' + path.basename(file));
            }
        });
    } catch (err) {
        console.error('--- [Hook] Error inside walk block: ' + err);
    }
};