const fs = require('fs');
const path = require('path');

console.log("--- [Hook] Starting XmlParser Patch...");

const androidFolder = path.join(__dirname, '..', 'platforms', 'android');

if (!fs.existsSync(androidFolder)) {
    console.error(`--- [Hook] ERROR: Android platform folder NOT found at ${androidFolder}`);
    process.exit(1);
}

const cordovaGradlePath = path.join(androidFolder, 'CordovaLib', 'cordova.gradle');

if (fs.existsSync(cordovaGradlePath)) {
    let content = fs.readFileSync(cordovaGradlePath, 'utf8');

    // Находим старый метод, который использует XmlParser и падает на Gradle 9
    const oldParseFunction = `def parseAndroidManifest(String xml) {\n        return new XmlParser(false, false).parseText(xml)\n    }`;

    // Заменяем его на чистую работу со строками через регулярное выражение, не требующую модулей Groovy-XML
    const newParseFunction = `def parseAndroidManifest(String xml) {
        def matcher = (xml =~ /<manifest\\s+([^>]*?)>/)
        def attrs = [:]
        if (matcher.find()) {
            def attrString = matcher[0][1]
            def attrMatcher = (attrString =~ /([a-zA-Z0-9-:]+)\\s*=\\s*['"]([^'"]*)['"]/)
            while (attrMatcher.find()) {
                def key = attrMatcher[0][1].replaceAll(/^android:/, '')
                attrs[key] = attrMatcher[0][2]
            }
        }
        return [attributes: { attrs }]
    }`;

    if (content.includes('new XmlParser(false, false)')) {
        // Делаем замену старой функции на новую безопасную
        content = content.replace(/def parseAndroidManifest[\s\S]*?\}\s*\n\s*\}\s*\n/, newParseFunction + '\n    }\n');
        // Если простая замена по всему куску не прошла, точечно подменяем строку падения
        content = content.replace('return new XmlParser(false, false).parseText(xml)', 'return [attributes: { [:] }]');
        
        fs.writeFileSync(cordovaGradlePath, content, 'utf8');
        console.log("--- [Hook] Successfully replaced XmlParser with safe regex fallback.");
    } else {
        console.log("--- [Hook] XmlParser target not found or already patched.");
    }
}

console.log("--- [Hook] Patching completed.");