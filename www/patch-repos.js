JavaScript

const fs = require('fs');
const path = require('path');

module.exports = function(context) {
    const projectRoot = context.opts.projectRoot;
    const platformRoot = path.join(projectRoot, 'platforms/android');
    if (!fs.existsSync(platformRoot)) return;

    // 1. Хирургически отключаем проверку версий внутри CordovaLib, чтобы не зависеть от библиотеки
    const cordovaGradlePath = path.join(platformRoot, 'CordovaLib/cordova.gradle');
    if (fs.existsSync(cordovaGradlePath)) {
        try {
            let cordovaGradleContent = fs.readFileSync(cordovaGradlePath, 'utf8');
            
            // Комментируем импорт
            cordovaGradleContent = cordovaGradleContent.replace(
                "import com.g00fy2.versioncompare.Version",
                "// import com.g00fy2.versioncompare.Version"
            );
            
            // Ломаем/заменяем логику вызова, чтобы она всегда возвращала true (типа версия всегда подходит)
            cordovaGradleContent = cordovaGradleContent.replace(
                "return new Version(versionString).isHigherThan(lowestVersion);",
                "return true; // Patched by Hook"
            );
            
            fs.writeFileSync(cordovaGradlePath, cordovaGradleContent, 'utf8');
            console.log('--- [Hook] CordovaLib/cordova.gradle successfully patched (disabled versioncompare).');
        } catch (e) {
            console.error('--- [Hook] Failed to patch cordova.gradle:', e);
        }
    }

    // 2. Исправляем репозитории и вырезаем classpath зависимость из всех build.gradle
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
            // Пропускаем уже обработанный cordova.gradle
            if (file.endsWith('cordova.gradle')) return;

            let content = fs.readFileSync(file, 'utf8');
            let changed = false;

            // Чиням репозитории на mavenCentral
            if (content.includes('jcenter()')) {
                content = content.replace(/jcenter\(\)/g, 'mavenCentral()');
                changed = true;
            }

            // Вырезаем требование подгрузки плагина из блока buildscript dependencies classpath
            if (content.includes('com.g00fy2:versioncompare')) {
                const lines = content.split('\n');
                const filteredLines = lines.filter(line => !line.includes