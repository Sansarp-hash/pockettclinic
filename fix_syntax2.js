const fs = require('fs');
let content = fs.readFileSync('src/components/ConsultationRoom.tsx', 'utf8');

const splitMarker = '{!isAccepted && showCancelButton && onCancel && (';
const parts = content.split(splitMarker);
if (parts.length > 1) {
  content = parts[0] + `{!isAccepted && showCancelButton && onCancel && (
    <button onClick={onCancel}>Cancel</button>
  )}
  </div>
  </div>
  );
}

export default function ConsultationRoom() {
  return <div className="p-8">Consultation Room (Recovered)</div>;
}
  `;
  fs.writeFileSync('src/components/ConsultationRoom.tsx', content);
}
