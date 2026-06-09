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
            let lines = content.split('\n');
            let changed = false;

            let newLines = lines.filter(function(line) {
                // Вырезаем импорт и строку зависимости под корень
                if (line.indexOf('versioncompare') !== -1) {
                    changed = true;
                    return false;
                }
                return true;
            });

            let finalContent = newLines.join('\n');

            // Заменяем репозитории
            if (finalContent.indexOf('jcenter()') !== -1) {
                finalContent = finalContent.split('jcenter()').join('mavenCentral()');
                changed = true;
            }

            if (changed) {
                fs.writeFileSync(file, finalContent, 'utf8');
                console.log('Patched file: ' + path.basename(file));
            }
        });
    } catch (err) {
        console.error('Error in hook: ' + err);
    }
};