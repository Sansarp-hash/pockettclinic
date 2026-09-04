const fs = require('fs');
let content = fs.readFileSync('src/components/ConsultationRoom.tsx', 'utf8');

content = content.replace(/<button[\s\S]*?setActiveOverlay\(activeOverlay === 'chat' \? null : 'chat'\);[\s\S]*?<span>Secure Chat<\/span>\s*<\/button>/g, match => `{(!isChatType || activeConsultation?.type !== 'chat') && (\n${match}\n)}`);

fs.writeFileSync('src/components/ConsultationRoom.tsx', content);
