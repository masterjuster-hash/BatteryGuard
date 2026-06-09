const fs = require('fs');
const path = require('path');
const https = require('https');

module.exports = function(context) {
    const platformRoot = path.join(context.opts.projectRoot, 'platforms/android');
    if (!fs.existsSync(platformRoot)) {
        console.log('--- [Hook] Android platform root not found yet, skipping.');
        return;
    }

    console.log('--- [Hook] Starting Local-Dependency injection patcher...');

    const jarUrl = 'https://repo1.maven.org/maven2/com/g00fy2/versioncompare/1.3.4/versioncompare-1.3.4.jar';
    const libsDir = path.join(platformRoot, 'libs');
    const jarPath = path.join(libsDir, 'versioncompare-1.3.4.jar');

    // Создаем папку libs в сгенерированном Android проекте, если её нет
    if (!fs.existsSync(libsDir)) {
        fs.mkdirSync(libsDir, { recursive: true });
    }

    // Скачиваем JAR-ник напрямую из живого Maven Central во время сборки
    console.log('--- [Hook] Downloading versioncompare.jar from Maven Central...');
    
    const file = fs.createWriteStream(jarPath);
    https.get(jarUrl, function(response) {
        response.pipe(file);
        file.on('finish', function() {
            file.close();
            console.log('--- [Hook] Successfully downloaded versioncompare-1.3.4.jar to libs/');
            injectLocalRepo();
        });
    }).on('error', function(err) {
        fs.unlink(jarPath, () => {});
        console.error('--- [Hook] Failed to download JAR: ' + err.message);
    });

    function injectLocalRepo() {
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

                // Вместо удаления зависимости, мы говорим искать её в локальной папке libs
                if (content.indexOf('repositories {') !== -1 && content.indexOf('flatDir') === -1) {
                    content = content.split('repositories {').join('repositories {\n        flatDir { dirs BonaparteRoot + "/libs" }\n        flatDir { dirs "${project.rootDir}/libs" }\n        mavenCentral()');
                    changed = true;
                }

                // Меняем глобальный jcenter на mavenCentral везде для остальных библиотек
                if (content.indexOf('jcenter()') !== -1) {
                    content = content.split('jcenter()').join('mavenCentral()');
                    changed = true;
                }

                if (changed) {
                    fs.writeFileSync(file, content, 'utf8');
                    console.log('--- [Hook] Successfully patched repositories in: ' + path.basename(file));
                }
            });
        } catch (err) {
            console.error('--- [Hook] Error while injecting local repositories: ' + err);
        }
    }
};