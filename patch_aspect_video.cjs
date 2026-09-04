const fs = require('fs');
let code = fs.readFileSync('src/components/ConsultationRoom.tsx', 'utf8');

// Replace aspect-video with w-full h-full flex-1 and handle rounded corners on mobile
const targetStr = "role === 'consultant' ? 'aspect-video md:flex-1' : (!isAcceptedSession ? 'w-full min-h-[420px] lg:aspect-auto lg:flex-1' : 'w-full aspect-video lg:aspect-auto lg:flex-1')";
const replacementStr = "role === 'consultant' ? 'w-full h-full flex-1 rounded-none md:rounded-[32px]' : (!isAcceptedSession ? 'w-full min-h-[420px] lg:aspect-auto lg:flex-1' : 'w-full aspect-video lg:aspect-auto lg:flex-1')";

code = code.replace(targetStr, replacementStr);
fs.writeFileSync('src/components/ConsultationRoom.tsx', code);
console.log("Patched successfully");
