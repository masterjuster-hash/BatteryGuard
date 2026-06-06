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
            
            // 1. Исправляем репозитории jcenter
            if (content.includes('jcenter()')) {
                content = content.replace(/jcenter\(\)/g, 'mavenCentral()');
                changed = true;
            }
            
            // 2. Вырезаем под корень сломанную зависимость versioncompare
            if (content.includes('com.g00fy2:versioncompare')) {
                // Удаляем всю строку, где упоминается эта библиотека
                const lines = content.split('\n');
                const filteredLines = lines.filter(line => !line.includes('com.g00fy2:versioncompare'));
                content = filteredLines.join('\n');
                changed = true;
            }

            if (changed) {
                fs.writeFileSync(file, content, 'utf8');
            }
        });
    } catch (err) {}
};