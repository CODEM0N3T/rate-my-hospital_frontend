# Rate-My-Hospital_Frontend

Search U.S. hospitals, see CMS HCAHPS metrics, and crowd-rate experiences.  
Frontend (Vite/React) + Cloudflare Worker proxy for CMS data and photos.

## 🔗 Live App

- **Frontend:** https://deploy-preview-1--rate-my-hospital.netlify.app/ or http://localhost:3003/
- **API/Proxy:** https://rmh-proxy.rate-my-hospital.workers.dev



## ✨ Features

- 🔎 Hospital search by name/city/state (CMS Hospital General Information).
- ⭐ HCAHPS highlights per hospital (patient survey metrics).
- 📝 Anonymous user reviews with local stats & distribution.
- 🖼️ Photo thumbnails via Google Street View (with safe fallback).
- ⚡ API proxy with Socrata-first + CMS Provider Data Catalog (PDC) CSV fallback.

## 🧱 Tech

- React (Vite), CSS Grid/Flex
- Cloudflare Workers (Wrangler)
- Data: Socrata (data.medicare.gov), CMS PDC (data.cms.gov)
- Images: Google Street View Static API (with placeholders)

>>>>>>> 1817fe526eba78e94ff3a0b7b767b41849de79a3
