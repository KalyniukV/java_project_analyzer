# Сканер та аналітика Java-проєктів як сервіс

Так, **сканер та аналітика Java-проєктів має перспективу як сервіс**, але я б не позиціонував його просто як «ще один Java code analyzer». Найцікавіша ніша — **архітектурна розвідка великих legacy Java/GWT систем**, де стандартні статичні аналізатори дають багато метрик, але погано відповідають на питання «як реально влаштована система?».

З огляду на концепцію Architecture Explorer, бачу потенціал саме тут.

## 1. Де є комерційна цінність

Типовий enterprise Java-проєкт:

- 5–100k+ класів;
- Maven multi-module;
- старий Spring/Hibernate/GWT;
- слабка або відсутня документація;
- десятки років історії;
- багато циклічних залежностей;
- кілька команд бояться змінювати «старі» модулі.

Новому розробнику або архітектору потрібно відповісти:

> «Якщо я зміню цей клас — що я можу зламати?»

або:

> «Чи можемо ми винести цей модуль у окремий сервіс?»

або:

> «Де насправді знаходиться залежність між UI, RPC, backend і database?»

Ось за це компанії потенційно готові платити.

## 2. Не конкурувати з SonarQube напряму

| Продукт | Основна задача |
|---|---|
| SonarQube | Code quality / bugs / security |
| Checkstyle | Coding rules |
| PMD | Code smells |
| Structure101 | Architecture visualization |
| Sonargraph | Dependency architecture |
| IntelliJ | Навігація окремого developer |
| **Твій продукт** | **System architecture intelligence** |

Тобто не:

> «Ми знаходимо 347 bad practices»

а:

> **«Ми пояснюємо, як працює ваша система і що станеться, якщо її змінити».**

Це значно цікавіше.

## 3. Найсильніша фіча — Impact Analysis

Наприклад, користувач вибирає:

```text
CustomerService.updateCustomer()
```

Система показує:

```text
CustomerService
       │
       ├── CustomerRepository
       │       └── CustomerEntity
       │
       ├── CustomerController
       │
       ├── CustomerValidator
       │
       └── AuditService
                │
                └── AuditRepository
```

Але важливіше:

### Change Impact

```text
CustomerService.updateCustomer()
             │
             ▼
     27 direct dependencies
             │
             ▼
     143 affected classes
             │
             ▼
      8 modules
             │
             ▼
      3 applications
```

І:

> **High risk change**

Це вже продуктова фіча, а не просто красивий граф.

## 4. Architecture Drift

Система може мати очікувану архітектуру:

```text
UI
 ↓
Application
 ↓
Domain
 ↓
Infrastructure
```

А реальна:

```text
UI ────────────────┐
 ↓                 │
Application        │
 ↓                 │
Domain ────────────┤
 ↓                 │
Infrastructure ◄───┘
```

Сервіс автоматично знаходить:

```text
ARCHITECTURE VIOLATION

ui.customer.CustomerPanel
        ↓
database.CustomerDao

Expected:
UI → Application → Domain → Infrastructure

Actual:
UI → Infrastructure
```

Для enterprise це дуже цінно.

## 5. SaaS + локальний агент

Важливий момент:

**Не відправляти весь source code у cloud.**

Для enterprise це може бути blocker.

Архітектура:

```text
             COMPANY
                │
        ┌───────▼────────┐
        │ Local Scanner  │
        │ Rust           │
        └───────┬────────┘
                │
          Architecture
            Snapshot
                │
       ┌────────▼─────────┐
       │ Cloud Platform   │
       │                  │
       │ Trends           │
       │ Reports          │
       │ Teams            │
       │ Architecture    │
       │ AI              │
       └──────────────────┘
```

Scanner працює локально.

У cloud відправляється не Java source, а, наприклад:

```text
classes
methods
packages
modules
dependencies
metrics
architecture graph
git metadata
```

Це сильно спрощує security/compliance.

Для особливо чутливих компаній:

**Enterprise On-Premise Edition.**

## 6. Git integration

Сканувати проєкт недостатньо.

Потрібно сканувати **еволюцію архітектури**.

Наприклад:

```text
Architecture Health

2024 ─────── 82
2025 ─────── 74
2026 ─────── 61
```

І:

```text
Cyclic dependencies

2024     13
2025     29
2026     47
```

А далі:

> `Order module` accumulated 18 new dependencies during last 6 months.

Це вже management-level value.

## 7. AI поверх графа

Не просто:

> «Chat with your code»

таких продуктів уже багато.

А:

> **Chat with your architecture**

Наприклад:

**User:**

> Чи можна винести Payment module в окремий microservice?

Система відповідає:

