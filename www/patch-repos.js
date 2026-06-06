const fs = require('fs');
const path = require('path');

module.exports = function(context) {
    const projectRoot = context.opts.projectRoot;
    const platformRoot = path.join(projectRoot, 'platforms/android');
    if (!fs.existsSync(platformRoot)) return;

    // 1. Создаем локальную Java-заглушку для обмана Cordova import
    const targetDir = path.join(platformRoot, 'CordovaLib/src/main/java/com/g00fy2/versioncompare');
    const targetFile = path.join(targetDir, 'Version.java');

    try {
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        
        const javaDummyCode = `package com.g00fy2.versioncompare;
public class Version {
    private String v;
    public Version(String version) { this.v = version; }
    public boolean isHigherThan(String other) { return false; }
    public boolean isLowerThan(String other) { return false; }
    public int compareTo(Version other) { return 0; }
}`;
        
        fs.writeFileSync(targetFile, javaDummyCode, 'utf8');
        console.log('--- [Hook] Dummy Version.java successfully generated.');
    } catch (e) {
        console.error('--- [Hook] Failed to create Java dummy:', e);
    }

    // 2. Исправляем репозитории и перенаправляем classpath в gradle-файлах
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

            // Чиним репозитории
            if (content.includes('jcenter()')) {
                content = content.replace(/jcenter\(\)/g, 'mavenCentral()');
                changed = true;
            }

            // Внедряем подмену отсутствующей библиотеки во все buildscript блоки
            if (content.includes('buildscript {') && !content.includes('dependencySubstitution')) {
                const substitutionCode = `buildscript {
    configurations.all {
        resolutionStrategy.dependencySubstitution {
            substitute module('com.g00fy2:versioncompare:1.3.4') because 'JCenter is dead' with module('org.jetbrains:annotations:13.0')
        }
    }`;
                content = content.replace('buildscript {', substitutionCode);
                changed = true;
            }

            if (changed) {
                fs.writeFileSync(file, content, 'utf8');
                console.log(`--- [Hook] Injected patch rules into: ${path.basename(file)}`);
            }
        });
    } catch (err) {
        console.error('--- [Hook] Error while modifying gradle files:', err);
    }
};