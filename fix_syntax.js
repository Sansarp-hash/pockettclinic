const fs = require('fs');
let content = fs.readFileSync('src/components/ConsultationRoom.tsx', 'utf8');

// Find the corrupted end of WaitingOverlay
const endStr = `{!isAccepted && showCancelButton && onCancel && (
                  </button>
                  </button>
                  </button>`;

if (content.includes(endStr)) {
  content = content.replace(endStr, `{!isAccepted && showCancelButton && onCancel && (
    <button onClick={onCancel}>Cancel</button>
  )}
  </div>
  </div>
  );
}

export default function ConsultationRoom() {
  return <div className="p-8">Consultation Room (Recovered)</div>;
}
  `);
  fs.writeFileSync('src/components/ConsultationRoom.tsx', content);
}
