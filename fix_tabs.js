const fs = require('fs');
let content = fs.readFileSync('src/components/ConsultationRoom.tsx', 'utf8');

content = content.replace(/<button[^>]*?onClick=\{\(\) => \{\s*setActiveOverlay\(activeOverlay === 'chat' \? null : 'chat'\);\s*setShowFolderDropdown\(false\);\s*\}\}[\s\S]*?<span>Secure Chat<\/span>\s*<\/button>/g, `{!isChatType && (
$&
)}`);

fs.writeFileSync('src/components/ConsultationRoom.tsx', content);
