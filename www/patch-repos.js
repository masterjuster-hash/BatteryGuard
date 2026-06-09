const fs = require('fs');
const path = require('path');

module.exports = function(context) {
    const platformRoot = path.join(context.opts.projectRoot, 'platforms/android');
    if (!fs.existsSync(platformRoot)) return;

    // 1. ТОТАЛЬНАЯ ПЕРЕЗАПИСЬ cordova.gradle (уничтожаем ломающий скрипт под корень)
    const cordovaGradlePath = path.join(platformRoot, 'CordovaLib/cordova.gradle');
    if (fs.existsSync(cordovaGradlePath)) {
        try {
            const cleanCordovaGradle = `// Patched by infrastructure hook
            Boolean isSupportedVersion(String version) { return true; }
            String findLatestInstalledBuildTools(String buildToolsVersion) { return buildToolsVersion; }
            
            ext {
                cdvCompileSdkVersion = privateHelpers.getCompileSdkVersion()
                cdvBuildToolsVersion = privateHelpers.getBuildToolsVersion()
            }
            `;
            fs.writeFileSync(cordovaGradlePath, cleanCordovaGradle, 'utf8');
            console.log('--- [Hook] cordova.gradle has been completely overwritten with clean stub.');
        } catch (e) {
            console.error('--- [Hook] Failed to overwrite cordova.gradle:', e);
        }
    }

    // 2. Очистка app/build.gradle от блокера
    const appBuildGradle = path.join(platformRoot, 'app/build.gradle');
    if (fs.existsSync(appBuildGradle)) {
        try {
            let appContent = fs.readFileSync(appBuildGradle, 'utf8');
            if (appContent.indexOf('com.g00fy2:versioncompare') !== -1) {
                let appLines = appContent.split('\n');
                let filteredAppLines = appLines.filter(function(line) {
                    return line.indexOf('com.g00fy2:versioncompare') === -1;
                });
                fs.writeFileSync(appBuildGradle, filteredAppLines.join('\n'), 'utf8');
                console.log('--- [Hook] Successfully purged versioncompare from app/build.gradle');
            }
        } catch (appErr) {
            console.error('--- [Hook] Failed to patch app/build.gradle:', appErr);
        }
    }

    // 3. Массовая замена репозиториев jcenter -> mavenCentral во всех файлах
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
                console.log('Successfully patched: ' + path.basename(file));
            }
        });
    } catch (err) {
        console.error('Error in walk patch hook: ' + err);
    }
};