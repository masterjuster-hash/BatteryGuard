const fs = require('fs');
const path = require('path');

module.exports = function(context) {
    const platformRoot = path.join(context.opts.projectRoot, 'platforms/android');
    if (!fs.existsSync(platformRoot)) return;

    // 1. Фикс ГЛАВНОГО build.gradle в корне платформы (вырезаем блокер из buildscript)
    const rootBuildGradle = path.join(platformRoot, 'build.gradle');
    if (fs.existsSync(rootBuildGradle)) {
        try {
            let rootContent = fs.readFileSync(rootBuildGradle, 'utf8');
            if (rootContent.indexOf('com.g00fy2:versioncompare') !== -1) {
                let lines = rootContent.split('\n');
                let filteredLines = lines.filter(function(line) {
                    return line.indexOf('com.g00fy2:versioncompare') === -1;
                });
                fs.writeFileSync(rootBuildGradle, filteredLines.join('\n'), 'utf8');
                console.log('--- [Hook] Successfully purged versioncompare from ROOT build.gradle');
            }
        } catch (err) {
            console.error('--- [Hook] Failed to patch ROOT build.gradle:', err);
        }
    }

    // 2. Фикс app/build.gradle
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

    // 3. Точечное исправление cordova.gradle
    const cordovaGradlePath = path.join(platformRoot, 'CordovaLib/cordova.gradle');
    if (fs.existsSync(cordovaGradlePath)) {
        try {
            let cordovaContent = fs.readFileSync(cordovaGradlePath, 'utf8');
            
            if (cordovaContent.indexOf('import com.g00fy2.versioncompare.Version') !== -1) {
                cordovaContent = cordovaContent.split('import com.g00fy2.versioncompare.Version').join('// Removed import');
            }

            if (cordovaContent.indexOf('Boolean isSupportedVersion(String version) {') !== -1) {
                cordovaContent = cordovaContent.replace(
                    /Boolean isSupportedVersion\(String version\) \{[\s\S]*?\}/,
                    'Boolean isSupportedVersion(String version) {\n    return true;\n}'
                );
            }

            if (cordovaContent.indexOf('String findLatestInstalledBuildTools(String buildToolsVersion) {') !== -1) {
                cordovaContent = cordovaContent.replace(
                    /String findLatestInstalledBuildTools\(String buildToolsVersion\) \{[\s\S]*?\}/,
                    'String findLatestInstalledBuildTools(String buildToolsVersion) {\n    return buildToolsVersion;\n}'
                );
            }

            fs.writeFileSync(cordovaGradlePath, cordovaContent, 'utf8');
            console.log('--- [Hook] cordova.gradle precision-patched successfully.');
        } catch (e) {
            console.error('--- [Hook] Failed to precision-patch cordova.gradle:', e);
        }
    }

    // 4. Массовая замена репозиториев jcenter -> mavenCentral во всех остальных файлах
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
                console.log('Successfully patched repos in: ' + path.basename(file));
            }
        });
    } catch (err) {
        console.error('Error in walk patch hook: ' + err);
    }
};