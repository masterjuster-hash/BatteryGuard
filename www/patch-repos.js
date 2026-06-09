const fs = require('fs');
const path = require('path');

module.exports = function(context) {
    const platformRoot = path.join(context.opts.projectRoot, 'platforms/android');
    if (!fs.existsSync(platformRoot)) {
        console.log('--- [Hook] Android platform root not found yet, skipping.');
        return;
    }

    console.log('--- [Hook] Executing aggressive before_build patcher...');

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

            // Если это cordova.gradle — делаем аккуратную микрохирургию функций
            if (file.endsWith('cordova.gradle')) {
                if (content.indexOf('import com.g00fy2.versioncompare.Version') !== -1) {
                    content = content.split('import com.g00fy2.versioncompare.Version').join('// Removed import');
                    changed = true;
                }
                if (content.indexOf('Boolean isSupportedVersion(String version) {') !== -1) {
                    content = content.replace(/Boolean isSupportedVersion\(String version\) \{[\s\S]*?\}/, 
                        'Boolean isSupportedVersion(String version) {\n    return true;\n}');
                    changed = true;
                }
                if (content.indexOf('String findLatestInstalledBuildTools(String buildToolsVersion) {') !== -1) {
                    content = content.replace(/String findLatestInstalledBuildTools\(String buildToolsVersion\) \{[\s\S]*?\}/,
                        'String findLatestInstalledBuildTools(String buildToolsVersion) {\n    return buildToolsVersion;\n}');
                    changed = true;
                }
            }

            // Для ВСЕХ файлов БЕЗ ИСКЛЮЧЕНИЯ сносим строку зависимости classpath
            if (content.indexOf('com.g00fy2:versioncompare') !== -1) {
                let lines = content.split('\n');
                let filteredLines = lines.filter(function(line) {
                    return line.indexOf('com.g00fy2:versioncompare') === -1;
                });
                content = filteredLines.join('\n');
                changed = true;
            }

            // Перенаправляем мертвый jcenter на рабочий mavenCentral
            if (content.indexOf('jcenter()') !== -1) {
                content = content.split('jcenter()').join('mavenCentral()');
                changed = true;
            }

            if (changed) {
                fs.writeFileSync(file, content, 'utf8');
                console.log('--- [Hook] Successfully forced patch on: ' + path.basename(file));
            }
        });
    } catch (err) {
        console.error('--- [Hook] Error inside execution block: ' + err);
    }
};