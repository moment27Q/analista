const { execSync } = require('child_process');

console.log("Installing xlsx...");
try {
    execSync('npm install xlsx --save', { stdio: 'inherit' });
    console.log("Installation done");
} catch (e) {
    console.error("Error", e);
}
