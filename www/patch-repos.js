const fs = require('fs');
const path = require('path');

module.exports = function(context) {
    const platformRoot = path.join(context.opts.projectRoot, 'platforms/android');
    if (!fs.existsSync(platformRoot)) {
        console.log('--- [Hook] Android platform root not found yet, skipping.');
        return;
    }

    console.log('--- [Hook] Executing Total-Rewrite before_build patcher...');

    // 1. Полностью переписываем cordova.gradle стабильным каркасом БЕЗ класса Version
    const cordovaGradlePath = path.join(platformRoot, 'CordovaLib/cordova.gradle');
    try {
        const stableCordovaGradle = `// Patched by BatteryGuard Build Hook
import java.util.regex.Pattern

// Глобальные объекты, которые ищет app/build.gradle
ext.cdvHelpers = this
ext.privateHelpers = this

Boolean isSupportedVersion(String version) {
    return true
}

def findLatestInstalledBuildTools(String buildToolsVersion) {
    return buildToolsVersion
}

Boolean cdvIsNativeDimensDefined() {
    def targetNode = cdvGetManifestNode()
    def nativeDimens = targetNode.attributes()['xmlns:android'] != null
    return nativeDimens
}

def cdvGetManifestNode() {
    def manifestFile = file(android.sourceSets.main.manifest.srcFile)
    def manifest = new XmlParser(false, false).parse(manifestFile)
    return manifest
}

def cdvGetConfigPreference(String name) {
    name = name.toLowerCase()
    def xml = file("src/main/res/xml/config.xml")
    if (!xml.exists()) return null
    def config = new XmlParser(false, false).parse(xml)
    def pref = config.preference.find { it.attributes()['name'].toLowerCase() == name }
    return pref ? pref.attributes()['value'] : null
}
`;
        fs.writeFileSync(cordovaGradlePath, stableCordovaGradle, 'utf8');
        console.log('--- [Hook] cordova.gradle has been TOTALLY rewritten with stable context.');
    } catch (e) {
        console.error('--- [Hook] Failed to rewrite cordova.gradle:', e);
    }

    // 2. Очистка остальных файлов
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
            if (file.endsWith('cordova.gradle')) return; // Мы его уже переписали выше

            let content = fs.readFileSync(file, 'utf8');
            let changed = false;

            if (content.indexOf('com.g00fy2:versioncompare') !== -1) {
                let lines = content.split('\n');
                let filteredLines = lines.filter(function(line) {
                    return line.indexOf('com.g00fy2:versioncompare') === -1;
                });
                content = filteredLines.join('\n');
                changed = true;
            }

            if (content.indexOf('jcenter()') !== -1) {
                content = content.split('jcenter()').join('mavenCentral()');
                changed = true;
            }

            if (changed) {
                fs.writeFileSync(file, content, 'utf8');
                console.log('--- [Hook] Cleaned repositories in: ' + path.basename(file));
            }
        });
    } catch (err) {
        console.error('--- [Hook] Error inside walk block: ' + err);
    }
};