# Agents Guide: ProEnglish

## Tech Stack
- **Frontend**: Angular 18 (Standalone Components only, no `NgModules`)
- **Styling**: Tailwind CSS (Layout/Core), Vanilla CSS (Complex animations/3D)
- **Backend/BaaS**: Firebase (Auth for mandatory login, Firestore for Profile/Streak/XP/Rank)
- **Storage**: IndexedDB (Flashcards, SuperMemo-2 parameters); Phrase Lab SM-2 reviews (localStorage + Firestore when authed)
- **Deployment**: Vercel (Frontend + Serverless Functions for AI proxy)
- **AI**: Google Gemini 1.5 Flash (via Vercel functions)

## Developer Commands
Commands must be run inside the `web/` directory:
- `npm run start`: Start development server (`ng serve`)
- `npm run build`: Build for production (`ng build`)
- `npm run watch`: Development build with watch mode
- `npm run test`: Run unit tests via Karma

## Coding Standards & Conventions
- **TypeScript**: Strict mode enabled (`strict: true`). Avoid `any`.
- **State Management**: Use **RxJS (BehaviorSubject, Observable)**. Avoid Angular Signals for now to maintain a clear data flow for future migration.
- **UI/UX**: 
    - **Mobile-First**: All layouts default to mobile; use Tailwind breakpoints for tablet/desktop.
    - **Aesthetics**: Glassmorphism, soft HSL colors, `rounded-2xl`, and high-quality visual effects.
- **Architecture (Feature-based)**:
    - `src/app/core/`: Singleton logic, Firebase config, services, guards, interceptors.
    - `src/app/shared/`: Reusable UI components (Buttons, Modals, etc.).
    - `src/app/features/`: Lazy-loaded business logic (e.g., `/auth`, `/dashboard`, `/flashcards`, `/minigames`, `/bossfight`).
- **Security**: AI API calls MUST go through `/api` Vercel Serverless Functions. Never expose API keys in the frontend.
- **Data Handling**: Use static JSON files in `/assets/data/` for course content to minimize Firestore read costs.

## Operational Gotchas
- **Auth**: All routes are guarded except Login and Landing pages.
- **Zero-Cost**: Prioritize Browser Native APIs (Web Speech API for TTS/STT) and static assets over server-side processing.
