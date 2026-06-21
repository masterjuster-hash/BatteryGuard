const fs = require('fs');
const path = require('path');

console.log("--- [Hook] Starting AGGRESSIVE Injection Patcher...");

const androidFolder = path.join(__dirname, '..', 'platforms', 'android');

if (!fs.existsSync(androidFolder)) {
    console.error(`--- [Hook] ERROR: Android platform folder NOT found at ${androidFolder}`);
    process.exit(1);
}

// 1. Избавляемся от versioncompare в cordova.gradle
const cordovaGradlePath = path.join(androidFolder, 'CordovaLib', 'cordova.gradle');
if (fs.existsSync(cordovaGradlePath)) {
    let content = fs.readFileSync(cordovaGradlePath, 'utf8');
    if (content.includes("import com.g00fy2.versioncompare.Version")) {
        content = content.replace("import com.g00fy2.versioncompare.Version", "");
        const oldTargetCheck = "Boolean isTargetSdkHigher = new Version(cdvTargetSdkVersion).isHigherThan(new Version(30))";
        const newTargetCheck = "def parseVer = { String v -> v.replaceAll(/[^0-9.]/, '').split('\\\\.').collect { it ? it.toInteger() : 0 } };\n" +
                               "        def targetVer = parseVer(cdvTargetSdkVersion);\n" +
                               "        Boolean isTargetSdkHigher = targetVer && targetVer[0] > 30;";
        content = content.replace(oldTargetCheck, newTargetCheck);
        fs.writeFileSync(cordovaGradlePath, content, 'utf8');
        console.log("--- [Hook] Patched cordova.gradle successfully.");
    }
}

// 2. Полная зачистка jcenter() во всех файлах конфигурации
const filesToPatch = [
    path.join(androidFolder, 'repositories.gradle'),
    path.join(androidFolder, 'app', 'repositories.gradle'),
    path.join(androidFolder, 'CordovaLib', 'repositories.gradle'),
    path.join(androidFolder, 'plugin-build.gradle'),
    path.join(androidFolder, 'build.gradle')
];

filesToPatch.forEach(filePath => {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Тотальное удаление любого упоминания jcenter()
        content = content.replace(/jcenter\s*\(\s*\)/g, '');
        
        // Удаляем старые блоки репозиториев, если остались
        content = content.replace(/repositories\s*\{[\s\S]*?\}/g, '');
        
        // Вшиваем чистые репозитории в самое начало файла
        const secureRepositories = `\nrepositories {\n    maven { url "https://repo.maven.apache.org/maven2/" }\n    google()\n    maven { url "https://plugins.gradle.org/m2/" }\n}\n`;
        content = secureRepositories + content;
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`--- [Hook] Aggressively patched: ${path.basename(filePath)}`);
    }
});

console.log("--- [Hook] Aggressive patching completed.");