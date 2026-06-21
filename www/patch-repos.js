const fs = require('fs');
const path = require('path');

console.log("--- [Hook] Starting Precise Dependency Patcher...");

const androidFolder = path.join(__dirname, '..', 'platforms', 'android');

if (!fs.existsSync(androidFolder)) {
    console.error(`--- [Hook] ERROR: Android platform folder NOT found at ${androidFolder}`);
    process.exit(1);
}

// 1. Исправление логики и зависимостей в cordova.gradle
const cordovaGradlePath = path.join(androidFolder, 'CordovaLib', 'cordova.gradle');
if (fs.existsSync(cordovaGradlePath)) {
    let content = fs.readFileSync(cordovaGradlePath, 'utf8');
    
    // Удаляем импорт
    if (content.includes("import com.g00fy2.versioncompare.Version")) {
        content = content.replace("import com.g00fy2.versioncompare.Version", "");
    }
    
    // Удаляем саму зависимость из classpath, так как её больше нет в живых репозиториях
    content = content.replace(/classpath\s+['"]com\.g00fy2:versioncompare:[\d.]+['"]/g, '');
    
    // Подменяем проверку на чистый Groovy без внешних библиотек
    const oldTargetCheck = "Boolean isTargetSdkHigher = new Version(cdvTargetSdkVersion).isHigherThan(new Version(30))";
    const newTargetCheck = "def parseVer = { String v -> v.replaceAll(/[^0-9.]/, '').split('\\\\.').collect { it ? it.toInteger() : 0 } };\n" +
                           "        def targetVer = parseVer(cdvTargetSdkVersion);\n" +
                           "        Boolean isTargetSdkHigher = targetVer && targetVer[0] > 30;";
    
    if (content.includes(oldTargetCheck)) {
        content = content.replace(oldTargetCheck, newTargetCheck);
    }
    
    fs.writeFileSync(cordovaGradlePath, content, 'utf8');
    console.log("--- [Hook] Completely removed versioncompare dependency and logic from cordova.gradle.");
}

// 2. Исправление репозиториев по всем файлам
const filesToPatch = [
    path.join(androidFolder, 'repositories.gradle'),
    path.join(androidFolder, 'app', 'repositories.gradle'),
    path.join(androidFolder, 'CordovaLib', 'repositories.gradle'),
    path.join(androidFolder, 'plugin-build.gradle'),
    path.join(androidFolder, 'build.gradle'),
    cordovaGradlePath
];

filesToPatch.forEach(filePath => {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Меняем мертвый jcenter() на рабочий mavenCentral()
        content = content.replace(/jcenter\s*\(\s*\)/g, 'mavenCentral()');
        
        // Вырезаем старые нерабочие ссылки bintray
        content = content.replace(/maven\s*\{\s*url\s*['"]https:\/\/dl\.bintray\.com[\s\S]*?\}\s*/g, '');
        
        // Гарантируем наличие mavenCentral и google в блоках репозиториев
        if (content.includes('repositories {') && !content.includes('mavenCentral()')) {
            content = content.replace(/repositories\s*\{/g, 'repositories {\n        mavenCentral()\n        google()');
        }
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`--- [Hook] Repositories patched in: ${path.basename(filePath)}`);
    }
});

console.log("--- [Hook] Patching completed.");