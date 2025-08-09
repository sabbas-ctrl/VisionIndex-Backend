# 🎯 VisionIndex Backend

**VisionIndex** is a post-event, zone-aware presence tracking system that leverages facial recognition and advanced video analysis to extract meaningful insights from recorded CCTV footage. Designed as an academic Final Year Project at **Air University Islamabad**, this backend powers the intelligence layer of the system — enabling detection, tracking, logging, and querying of human presence across institutional environments.

This repository represents the **backend service** only. It also serves as the foundation for ongoing CI/CD, documentation, and deployment workflows.

---

## 🧠 Project Members

**Group Members:**  
- Sabbas Ahmad  
- Syed Wasif Ali Shah  
- Abdul Mueed  

**Supervisor:**  
Dr. Mehdi Hassan  
*HOD Computer Science Department, Air University, Islamabad*

---

## 🚦 Project Status & Progress

### Current Situation
- **Backend API:** Core Express.js server is up and running.
- **Database:** MongoDB integration locally, complete; models for users and video metadata implemented.
- **Authentication:** JWT-based authentication and role-based access control are functional.
- **Logging:** User activity and error logging implemented.
- **Testing:** Initial unit tests for core modules in place.

### Next Steps
- Complete detection and embedding pipeline.
- Integrate vector database for feature storage.
- Implement advanced search and analytics endpoints.
- Expand test coverage and error handling.
- Finalize dashboard and reporting modules.

---

## 🛠 Developer Commands

| Command                | Description                                         |
|------------------------|-----------------------------------------------------|
| `npm run dev`          | Start development server with hot reload             |
| `npm run linter`       | Run ESLint using `eslint.mjs` config in `app` folder |
| `npm test`             | Run all unit & integration tests in `app/tests`      |
| `npm install`          | Install project dependencies                        |

---

🌐 Live Deployment

The backend is live and can be accessed at:
🔗 https://visionindex-backend-production.up.railway.app/

This deployment is fully CI/CD-driven — any successful merge to the main branch automatically triggers build and deployment.

---
## ⚙️ CI/CD Setup

Our CI/CD pipeline is designed for reliability and rapid iteration:

1. **GitHub Actions**  
   - **Linting:** Runs ESLint and Prettier on every push and pull request.
   - **Testing:** Executes all unit and integration tests.
   - **Build:** Builds the backend and checks for dependency issues.
   - **Deployment:** (Planned) Auto-deploy to staging/production on successful main branch merges.

2. **Environment Variables**  
   - All secrets and environment-specific configs are managed via `.env` files (excluded from git).

---

## 🚀 VisionIndex Modules (Planned & In Development)

### 1. 🔐 User Authentication & Access Control
- Role-based access (Admin, Analyst, Viewer)
- Secure JWT-based session management
- Logs all login/logout and permission actions

### 2. 📥 Video Upload & Ingestion
- Interface for uploading recorded CCTV videos
- Validates video format, size, and integrity
- Extracts and logs metadata: duration, resolution, uploader, etc.

### 3. 🧹 Video Pre-Processing
- Frame extraction and normalization via OpenCV
- Detects corrupt or unreadable frames
- Logs segment structure: timestamps, frame count

### 4. 🧍‍♂️ Detection & Embedding Pipeline
- YOLOv8 for object and person detection
- DeepSort for real-time tracking with temporary IDs
- DeepFace/ReID for facial/body embedding extraction
- Tags detections with timestamps and camera sources

### 5. 🧠 Feature Vectorization & Knowledge Base
- Embedding vectors indexed in a vector DB
- Maps vectors to metadata (frame, zone, time, detection type)
- Prevents duplication via similarity checks

### 6. 🔍 Image & Text-Based Search
- Multi-modal search using image crops or tags (e.g., clothing, time)
- Filters by zone, object type, etc.
- Ranked results via cosine similarity
- Logs all queries for auditing

### 7. 📊 Visual Timeline & Replay
- Time-indexed view of matched detections
- Clickable navigation to replay exact frame positions
- Bounding boxes for clarity
- Frequency visualizations across sessions

### 8. 📈 Analytics Dashboard
- Usage statistics, tag trends, upload success rates
- Exportable charts (PDF, CSV)
- Visual insights without exposing personal data

### 9. 📝 Logging & System Audit
- Logs user activities: uploads, queries, exports
- Records warnings, failures, and system anomalies
- Generates audit trails for evaluation and traceability

---

## 🧰 Tech Stack (Planned)

- **Backend Framework:** Node.js (Express)
- **Frontend Framework:** React.js
- **Database:** MongoDB (primary), PostgreSQL (archival)
- **Object Detection:** YOLOv8
- **Face Recognition:** DeepFace, FaceNet
- **Tracking:** DeepSort
- **Vector DB:** FAISS / Pinecone / Qdrant
- **Async Tasks:** Celery + Redis
- **Video Processing:** OpenCV
- **Authentication:** JWT
- **CI/CD:** GitHub Actions

---

## 📂 Repository Structure (WIP)

```bash
visionindex-backend/
├── app/
│   ├── api/               # Express routes
│   ├── core/              # Configs, constants
│   ├── models/            # DB models
│   ├── services/          # Logic for detection, search, etc.
│   └── utils/             # Helper functions
│
├── worker/                # Celery workers for async jobs
├── tests/                 # Unit & integration tests
├── LICENSE
└── README.md
```

---

## 📌 Project Status

This backend is under active development. CI/CD, module wiring, and production logic are being integrated iteratively.

Initial goal is to implement modular, scalable, and testable service components, enabling isolated development and rapid iteration.

---

## 🔒 Contribution Policy

This is a private academic project.  
Only the original project team and authorized Air University faculty may contribute.

External pull requests, forks, and issues will not be accepted at this time.

---

## 📝 License

This project is licensed under a modified MIT license.  
Please refer to the LICENSE file for details.

---

## 📢 Notes for Evaluators

VisionIndex is being developed with real-world scalability and post-event surveillance practicality in mind. If you have any suggestions, proposed features, or critiques, please mention them during the evaluation phase or contact the
