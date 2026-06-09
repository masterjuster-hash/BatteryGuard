const fs = require('fs');
const path = require('path');

module.exports = function(context) {
    const platformRoot = path.join(context.opts.projectRoot, 'platforms/android');
    if (!fs.existsSync(platformRoot)) return;

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

            // ХИРУРГИЯ: Полностью вырезаем логику сравнения версий Cordova
            if (file.endsWith('cordova.gradle')) {
                // Полностью заглушаем импорт и ломающие функции старыми добрыми дефолтами
                content = content.replace(/import com\.g00fy2\.versioncompare\.Version/g, '// Removed');
                
                // Переписываем функцию проверки версий, чтобы она всегда возвращала true
                const targetFunc1 = 'Boolean isSupportedVersion(String version) {';
                if (content.indexOf(targetFunc1) !== -1) {
                    content = content.replace(/Boolean isSupportedVersion\(String version\) \{[\s\S]*?\n\}/, 
                        'Boolean isSupportedVersion(String version) {\n    return true;\n}');
                }

                // Переписываем поиск build-tools, чтобы он просто возвращал то, что передано, без сортировок
                const targetFunc2 = 'String findLatestInstalledBuildTools(String buildToolsVersion) {';
                if (content.indexOf(targetFunc2) !== -1) {
                    content = content.replace(/String findLatestInstalledBuildTools\(String buildToolsVersion\) \{[\s\S]*?\n\}/,
                        'String findLatestInstalledBuildTools(String buildToolsVersion) {\n    return buildToolsVersion;\n}');
                }
                
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