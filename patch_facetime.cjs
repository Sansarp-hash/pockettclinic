const fs = require('fs');
let code = fs.readFileSync('src/components/ConsultationRoom.tsx', 'utf8');

// Fix 1: Remove h-[50vh] and make it always stretch
code = code.replace(
  /\? \(isWorkspaceCollapsed \? 'h-full' \: 'h-\[50vh\] lg:h-auto'\) \\/,
  "? 'h-full' \\"
);
code = code.replace(
  /isConsultant \n            \? \(isWorkspaceCollapsed \? 'h-full' \: 'h-\[50vh\] lg:h-auto'\) \n            : ''/g,
  "isConsultant ? 'h-full' : ''"
);

// Fix 2: Remove space-y-4 on mobile
code = code.replace(
  /\$\{isPatientFaceTimeMode \? 'space-y-0 h-full' : 'space-y-4'\}/g,
  "space-y-0 md:space-y-4 h-full"
);

// Fix 3: Remove rounded corners on mobile for the main video stage
code = code.replace(
  /'relative w-full h-full bg-slate-950 rounded-\[32px\] overflow-hidden'/g,
  "'relative w-full h-full bg-slate-950 rounded-none md:rounded-[32px] overflow-hidden'"
);

// Fix 4: Ensure outer container is tight on mobile
code = code.replace(
  /bg-\[\#F8FAFC\] md:bg-transparent p-0 sm:p-4 lg:p-6/g,
  "bg-[#F8FAFC] md:bg-transparent p-0 md:p-4 lg:p-6"
);

fs.writeFileSync('src/components/ConsultationRoom.tsx', code);
console.log("Patched successfully");
