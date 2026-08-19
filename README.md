# 🔍 JavaLens — High-Performance Java Architecture & Dependency Analyzer

[![Tauri](https://img.shields.io/badge/tauri-2.0-%2324C8DB.svg?style=for-the-badge&logo=tauri&logoColor=white)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/rust-%23000000.svg?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-%23007acc.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT/Apache-2.0](https://img.shields.io/badge/License-MIT%20OR%20Apache--2.0-blue.svg?style=for-the-badge)](LICENSE)

**JavaLens** — це повністю автономний, нативний десктопний інструмент на базі **Tauri 2.0** та **Rust** для глибокого статичного аналізу архітектури Java проєктів, виявлення прихованих залежностей, циклічних зв'язків, архітектурного дрейфу (Architecture Drift), моделювання наслідків рефакторингу (Impact Analysis) та аналізу готовності до мікросервісного винесення (Microservice Extraction Assistant).

---

## ✨ Ключові переваги архітектури Tauri 2.0

- 🚀 **Повна відмова від браузера**:
  - Працює як автономний нативний додаток ОС (розмір бінарника всього **~12 МБ**, споживання RAM **~35 МБ**).
  - Жодних локальних веб-серверів на портах, жодних повідомлень браузера про зависання скриптів.
- ⚡ **Миттєвий зв'язок Rust ◄► UI (Tauri Direct IPC)**:
  - Прямий обмін даними в пам'яті процесу без накладних витрат на HTTP/TCP стек.
- 📂 **Нативна інтеграція з ОС**:
  - Нативні системні діалоги вибору папок та файлів.
  - Пряме відкриття коду у VS Code чи IntelliJ IDEA за кліком.
- ⚡ **Паралельний синтаксичний AST-сканер на Rayon**:
  - Сканування проєктів на **100 000+ класів** зі швидкістю понад **50 000 файлів/сек**.
- 💾 **Вбудована вбудована NoSQL база даних (Redb)**.

---

## 🚀 Швидкий запуск (1-Click Build & Run)

### 🛠️ Автоматична збірка (Build Script):

Після клонування репозиторію виконайте скрипт збірки для вашої ОС:

- **Windows (PowerShell)**:
  ```powershell
  .\build.ps1
  ```
- **Windows (CMD / Подвійний клік)**:
  ```cmd
  build.bat
  ```
- **Linux / macOS**:
  ```bash
  chmod +x build.sh && ./build.sh
  ```

---

### ⚡ 1-Click запуск нативного десктопного додатку (Run Script):

- **Windows (PowerShell)**:
  ```powershell
  .\run.ps1
  # Або для власного проєкту:
  .\run.ps1 -ProjectPath "C:\Projects\MyEnterpriseApp"
  ```
- **Windows (CMD)**:
  ```cmd
  run.bat
  ```
- **Linux / macOS**:
  ```bash
  chmod +x run.sh && ./run.sh
  ```

---

### 🔨 Ручна збірка (Manual Build):

#### Вимоги:
- **Rust toolchain** (1.75+) — `cargo`, `rustc` ([rustup.rs](https://rustup.rs))
- **Node.js** (18+ або 20+) та `npm` ([nodejs.org](https://nodejs.org))

```bash
# 1. Збірка фронтенду
cd frontend
npm install
npm run build
cd ..

# 2. Збірка нативного десктопного додатку
cargo build --release
```

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
