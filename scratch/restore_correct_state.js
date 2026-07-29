const fs = require('fs');
const path = require('path');

const backupDir = 'c:\\Users\\anikh\\Desktop\\main project v3.1\\scratch\\temp_backup_tonight';
const destDir = 'c:\\Users\\anikh\\Desktop\\main project v3.1';
const originalSrcDir = 'c:\\Users\\anikh\\Desktop\\ppppp\\main project';

const ignoreList = ['.git', 'node_modules', '.next', 'scratch'];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const files = fs.readdirSync(src);
    files.forEach(file => {
      if (ignoreList.includes(file)) return;
      copyRecursive(path.join(src, file), path.join(dest, file));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('Step 1: Restoring entire workspace state from tonight\'s pre-revert backup (with Slider & Collapsible Categories)...');
copyRecursive(backupDir, destDir);

console.log('\nStep 2: Overwriting post-ad page with the original stable working version...');
fs.copyFileSync(
  path.join(originalSrcDir, 'src', 'app', 'post-ad', 'page.js'),
  path.join(destDir, 'src', 'app', 'post-ad', 'page.js')
);

console.log('\nStep 3: Overwriting post-ad module CSS with the original stable working version...');
fs.copyFileSync(
  path.join(originalSrcDir, 'src', 'app', 'post-ad', 'post-ad.module.css'),
  path.join(destDir, 'src', 'app', 'post-ad', 'post-ad.module.css')
);

console.log('\nRestore completed successfully!');
