const fs = require('fs');
const path = require('path');

console.log("--- [Hook] Starting Precise Dependency Patcher...");

const androidFolder = path.join(__dirname, '..', 'platforms', 'android');

if (!fs.existsSync(androidFolder)) {
    console.error(`--- [Hook] ERROR: Android platform folder NOT found at ${androidFolder}`);
    process.exit(1);
}

// 1. Исправление cordova.gradle (убираем старый versioncompare)
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

// 2. Исправление репозиториев
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
        
        // Вместо удаления блоков, мы просто заменяем jcenter() и старые вызовы на mavenCentral() и google()
        content = content.replace(/jcenter\s*\(\s*\)/g, 'mavenCentral()');
        content = content.replace(/maven\s*\{\s*url\s*['"]https:\/\/dl\.bintray\.com[\s\S]*?\}\s*/g, '');
        
        // Явно гарантируем, что mavenCentral() присутствует во всех блоках repositories
        if (content.includes('repositories {') && !content.includes('mavenCentral()')) {
            content = content.replace(/repositories\s*\{/g, 'repositories {\n        mavenCentral()\n        google()');
        }
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`--- [Hook] Metric patched: ${path.basename(filePath)}`);
    }
});

console.log("--- [Hook] Patching completed.");