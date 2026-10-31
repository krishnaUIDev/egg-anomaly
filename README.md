# 🥚 EggScan Enterprise Monorepo

Enterprise-grade multi-defect egg anomaly detection, phone camera inspection, and USDA commercial quality grading platform organized as a production-ready **monorepo**.

---

## 📁 Monorepo Structure

```text
egg-anomaly/
├── server/                      # FastAPI Computer Vision & Grading Microservice
│   ├── app/
│   │   ├── config.py            # Environment & CORS configuration
│   │   ├── main.py              # Single/batch inspection, probes, telemetry
│   │   └── schemas.py           # Pydantic request & response models
│   ├── core/
│   │   ├── preprocessing.py     # EXIF correction, LAB CLAHE, Egg ROI
│   │   ├── anomaly_engine.py    # Cracks, stains, blood spots, shape deformities
│   │   └── grading.py           # USDA Commercial Grade standardizer
│   ├── datasets/                # Synthetic egg generator & benchmark samples
│   ├── tests/                   # Pytest test suite (12/12 passing)
│   ├── Dockerfile               # Multi-stage Python 3.13 production image
│   ├── requirements.txt
│   └── run.py                   # Local launcher with phone network access
│
├── frontend/                    # Next.js 16 Web Application (App Router)
│   ├── src/app/
│   │   ├── layout.tsx           # Accessible layout with dark-mode color-scheme
│   │   ├── globals.css          # Tailwind CSS styling
│   │   └── page.tsx             # Studio, Tray Batch QC, CSV Export, SLA
│   ├── next.config.ts           # Standalone bundle & API proxy configuration
│   ├── package.json
│   └── Dockerfile               # Multi-stage Next.js standalone container
│
├── k8s/                         # Kubernetes Enterprise Manifests
│   ├── namespace.yaml
│   ├── backend-deployment.yaml
│   ├── frontend-deployment.yaml
│   └── ingress.yaml             # NGINX Ingress with TLS routing
│
├── .github/workflows/ci.yml     # Automated CI/CD (Pytest, Next.js build, Docker check)
├── docker-compose.yml           # Local multi-service orchestration
├── package.json                 # Monorepo root workspace scripts
└── README.md
```

---

## 🚀 Quick Start (Monorepo Root)

### Option 1: Run with Monorepo NPM Scripts

```bash
# 1. Install root & frontend dependencies
npm install

# 2. Run Next.js frontend development server
npm run dev:frontend
# -> http://localhost:3000

# 3. In a second terminal, run the Python server
npm run dev:server
# -> http://localhost:8000 (API docs at /docs)

# 4. Run automated server test suite
npm run test:server
```

---

### Option 2: Docker Compose (Production Stack)

Build and run both containers on an isolated bridge network with healthchecks:

```bash
# Build and run in detached mode
npm run docker:up

# View live streaming logs
npm run docker:logs

# Tear down containers
npm run docker:down
```

- **Next.js Web Console**: **[http://localhost:3000](http://localhost:3000)**
- **FastAPI Microservice**: **[http://localhost:8000](http://localhost:8000)**
- **API Swagger Documentation**: **[http://localhost:8000/docs](http://localhost:8000/docs)**
- **Health & Probes**: `http://localhost:8000/healthz`, `/livez`, `/readyz`

---

### Option 3: Kubernetes Deployment

Deploy to your production Kubernetes cluster:

```bash
# 1. Create production namespace
kubectl apply -f k8s/namespace.yaml

# 2. Deploy backend service & probes
kubectl apply -f k8s/backend-deployment.yaml

# 3. Deploy Next.js frontend
kubectl apply -f k8s/frontend-deployment.yaml

# 4. Configure Ingress with TLS
kubectl apply -f k8s/ingress.yaml
```

---

## 🧪 Testing & Verification

- **Backend Pytest**: `npm run test:server` (12/12 passing)
- **Frontend Build**: `npm run build:frontend` (Compiled successfully with Turbopack)
- **CI/CD Pipeline**: Automated via `.github/workflows/ci.yml`
