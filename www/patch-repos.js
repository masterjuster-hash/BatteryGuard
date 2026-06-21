const fs = require('fs');
const path = require('path');

console.log("--- [Hook] Starting Fixed-Dependency injection patcher...");

// Cordova запускает хук из корня проекта, поэтому platforms лежит рядом
const androidFolder = path.join(__dirname, '..', 'platforms', 'android');

console.log(`--- [Hook] Checking Android folder at: ${androidFolder}`);

if (!fs.existsSync(androidFolder)) {
    console.error(`--- [Hook] ERROR: Android platform folder NOT found at ${androidFolder}`);
    process.exit(1); // Если папки нет — роняем билд сразу, чтобы увидеть ошибку, а не маскировать её
}

// 1. Правим cordova.gradle: убираем импорт библиотеки versioncompare
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
        console.log("--- [Hook] Successfully patched cordova.gradle (removed versioncompare)");
    }
}

// 2. Исправляем репозитории во всех gradle файлах
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
        content = content.replace(/repositories\s*\{[\s\S]*?\}/g, '');
        content = secureRepositories + "\n" + content;
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`--- [Hook] Successfully patched repositories in: ${path.basename(filePath)}`);
    }
});

console.log("--- [Hook] Patching completed successfully.");