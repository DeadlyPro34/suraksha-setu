import os
import json

def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

# Frontend Files
write_file("frontend/package.json", json.dumps({
  "name": "frontend",
  "version": "0.1.0",
  "private": True,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.3",
    "react": "^18",
    "react-dom": "^18"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "eslint": "^8",
    "eslint-config-next": "14.2.3",
    "postcss": "^8",
    "tailwindcss": "^3.4.1",
    "typescript": "^5"
  }
}, indent=2))

write_file("frontend/tsconfig.json", json.dumps({
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": True,
    "skipLibCheck": True,
    "strict": True,
    "noEmit": True,
    "esModuleInterop": True,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": True,
    "isolatedModules": True,
    "jsx": "preserve",
    "incremental": True,
    "plugins": [{"name": "next"}],
    "paths": {"@/*": ["./*"]}
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}, indent=2))

write_file("frontend/next.config.js", "/** @type {import('next').NextConfig} */\nconst nextConfig = {};\nmodule.exports = nextConfig;")
write_file("frontend/tailwind.config.ts", "import type { Config } from 'tailwindcss'\nconst config: Config = {\n  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],\n  theme: { extend: {} },\n  plugins: [],\n}\nexport default config;")
write_file("frontend/postcss.config.js", "module.exports = {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n}")
write_file("frontend/.eslintrc.json", json.dumps({"extends": "next/core-web-vitals"}, indent=2))

# Frontend App Files
write_file("frontend/app/layout.tsx", "import './globals.css'\nexport const metadata = { title: 'Suraksha Setu', description: 'Suraksha Setu Application' }\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (<html lang=\"en\"><body>{children}</body></html>)\n}")
write_file("frontend/app/globals.css", "@tailwind base;\n@tailwind components;\n@tailwind utilities;")
write_file("frontend/app/page.tsx", "import { redirect } from 'next/navigation';\nexport default function Home() { redirect('/citizen'); }")
write_file("frontend/app/(citizen)/page.tsx", "export default function CitizenHome() { return <div>Citizen Home</div>; }")
write_file("frontend/app/(citizen)/report/page.tsx", "export default function ReportIncident() { return <div>Report Incident</div>; }")
write_file("frontend/app/(citizen)/shelters/page.tsx", "export default function NearbyShelters() { return <div>Nearby Shelters</div>; }")
write_file("frontend/app/(official)/dashboard/page.tsx", "export default function CommandDashboard() { return <div>Command Dashboard</div>; }")
write_file("frontend/app/(official)/incidents/page.tsx", "export default function IncidentsFeed() { return <div>Incidents Feed</div>; }")
write_file("frontend/app/(official)/approvals/page.tsx", "export default function ApprovalsQueue() { return <div>Approvals Queue</div>; }")
write_file("frontend/app/login/page.tsx", "export default function Login() { return <div>Login</div>; }")
write_file("frontend/components/.gitkeep", "")
write_file("frontend/lib/api.ts", "export const fetchApi = async (path: string, options?: RequestInit) => {\n  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, options);\n  return res.json();\n};")
write_file("frontend/lib/types.ts", "export interface User {}\nexport interface Report {}\nexport interface Incident {}\nexport interface Shelter {}\nexport interface Resource {}\nexport interface ResponsePlan {}\nexport interface Approval {}\nexport interface Alert {}")

write_file("frontend/Dockerfile", '''FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
CMD ["npm", "run", "dev"]
''')

# Backend Files
write_file("backend/requirements.txt", "fastapi\nuvicorn\npydantic-settings\nsqlalchemy\nalembic\npsycopg2-binary\n")
write_file("backend/app/main.py", "from fastapi import FastAPI\napp = FastAPI()\n@app.get('/health')\ndef health():\n    return {'status': 'ok'}\n")
write_file("backend/app/api/routes/.gitkeep", "")
write_file("backend/app/core/config.py", "from pydantic_settings import BaseSettings\nclass Settings(BaseSettings):\n    DATABASE_URL: str = ''\n    class Config:\n        env_file = '.env'\nsettings = Settings()")
write_file("backend/app/core/database.py", "from sqlalchemy import create_engine\nfrom .config import settings\nif settings.DATABASE_URL:\n    engine = create_engine(settings.DATABASE_URL)\nelse:\n    engine = None")
write_file("backend/app/models/.gitkeep", "")
write_file("backend/app/schemas/.gitkeep", "")
write_file("backend/app/services/ingestion/.gitkeep", "")
write_file("backend/app/services/verification/.gitkeep", "")
write_file("backend/app/services/notifications/.gitkeep", "")
write_file("backend/app/agents/.gitkeep", "")
write_file("backend/app/db/session.py", "def get_db():\n    pass")
write_file("backend/app/db/migrations/alembic.ini", "[alembic]\nscript_location = app/db/migrations\n")
write_file("backend/app/db/migrations/env.py", "# Alembic env stub\n")

write_file("backend/Dockerfile", '''FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
''')

print("Scaffolding complete!")
