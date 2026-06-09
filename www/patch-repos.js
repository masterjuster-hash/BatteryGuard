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

            // 1. Если это основной скрипт cordova.gradle, лечим вызовы класса Version
            if (file.endsWith('cordova.gradle')) {
                let lines = content.split('\n');
                let newLines = lines.map(function(line) {
                    // Убираем импорт
                    if (line.indexOf('com.g00fy2.versioncompare.Version') !== -1) {
                        return '// ' + line;
                    }
                    // Глушим проверку на версию 0.0.0 (строка 43)
                    if (line.indexOf('isEqual(\'0.0.0\')') !== -1) {
                        return '    return true; // Patched';
                    }
                    // Глушим сортировку версий (строка 57)
                    if (line.indexOf('.collect { new Version(it) }') !== -1) {
                        return '        .collect { it } // Patched';
                    }
                    return line;
                });
                content = newLines.join('\n');
                changed = true;
            }

            // 2. Вырезаем любые остаточные упоминания зависимости из build.gradle
            if (content.indexOf('com.g00fy2:versioncompare') !== -1) {
                let lines = content.split('\n');
                let filteredLines = lines.filter(function(line) {
                    return line.indexOf('com.g00fy2:versioncompare') === -1;
                });
                content = filteredLines.join('\n');
                changed = true;
            }

            // 3. Заменяем мертвый jcenter на mavenCentral
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
        console.error('Error in infrastructure hook: ' + err);
    }
};