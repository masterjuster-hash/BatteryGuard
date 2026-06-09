const fs = require('fs');
const path = require('path');

module.exports = function(context) {
    const platformRoot = path.join(context.opts.projectRoot, 'platforms/android');
    if (!fs.existsSync(platformRoot)) {
        console.log('--- [Hook] Android platform root not found yet, skipping.');
        return;
    }

    console.log('--- [Hook] Executing nuclear before_build patcher...');

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

            // Полная ампутация проблемных мест в cordova.gradle через split/join
            if (file.endsWith('cordova.gradle')) {
                if (content.indexOf('import com.g00fy2.versioncompare.Version') !== -1) {
                    content = content.split('import com.g00fy2.versioncompare.Version').join('// Removed import');
                    changed = true;
                }
                
                // Вырезаем оригинальное тело isSupportedVersion и хардкодим true
                if (content.indexOf('Boolean isSupportedVersion(String version) {') !== -1) {
                    const parts = content.split('Boolean isSupportedVersion(String version) {');
                    // Берем всё, что после закрывающей скобки этого метода (хакаем структуру через гарантированный разрыв)
                    const rest = parts[1].split('String findLatestInstalledBuildTools(String buildToolsVersion) {');
                    
                    content = parts[0] + 
                              'Boolean isSupportedVersion(String version) {\n    return true\n}\n\n' +
                              'String findLatestInstalledBuildTools(String buildToolsVersion) {\n    return buildToolsVersion\n}\n\n' + 
                              // Пропускаем старое тело второй функции, стыкуемся сразу со следующим методом Cordova
                              rest[1].substring(rest[1].indexOf('Boolean cdvIsNativeDimensDefined()'));
                    changed = true;
                    console.log('--- [Hook] Amputated Version classes from cordova.gradle methods.');
                }
            }

            // Для ВСЕХ файлов сносим classpath блокера
            if (content.indexOf('com.g00fy2:versioncompare') !== -1) {
                let lines = content.split('\n');
                let filteredLines = lines.filter(function(line) {
                    return line.indexOf('com.g00fy2:versioncompare') === -1;
                });
                content = filteredLines.join('\n');
                changed = true;
            }

            // Перенаправляем jcenter на mavenCentral
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