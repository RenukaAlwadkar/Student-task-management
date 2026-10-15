# Student Task Manager – Terraform IaC

## About the Project

This project demonstrates how to deploy a serverless Student Task Management application using **Terraform Infrastructure as Code (IaC)**.

The application allows users to create, view, update, and delete tasks. Terraform manages the cloud infrastructure, and GitHub Actions automates the deployment workflow.

## Technologies Used

- **Frontend:** HTML, CSS, JavaScript
- **Cloud Platform:** Cloudflare
- **Serverless Compute:** Cloudflare Workers
- **Storage:** Cloudflare Workers KV
- **Infrastructure as Code:** Terraform
- **Version Control:** Git and GitHub
- **CI/CD:** GitHub Actions

## Project Structure

```text
student-task-manager-iac/
├── application/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── worker.js
├── terraform/
│   ├── providers.tf
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── terraform.tfvars.example
├── .github/
│   └── workflows/
│       └── deploy.yml
├── .gitignore
└── README.md
```

## Main Features

- Add new tasks.
- View all tasks.
- Update existing tasks.
- Delete tasks.
- Store task data using Cloudflare Workers KV.
- Create and manage cloud resources using Terraform.
- Automate infrastructure checks and deployment using GitHub Actions.

## Setup and Deployment

### 1. Install the Requirements

Install Git and Terraform, and create a Cloudflare account.

### 2. Configure Cloudflare Credentials

Create a `terraform.tfvars` file inside the `terraform` folder. Add your Cloudflare account ID and API token locally.

**Important:** Never upload your real API token or `terraform.tfvars` file to GitHub.

### 3. Run Terraform

Open the terminal in VS Code and run:

```powershell
cd terraform
terraform init
terraform fmt
terraform validate
terraform plan
terraform apply
```

Type `yes` when Terraform asks for confirmation.

### 4. Open the Application

After deployment, use the application URL shown in the Terraform outputs.

### 5. GitHub Actions

The GitHub Actions workflow runs Terraform checks and can deploy infrastructure automatically when the configured conditions are satisfied.

Add the required Cloudflare credentials under:

**GitHub Repository → Settings → Secrets and variables → Actions**

Create these repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### 6. Modify Infrastructure

Update the Terraform configuration and run:

```powershell
terraform plan
terraform apply
```

### 7. Destroy and Recreate Infrastructure

To remove the resources managed by Terraform:

```powershell
terraform plan -destroy
terraform destroy
```

To recreate them:

```powershell
terraform apply
```

**Warning:** Destroying resources may delete application infrastructure and affect stored task data. Check your configuration and back up any important data first.

## REST API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/tasks` | View all tasks |
| GET | `/api/tasks/{id}` | View one task |
| POST | `/api/tasks` | Create a task |
| PUT | `/api/tasks/{id}` | Update a task |
| DELETE | `/api/tasks/{id}` | Delete a task |

## Conclusion

This project demonstrates serverless application deployment, persistent storage, Infrastructure as Code, version control, and CI/CD automation using Terraform, Cloudflare, and GitHub Actions.
