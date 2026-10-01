import { defineConfig } from 'vitest/config';
export default defineConfig({test:{include:['tests/unit.test.ts','tests/access.test.ts','tests/review-pack.test.ts','tests/pic.test.ts','tests/session-policy.test.ts','tests/questions.test.ts','tests/question-hub.test.ts','tests/ux-remediation.test.ts','tests/client-questionnaire.test.ts'],environment:'node'}});
