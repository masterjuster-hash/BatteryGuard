const fs = require('fs');
const path = require('path');

console.log("--- [Hook] Starting Fixed-Dependency injection patcher...");

const androidFolder = path.join(__dirname, 'platforms', 'android');

if (!fs.existsSync(androidFolder)) {
    console.log("--- [Hook] Android platform folder not found. Skipping.");
    process.exit(0);
}

// 1. Правим cordova.gradle: убираем импорт и заменяем вызов Version
const cordovaGradlePath = path.join(androidFolder, 'CordovaLib', 'cordova.gradle');
if (fs.existsSync(cordovaGradlePath)) {
    let content = fs.readFileSync(cordovaGradlePath, 'utf8');
    
    // Убираем проблемный импорт
    content = content.replace("import com.g00fy2.versioncompare.Version", "");
    
    // Заменяем логику сравнения версий на чистый Groovy (сравнение массивов чисел)
    // Ищем строку, где создается объект Version
    const oldTargetCheck = "Boolean isTargetSdkHigher = new Version(cdvTargetSdkVersion).isHigherThan(new Version(30))";
    const newTargetCheck = "def parseVer = { String v -> v.replaceAll(/[^0-9.]/, '').split('\\\\.').collect { it ? it.toInteger() : 0 } };\n" +
                           "        def targetVer = parseVer(cdvTargetSdkVersion);\n" +
                           "        Boolean isTargetSdkHigher = targetVer && targetVer[0] > 30;";
    
    content = content.replace(oldTargetCheck, newTargetCheck);
    
    fs.writeFileSync(cordovaGradlePath, content, 'utf8');
    console.log("--- [Hook] Successfully patched cordova.gradle (removed versioncompare dependency)");
}

// 2. Исправляем репозитории во всех gradle файлах, заменяя jcenter и maven на безопасные зеркала
const filesToPatch = [
    path.join(androidFolder, 'repositories.gradle'),
    path.join(androidFolder, 'app', 'repositories.gradle'),
    path.join(androidFolder, 'CordovaLib', 'repositories.gradle'),
    path.join(androidFolder, 'plugin-build.gradle')
];

const secureRepositories = `
    repositories {
        maven { url "https://repo.maven.apache.org/maven2/" }
        google()
        maven { url "https://plugins.gradle.org/m2/" }
    }
`;

filesToPatch.forEach(filePath => {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Очищаем старые блоки repositories
        content = content.replace(/repositories\s*\{[\s\S]*?\}/g, '');
        
        // Вставляем наши безопасные репозитории в начало файла
        content = secureRepositories + "\n" + content;
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`--- [Hook] Successfully patched repositories in: ${path.basename(filePath)}`);
    }
});

console.log("--- [Hook] Patching completed successfully.");