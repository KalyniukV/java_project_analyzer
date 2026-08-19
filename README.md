# 🔍 JavaLens — High-Performance Java Architecture & Dependency Analyzer

[![Rust](https://img.shields.io/badge/rust-%23000000.svg?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-%23007acc.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT/Apache-2.0](https://img.shields.io/badge/License-MIT%20OR%20Apache--2.0-blue.svg?style=for-the-badge)](LICENSE)

**JavaLens** — це сучасний, високопродуктивний десктопний інструмент для глибокого статичного аналізу архітектури Java проєктів, виявлення прихованих залежностей, циклічних зв'язків, архітектурного дрейфу (Architecture Drift), моделювання наслідків рефакторингу (Impact Analysis) та аналізу готовності до мікросервісного винесення (Microservice Extraction Assistant).

---

## ✨ Ключові можливості

- ⚡ **Надшвидкий синтаксичний AST-сканер на Rust**:
  - Миттєвий аналіз десятків тисяч файлів та класів за мілісекунди без потреби компіляції чи встановлення сторонніх утиліт.
  - Підтримка багатомодульних проєктів **Maven Multi-module** (`pom.xml`) та **Gradle Multi-project** (`settings.gradle` / `settings.gradle.kts`).
- 🌐 **Підтримка GWT (Google Web Toolkit) & RPC-архітектури**:
  - Автодетекція `*.gwt.xml` та `web.xml` дескрипторів.
  - Зв'язування синхронних `RemoteService` контрактів, асинхронних клієнтських проксі `*Async` та серверних сервлетів `RemoteServiceServlet`.
  - Побудова наскрізного ланцюга викликів від GWT UI/Presenter безпосередньо до бекенд-сервісів та репозиторіїв.
- 🎯 **Метод- та Поле-орієнтований Call Graph (Call Hierarchy з глибиною Depth 1..5)**:
  - Детальний розбір параметрів, типів, видимості та анотацій методів.
  - Двосторонній граф викликів: **Inbound Callers (хто викликає / Fan-In)** та **Outbound Callees (кого викликає / Fan-Out)** з покроковою глибиною (`Hop ±1`, `Hop ±2`...).
- 🏛️ **Architecture Drift Detection**:
  - Автоматичний аудит чистої шаруватої архітектури (`UI / Web` ➔ `Service` ➔ `Domain` ➔ `Infrastructure`).
  - Виявлення заборонених прямих викликів (наприклад, звернення контролера напряму до БД в обхід бізнес-шару).
- 💥 **Impact Analysis & Blast Radius**:
  - Моделювання наслідків зміни будь-якого класу чи методу до виконання рефакторингу.
  - Розрахунок площі ураження та оцінка ризику (`Critical`, `High`, `Medium`, `Low`).
- 🧩 **Microservice Extraction Assistant**:
  - Аналіз готовності модулів/пакетів до відокремлення (`Readiness Score 0–100%`).
  - Виявлення вхідних і вихідних блокерів та покроковий Roadmap міграції.
- 💾 **Вбудована вбудована NoSQL база даних (Redb)**:
  - Автономне збереження результатів сканування без потреби встановлення сторонніх СУБД.
- 🎨 **Сучасний інтерактивний веб-інтерфейс (React + XYFlow)**:
  - Кілька режимів розміщення: **«Шари» (Layered)**, **«Пакети» (Clusters)**, **«Фокус 3-Колонки» (Radial Focus)**, **«Сітка» (Grid)**.
  - Фільтрація за модулями, пакетами, приховування DTO та режим **«Зовнішні зв'язки (External Boundaries)»**.

---

## 🚀 Швидкий запуск

### Вимоги:
- **Rust toolchain** (1.75+) — `cargo`, `rustc`
- **Node.js** (18+ або 20+) та `npm`

### 1. Збірка фронтенду
```bash
cd frontend
npm install
npm run build
cd ..
```

### 2. Запуск сервера
```bash
# Запуск із демо-проєктом PetClinic:
cargo run -p desktop-app -- "fixtures/sample-petclinic"

# АБО з GWT RPC проєктом:
cargo run -p desktop-app -- "fixtures/sample-gwt-app"

# АБО чистий запуск (вибір проєкту через вбудований провідник):
cargo run -p desktop-app
```

Відкрийте у браузері: 👉 **`http://localhost:3030`**

---

## 🧪 Запуск тестів

```bash
cargo test --workspace
```

---

## 📦 Структура репозиторію

```text
├── crates/
│   ├── graph-core/      # Ядро аналізу: моделі, графи petgraph, алгоритми, Redb NoSQL
│   └── desktop-app/     # Нативний AST-сканер, HTTP REST API сервер (Axum), діалоги
├── frontend/            # React 18 + TypeScript + Vite + Tailwind CSS + XYFlow
└── fixtures/            # Тестові Java/GWT стенди для верифікації
```

---

## 📄 Ліцензія

Розповсюджується під ліцензією MIT або Apache-2.0.
