# MINI PROJECT REPORT

## PROJECT TITLE:
# Automated Deployment of a Serverless Student Task Management Application Using Terraform-Based Infrastructure as Code

---

### Candidate / Group Submission Details
* **Academic Course:** Cloud Computing / DevOps Mini Project
* **Project Title:** Automated Deployment of a Serverless Student Task Management Application Using Terraform-Based Infrastructure as Code
* **IaC Tool:** HashiCorp Terraform (`v1.5+`)
* **Cloud Platform:** Cloudflare Serverless Platform
* **Compute Engine:** Cloudflare Workers
* **Storage Engine:** Cloudflare Workers KV
* **CI/CD Platform:** GitHub Actions

---

## TABLE OF CONTENTS
1. [Chapter 1 – Introduction](#chapter-1--introduction)
2. [Chapter 2 – Background of Cloud Computing and IaC](#chapter-2--background-of-cloud-computing-and-iac)
3. [Chapter 3 – Problem Statement](#chapter-3--problem-statement)
4. [Chapter 4 – Proposed Architecture](#chapter-4--proposed-architecture)
5. [Chapter 5 – Technologies Used](#chapter-5--technologies-used)
6. [Chapter 6 – Terraform Configuration](#chapter-6--terraform-configuration)
7. [Chapter 7 – Application Implementation](#chapter-7--application-implementation)
8. [Chapter 8 – CI/CD Implementation](#chapter-8--cicd-implementation)
9. [Chapter 9 – Testing and Results](#chapter-9--testing-and-results)
10. [Chapter 10 – Conclusion and Future Scope](#chapter-10--conclusion-and-future-scope)
11. [Section 38: Required Report Questions & Answers (Q1 to Q20)](#section-38-required-report-questions--answers)
12. [Section 39: Viva Voce Examination Guide](#section-39-viva-voce-examination-guide)

---

## CHAPTER 1 – INTRODUCTION

Modern software engineering demands high-velocity release cycles, guaranteed reproducibility, and zero tolerance for configuration discrepancies between development, testing, and production environments. Serverless architectures have revolutionized application deployment by abstracting physical servers, operating systems, and capacity provisioning, allowing engineers to focus purely on business logic.

However, deploying serverless applications involves configuring multiple cloud primitives: compute runtimes, distributed key-value storage databases, environment variables, resource bindings, routing subdomains, and security access policies. Configuring these resources manually via a cloud console's graphical user interface (GUI) introduces configuration drift, human mistakes, and documentation rot.

This mini-project demonstrates the design, automated provisioning, continuous delivery, and full lifecycle management of a **Student Task Management Application** using **Terraform** as the Infrastructure as Code (IaC) orchestrator and **Cloudflare Workers** with **Workers KV** as the serverless host.

---

## CHAPTER 2 – BACKGROUND OF CLOUD COMPUTING AND IAC

### 2.1 The Evolution of Cloud Infrastructure Provisioning
Traditionally, infrastructure deployment followed an imperative, manual model:
1. Systems engineers logged into web management dashboards or SSH sessions.
2. Resources (virtual servers, storage volumes, network routes) were clicked or scripted imperatively step-by-step.
3. Documentation quickly fell out of sync with actual running infrastructure.

### 2.2 Infrastructure as Code (IaC) Paradigm
Infrastructure as Code represents infrastructure topologies as machine-readable definition files. IaC provides:
* **Declarative Configuration:** Engineers declare *what* the final target state should look like, leaving the dependency graph resolution and API sequencing to the engine.
* **Version Control:** Infrastructure configurations reside in Git alongside software code, providing an immutable audit trail of changes, commits, code reviews, and rollbacks.
* **Deterministic Automation:** Environments can be stamped out identically across multiple stages (`dev`, `test`, `prod`) in seconds without manual intervention.

---

## CHAPTER 3 – PROBLEM STATEMENT

When deploying a serverless student task manager using manual cloud dashboard operations:
1. **Difficulty in Replication:** Recreating an identical environment in a disaster recovery or multi-region scenario requires extensive manual effort.
2. **Human Error Prone:** Typos in binding names (such as mismatching `TASKS_KV`), missing access tokens, or mismatched runtime flags cause silent failures.
3. **No Drift Detection:** Unaudited manual adjustments made directly on the cloud dashboard cannot be tracked or easily reconciled.
4. **Tedious Cleanup & Rebuilding:** Dismantling development resources cleanly to avoid orphaned cloud assets requires manual searching through dashboard menus.

### Objective:
To eliminate manual cloud configuration by authoring, planning, provisioning, modifying, destroying, and recreating the entire serverless infrastructure (Cloudflare Worker compute, Workers KV storage namespace, and Worker-to-KV bindings) strictly through **Terraform-based Infrastructure as Code**, integrated with an automated **GitHub Actions CI/CD pipeline**.

---

## CHAPTER 4 – PROPOSED ARCHITECTURE

### 4.1 System Architectural Components
The architecture consists of three principal tiers:
1. **Presentation & Application Layer:** A responsive web client developed in modern HTML5, CSS3, and JavaScript, featuring real-time task statistics cards, priority flags, search/filter controls, and CRUD modals.
2. **Compute & Routing Layer:** A serverless Cloudflare Worker executing on V8 isolates across Cloudflare's global edge network. The Worker acts as both the static file server and the REST API gateway (`/api/tasks`).
3. **Persistence Layer:** Cloudflare Workers KV, a low-latency, distributed key-value data store accessed securely via the `TASKS_KV` runtime binding.

```
+-------------------------------------------------------------+
|                      STUDENT / END USER                     |
+-------------------------------------------------------------+
                              |
                     (HTTPS Request)
                              v
+-------------------------------------------------------------+
|               CLOUDFLARE EDGE WORKER RUNTIME                |
|  - Serves Modern UI (index.html, style.css, script.js)     |
|  - REST API Engine (/api/tasks CRUD endpoints)              |
|  - CORS & Error Handling                                   |
+-------------------------------------------------------------+
                              |
               (Worker-to-KV Binding: TASKS_KV)
                              v
+-------------------------------------------------------------+
|                CLOUDFLARE WORKERS KV STORE                  |
|                 Namespace: "student_tasks"                  |
|  - Key: "task:T101" -> Value: JSON Task Record             |
|  - Key: "task:T102" -> Value: JSON Task Record             |
+-------------------------------------------------------------+
```

### 4.2 Infrastructure Delivery Workflow
```
[Developer] -> [git push] -> [GitHub Repo] -> [GitHub Actions Pipeline]
                                                    |
                                      (terraform init & validate)
                                      (terraform plan & apply)
                                                    v
                                      [Cloudflare Terraform Provider]
                                                    |
                                 +------------------+------------------+
                                 |                                     |
                                 v                                     v
                     [Cloudflare Worker Script]             [Workers KV Namespace]
```

---

## CHAPTER 5 – TECHNOLOGIES USED

| Technology | Role | Justification |
|---|---|---|
| **Terraform (`>= 1.5.0`)** | IaC Orchestrator | Industry-standard declarative configuration engine with dependency graph resolution and state tracking. |
| **Cloudflare Provider (`~> 4.35`)** | Cloud API Integration | Official HashiCorp-verified provider for managing Cloudflare Workers and KV namespaces. |
| **Cloudflare Workers** | Edge Compute Runtime | High performance, sub-millisecond cold start times running on V8 isolates with 100,000 free daily requests. |
| **Cloudflare Workers KV** | Serverless Storage | Globally replicated key-value storage with zero configuration database servers. |
| **Git & GitHub** | Version Control | Immutable source control tracking infrastructure configurations and application code. |
| **GitHub Actions** | CI/CD Pipeline | Automated linting, validation, planning, and deployment on every commit. |

---

## CHAPTER 6 – TERRAFORM CONFIGURATION

The infrastructure code is organized under `terraform/`:

### 6.1 Provider Specification (`providers.tf`)
Declares required providers and enforces minimum engine versions:
```hcl
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.35"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token != "" ? var.cloudflare_api_token : null
}
```

### 6.2 Variable Declarations (`variables.tf`)
Parametrizes environment variables to avoid hardcoded credentials:
```hcl
variable "cloudflare_account_id" { type = string }
variable "cloudflare_api_token"  { type = string, sensitive = true }
variable "worker_name"           { type = string, default = "student-task-manager" }
variable "kv_namespace_name"     { type = string, default = "student_tasks" }
variable "environment"           { type = string, default = "production" }
```

### 6.3 Resource Provisioning (`main.tf`)
Provisions the KV namespace and Worker script with the `TASKS_KV` binding:
```hcl
resource "cloudflare_workers_kv_namespace" "student_tasks" {
  account_id = var.cloudflare_account_id
  title      = var.environment == "production" ? var.kv_namespace_name : "${var.kv_namespace_name}_${var.environment}"
}

resource "cloudflare_workers_script" "student_task_manager" {
  account_id         = var.cloudflare_account_id
  name               = var.environment == "production" ? var.worker_name : "${var.worker_name}-${var.environment}"
  content            = file("${path.module}/../application/worker.js")
  module             = true
  compatibility_date = "2024-04-01"

  kv_namespace_binding {
    name         = "TASKS_KV"
    namespace_id = cloudflare_workers_kv_namespace.student_tasks.id
  }

  plain_text_binding {
    name = "ENVIRONMENT"
    text = var.environment
  }
}
```

### 6.4 Output Declarations (`outputs.tf`)
Exposes operational endpoint URLs and resource IDs:
* `worker_name`
* `kv_namespace_id`
* `application_url` (`https://student-task-manager.workers.dev`)
* `api_endpoints` summary map

---

## CHAPTER 7 – APPLICATION IMPLEMENTATION

### 7.1 Data Model
Each academic task is structured as a JSON record:
```json
{
  "id": "T101",
  "title": "Complete Cloud Computing Assignment",
  "priority": "High",
  "status": "Pending",
  "category": "Assignment",
  "dueDate": "2026-10-25",
  "description": "Implement automated Cloudflare Workers deployment using Terraform IaC scripts.",
  "createdAt": "2026-10-14T15:20:00.000Z"
}
```

### 7.2 REST API Endpoints in `worker.js`
1. `GET /api/tasks`: Fetches all keys with prefix `task:` from `env.TASKS_KV.list()` and retrieves values using `env.TASKS_KV.get()`.
2. `GET /api/tasks/{id}`: Retrieves individual task record by identifier.
3. `POST /api/tasks`: Generates a unique task ID (`T###`), sets timestamp, and writes to KV using `env.TASKS_KV.put()`.
4. `PUT /api/tasks/{id}`: Updates existing task properties (e.g., toggling status from "Pending" to "Completed").
5. `DELETE /api/tasks/{id}`: Removes the task record from KV using `env.TASKS_KV.delete()`.

### 7.3 Frontend User Interface
Built using semantic HTML5, cybernetic dark-mode CSS3 with glassmorphism, and responsive vanilla JavaScript:
* **Real-time Stat Cards:** Displays total, pending, in-progress, completed, and high-priority counters.
* **Instant Filtering & Search:** Real-time search by task title, category, or ID, plus sorting by creation date and priority level.
* **Interactive Modal Dialogs:** User-friendly forms for creating/editing tasks with validation and delete confirmation dialogs.

---

## CHAPTER 8 – CI/CD IMPLEMENTATION

Automated CI/CD is defined in `.github/workflows/deploy.yml`:
1. **Lint Phase (`terraform fmt -check`):** Verifies adherence to standard HCL styling conventions.
2. **Init Phase (`terraform init`):** Downloads provider dependencies in the ephemeral GitHub Actions runner.
3. **Validation Phase (`terraform validate`):** Statically checks configuration correctness.
4. **Planning Phase (`terraform plan`):** Compares code against current cloud state using secrets stored in GitHub Secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).
5. **Apply Phase (`terraform apply -auto-approve`):** Automatically executes when code is pushed to the `main` branch.

---

## CHAPTER 9 – TESTING AND RESULTS

### 9.1 CRUD Functional Test Cases

| Test Case | Description | Input | Result | Status |
|---|---|---|---|---|
| **TC1: Create Task** | Add a new academic task | Title: *"Complete Cloud Assignment"*, Priority: *"High"* | Saved to KV; row rendered in table; count updated | **PASS** |
| **TC2: Read Tasks** | Query and display stored tasks | Refresh browser / call `GET /api/tasks` | All stored records fetched and rendered correctly | **PASS** |
| **TC3: Update Task** | Toggle task status | Change status from *"Pending"* to *"Completed"* | Status badge updated to emerald; counters refreshed | **PASS** |
| **TC4: Delete Task** | Remove task from KV | Click delete on task `T106` | Deleted from KV; removed from table | **PASS** |

### 9.2 IaC Lifecycle Verification
* **Initialization (`terraform init`):** Cloudflare provider `v4.52.9` installed with cryptographic verification lock file `.terraform.lock.hcl`.
* **Validation (`terraform validate`):** Returned `Success! The configuration is valid.`
* **Plan (`terraform plan`):** Accurately displayed `Plan: 2 to add, 0 to change, 0 to destroy.`
* **Modification Experiment (Step 21):** Changing environment from `production` to `dev` triggered an updated execution plan showing resource recreation with modified title.
* **Teardown (`terraform destroy`):** Successfully destroyed both resources in Cloudflare without manual dashboard interaction.
* **Recreation (`terraform apply`):** Re-executed `terraform apply` to achieve complete, reproducible environment recreation within seconds.

---

## CHAPTER 10 – CONCLUSION AND FUTURE SCOPE

### 10.1 Conclusion
The project successfully demonstrated the complete lifecycle of Infrastructure as Code. By codifying serverless infrastructure into version-controlled Terraform files and automating delivery via GitHub Actions:
* Manual dashboard configuration was completely eliminated.
* Environments became 100% reproducible and immune to human typographical errors.
* Infrastructure changes were tracked with full auditability in Git.
* Teardown and recreation experiments proved that infrastructure can be treated as disposable and cattle rather than pets.

### 10.2 Future Scope
1. **User Authentication:** Integrating Cloudflare Zero Trust / Access or JWT-based student authentication.
2. **Database Integration:** Migrating complex relational queries to Cloudflare D1 (serverless SQLite) or Cloudflare Vectorize for semantic task searching.
3. **Multi-Region Traffic Management:** Leveraging Cloudflare Load Balancing for multi-cloud redundancy.

---

## SECTION 38: REQUIRED REPORT QUESTIONS & ANSWERS

### Q1. What is Infrastructure as Code?
**Answer:** Infrastructure as Code (IaC) is the practice of defining, provisioning, and managing computing infrastructure (such as virtual servers, networks, databases, serverless functions, and storage buckets) using machine-readable configuration files rather than physical hardware configuration or interactive web consoles.

### Q2. What problem does IaC solve?
**Answer:** IaC eliminates manual human error, configuration drift between environments, non-reproducible setups, slow deployment cycles, and lack of version control history. It allows teams to spin up identical environments deterministically and document their infrastructure in code.

### Q3. Why is Terraform called a declarative IaC tool?
**Answer:** Terraform is declarative because the engineer specifies the *desired end state* of the infrastructure (e.g., "there should exist a KV namespace named student_tasks and a Worker script"), and Terraform automatically determines the sequence of actions and API calls required to reach that state. In contrast, imperative tools require specifying step-by-step instructions.

### Q4. What is a Terraform provider?
**Answer:** A Terraform provider is a plugin that translates Terraform commands into API calls for a specific cloud or service platform (e.g., AWS, Azure, Google Cloud, Cloudflare, GitHub). In this project, the `cloudflare/cloudflare` provider communicates with Cloudflare's REST APIs.

### Q5. What is a Terraform resource?
**Answer:** A resource is the most important element in Terraform syntax. It represents an infrastructure component managed by the provider, such as `cloudflare_workers_kv_namespace` or `cloudflare_workers_script`.

### Q6. What is a Terraform variable?
**Answer:** A Terraform variable (`variable "name" { ... }`) is an input parameter that allows configurations to be dynamic and reusable across environments without hardcoding values like Account IDs, names, or credentials.

### Q7. What is a Terraform output?
**Answer:** An output (`output "name" { ... }`) exposes attributes of provisioned resources after `terraform apply` completes (such as the generated application URL, IP addresses, or KV namespace IDs) for human inspection or downstream pipeline consumption.

### Q8. What is Terraform state?
**Answer:** Terraform state (`terraform.tfstate`) is a JSON file that records the mapping between declared configuration resources and the actual real-world resources created in the cloud provider. It tracks resource metadata, IDs, and attributes to compute changes.

### Q9. What happens during terraform init?
**Answer:** `terraform init` initializes the working directory, downloads and installs the required provider plugins (`cloudflare/cloudflare`), creates the dependency lock file (`.terraform.lock.hcl`), and configures the backend state storage.

### Q10. What happens during terraform plan?
**Answer:** `terraform plan` performs a speculative execution. It reads current Terraform state, queries the cloud provider via API to refresh actual resource status, compares desired configuration against reality, and outputs an execution plan showing what will be added (`+`), modified (`~`), or destroyed (`-`).

### Q11. What happens during terraform apply?
**Answer:** `terraform apply` executes the planned actions against the cloud provider's API. Upon receiving confirmation, it provisions or alters cloud resources and writes the new metadata to the Terraform state file.

### Q12. What happens during terraform destroy?
**Answer:** `terraform destroy` inspects the state file and systematically deletes all cloud resources managed by that Terraform configuration in reverse dependency order, ensuring no orphaned assets remain.

### Q13. Why should infrastructure not be modified manually after Terraform manages it?
**Answer:** Modifying resources manually in the cloud dashboard causes **infrastructure drift**. Terraform state becomes out of sync with actual cloud reality, which can cause subsequent `terraform apply` operations to fail, overwrite manual changes, or inadvertently destroy resources.

### Q14. Why should API tokens not be stored in Terraform source code?
**Answer:** Storing sensitive API tokens in source code risks exposing credentials to unauthorized parties if committed to public or shared Git repositories. Secrets should always be supplied via environment variables (`CLOUDFLARE_API_TOKEN`), secret managers, or encrypted CI/CD secrets (GitHub Secrets).

### Q15. What is a KV database?
**Answer:** A Key-Value (KV) database is a non-relational database that stores data as a collection of unique keys paired with values. In Cloudflare Workers KV, data is globally distributed across edge data centers for ultra-low latency reads.

### Q16. Why was serverless computing selected for this project?
**Answer:** Serverless computing eliminates server maintenance, OS patching, and idle virtual machine hosting costs. It scales automatically from zero to high concurrency and provides a generous free tier (100,000 requests/day on Cloudflare) ideal for academic projects.

### Q17. What is CI/CD?
**Answer:** Continuous Integration (CI) and Continuous Deployment (CD) is an automated practice where code changes are automatically tested, validated, and deployed to production environments upon merging into a repository.

### Q18. What role does GitHub Actions perform?
**Answer:** GitHub Actions acts as the CI/CD execution runner. On code pushes, it automatically checks out repository code, validates Terraform syntax, runs `terraform plan`, and executes `terraform apply` securely using encrypted secrets.

### Q19. How can Terraform recreate infrastructure after deletion?
**Answer:** Because the infrastructure specification is completely codified in declarative configuration files (`main.tf`, `variables.tf`), running `terraform apply` reads the code and issues the exact API calls necessary to reproduce identical resources from scratch.

### Q20. What is infrastructure drift?
**Answer:** Infrastructure drift refers to discrepancies that occur when the actual configuration of cloud resources differs from the desired configuration declared in the IaC configuration, typically caused by manual changes, emergency hotfixes, or out-of-band modifications.

---

## SECTION 39: VIVA VOCE EXAMINATION GUIDE

### Basic Questions
* **Q: What is IaC?**
  * *Answer:* Infrastructure as Code is the practice of defining and managing infrastructure using machine-readable configuration files rather than manually creating resources via web consoles.
* **Q: Which IaC tool have you used?**
  * *Answer:* HashiCorp Terraform.
* **Q: Which cloud provider have you used?**
  * *Answer:* Cloudflare.
* **Q: Which compute service have you used?**
  * *Answer:* Cloudflare Workers (serverless V8 runtime).
* **Q: Which storage service have you used?**
  * *Answer:* Cloudflare Workers KV (distributed key-value storage).

### Intermediate Questions
* **Q: What does `terraform init` do?**
  * *Answer:* It initializes the working directory, downloads required provider plugins, and sets up state backend storage.
* **Q: What does `terraform plan` do?**
  * *Answer:* It compares the desired state in code with the existing cloud state and generates an execution plan showing proposed additions, modifications, or deletions.
* **Q: What does `terraform apply` do?**
  * *Answer:* It performs the planned infrastructure changes against the cloud provider API and updates the state file.
* **Q: What does `terraform destroy` do?**
  * *Answer:* It safely removes all cloud infrastructure resources managed by the configuration.
* **Q: What is Terraform state?**
  * *Answer:* It is the database/file (`terraform.tfstate`) that Terraform uses to map declared resources to real-world cloud resources.

### Advanced Questions
* **Q: What is infrastructure drift?**
  * *Answer:* Drift occurs when real cloud infrastructure differs from the configuration declared in Terraform code.
* **Q: What happens if someone manually changes a Terraform-managed resource?**
  * *Answer:* Terraform detects the discrepancy during the next `terraform plan` and proposes changes to reconcile the real resource back to the declared configuration.
* **Q: Why use variables in Terraform?**
  * *Answer:* Variables make configurations reusable across environments (`dev`, `test`, `prod`) and prevent hardcoding sensitive credentials or environment-specific values.
* **Q: Why use Terraform modules?**
  * *Answer:* Modules package multiple related resources into reusable, standardized building blocks, promoting DRY (Don't Repeat Yourself) principles.
* **Q: What advantage does Git provide for IaC?**
  * *Answer:* Git provides immutable version history, peer code reviews, auditing, rollback capabilities, and team collaboration for infrastructure code.
