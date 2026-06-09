const fs = require('fs');
const path = require('path');

module.exports = function(context) {
    const platformRoot = path.join(context.opts.projectRoot, 'platforms/android');
    if (!fs.existsSync(platformRoot)) return;

    // Специфический фикс для конкретного файла app/build.gradle, который валит сборку
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

            // ХИРУРГИЯ: Полностью вырезаем логику сравнения версий Cordova из cordova.gradle
            if (file.endsWith('cordova.gradle')) {
                content = content.replace(/import com\.g00fy2\.versioncompare\.Version/g, '// Removed');
                
                const targetFunc1 = 'Boolean isSupportedVersion(String version) {';
                if (content.indexOf(targetFunc1) !== -1) {
                    content = content.replace(/Boolean isSupportedVersion\(String version\) \{[\s\S]*?\n\}/, 
                        'Boolean isSupportedVersion(String version) {\n    return true;\n}');
                }

                const targetFunc2 = 'String findLatestInstalledBuildTools(String buildToolsVersion) {';
                if (content.indexOf(targetFunc2) !== -1) {
                    content = content.replace(/String findLatestInstalledBuildTools\(String buildToolsVersion\) \{[\s\S]*?\n\}/,
                        'String findLatestInstalledBuildTools(String buildToolsVersion) {\n    return buildToolsVersion;\n}');
                }
                
                changed = true;
            }

            // Общая очистка от упоминаний во всех остальных файлах
            if (content.indexOf('com.g00fy2:versioncompare') !== -1) {
                let lines = content.split('\n');
                let filteredLines = lines.filter(function(line) {
                    return line.indexOf('com.g00fy2:versioncompare') === -1;
                });
                content = filteredLines.join('\n');
                changed = true;
            }

            // Заменяем мертвый jcenter на mavenCentral
            if (content.indexOf('jcenter()') !== -1) {
                content = content.split('jcenter()').join('mavenCentral()');
                changed = true;
            }

            if (changed) {
                fs.writeFileSync(file, content, 'utf8');
                console.log('Successfully hard-patched: ' + path.basename(file));
            }
        });
    } catch (err) {
        console.error('Error in hard-patch hook: ' + err);
    }
};