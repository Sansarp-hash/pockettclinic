const fs = require('fs');
let code = fs.readFileSync('src/components/ConsultationRoom.tsx', 'utf8');

// 1. Remove {!isPatientFaceTimeMode && ( above the Header Row
const searchHeaderStart = "{/* Header Row */}\n          {!isPatientFaceTimeMode && (";
const replaceHeaderStart = "{/* Header Row */}";

if (code.includes(searchHeaderStart)) {
  code = code.replace(searchHeaderStart, replaceHeaderStart);
} else {
  // Let's do a more robust regex check in case of spacing variations
  code = code.replace(/\{\/\* Header Row \*\/\}\s*\{\!isPatientFaceTimeMode \&\& \(/g, "{/* Header Row */}");
}

// 2. Remove the matching )} for the Header Row block
// Line 2989 is: '          )}' right after '          </div>' and before '{/* On-Hold Session Extension Alert Banner */}'
const searchHeaderEnd = "          </div>\n          )}\n\n          {/* On-Hold Session Extension Alert Banner */}";
const replaceHeaderEnd = "          </div>\n\n          {/* On-Hold Session Extension Alert Banner */}";

if (code.includes(searchHeaderEnd)) {
  code = code.replace(searchHeaderEnd, replaceHeaderEnd);
} else {
  // Fallback regex replacement
  code = code.replace(/<\/div>\s*\)\}\s*\{\/\* On-Hold Session Extension Alert Banner \*\/\}/g, "</div>\n\n          {/* On-Hold Session Extension Alert Banner */}");
}

// 3. Hide the floating badge name overlay on mobile
const searchBadge = '          <div className="absolute top-16 left-4 bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-bold text-white flex items-center gap-2 border border-white/20 z-20">';
const replaceBadge = '          <div className="hidden md:flex absolute top-16 left-4 bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-bold text-white items-center gap-2 border border-white/20 z-20">';

if (code.includes(searchBadge)) {
  code = code.replace(searchBadge, replaceBadge);
}

fs.writeFileSync('src/components/ConsultationRoom.tsx', code);
console.log("Patched patient FaceTime view successfully");