```text
Probably yes, but 4 dependencies prevent clean extraction.

Internal dependencies:
  Payment → Order
  Payment → User
  Payment → Notification
  Payment → LegacyBilling

External dependencies:
  2 REST APIs
  1 database schema

Estimated extraction scope:
  137 classes
  3 Maven modules
  21 database tables

Main blocker:
  LegacyBilling dependency

Suggested extraction order:
  1. isolate Payment API
  2. remove LegacyBilling dependency
  3. extract persistence layer
  4. introduce async Notification API
```

Це вже може бути дуже дорогим enterprise-продуктом.

## 8. Java modernization

Це один із найкращих use cases.

Наприклад:

> «Ми хочемо перевести legacy GWT application на React.»

Scanner показує:

```text
GWT
 │
 ├── 1,847 Widgets
 ├── 362 RPC services
 ├── 91 UiBinder
 ├── 4,200 classes
 └── 17 Maven modules
```

І будує migration map:

```text
GWT UI
   │
   ├── RPC
   │
   ├── DTO
   │
   └── Backend
          │
          ├── Services
          ├── Hibernate
          └── DB
```

Потім:

```text
Migration candidates

LOW RISK       34%
MEDIUM RISK    48%
HIGH RISK      18%
```

Для компанії, яка планує migration, це може бути набагато цінніше за звичайний static analyzer.

## 9. Можлива бізнес-модель

### Free

```text
Local Scanner
до 10k classes
basic graph
basic metrics
```

Мета — adoption.

### Team

Орієнтовно:

```text
$49–149 / developer / month
```

або краще pricing за repository/project.

Включити:

- cloud architecture;
- history;
- Git;
- dependency analysis;
- architecture rules;
- reports;
- team collaboration.

### Enterprise

Орієнтовно:

```text
$10k–100k+ / year
```

Залежно від кількості проєктів.

Включити:

- on-premise;
- SSO;
- LDAP;
- audit;
- private deployment;
- CI/CD;
- API;
- unlimited repositories;
- enterprise support.

Саме Enterprise потенційно може бути основним джерелом доходу.

## 10. Що зробити як MVP

Не намагатися одразу робити весь Sonargraph.

### MVP 1

```text
Java project
     ↓
Maven scanner
     ↓
Java parser
     ↓
Graph
     ↓
Interactive UI
```

Підтримати:

- modules;
- packages;
- classes;
- interfaces;
- inheritance;
- method calls;
- fields;
- imports;
- annotations.

### MVP 2

Додати:

- dependency paths;
- cycles;
- coupling;
- module metrics;
- architecture layers;
- search;
- impact analysis.

### MVP 3

```text
Git
 ↓
Architecture history
 ↓
Architecture drift
```

### MVP 4

```text
AI Architecture Assistant
```

## 11. Rust-архітектура добре підходить

Концепцію Architecture Explorer можна практично без зміни перетворити на **локальний analysis engine**:

```text
Rust
├── parser
├── domain model
├── graph
├── index
├── metrics
├── query engine
├── snapshot
├── GWT analyzer
└── scheduler
```

А поверх нього:

```text
                    SaaS
                      │
          ┌───────────┴───────────┐
          │                       │
     Local Agent             Cloud API
          │                       │
          └───────────┬───────────┘
                      │
                Architecture
                   Graph
                      │
        ┌─────────────┼─────────────┐
        │             │             │
     Graph UI      Metrics          AI
        │             │             │
     Explore       Trends        Questions
```

Тобто Architecture Explorer може бути не просто desktop utility, а ядром комерційного продукту.

## 12. Найкраще позиціонування

Я б не починав з:

> **"Java static analyzer"**

Я б позиціонував:

> ### **Architecture Intelligence Platform for Large Java Systems**

і сфокусувався на трьох jobs-to-be-done:

**1. Understand**

> «Поясни мені цю систему».

**2. Change safely**

> «Що зламається, якщо я це зміню?»

**3. Modernize**

> «Як нам поступово позбутися legacy?»

Це значно ширший і дорожчий продукт.

Особливо цікаво, що спеціалізація на **GWT + великих legacy Java системах** може бути не недоліком, а **першим beachhead**: таких систем відносно мало в абсолютній кількості, але їхня міграція коштує дуже дорого, а якісних інструментів для розуміння таких систем небагато.

## Висновок

**Моя оцінка:** як просто desktop Java dependency viewer — комерційна перспектива середня.

Як **локальний scanner + cloud architecture intelligence + impact analysis + modernization assistant** — перспектива значно краща.

Найбільш реалістичний шлях монетизації — **B2B/Enterprise**, а не масовий developer SaaS.
