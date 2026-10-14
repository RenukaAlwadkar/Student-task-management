# Project Demonstration Screenshots Checklist

As per Section 32 (F) of the project specification, the following screenshots must be captured and included in this folder for the evaluation submission:

| File Name | Description & Verification Target | Status / Command |
|---|---|---|
| `01_terraform_installation.png` | Output of `terraform --version` showing Terraform CLI installed. | `terraform --version` |
| `02_terraform_init.png` | Output of `terraform init` showing provider plugin download and successful initialization. | `terraform init` |
| `03_terraform_validate.png` | Output of `terraform validate` showing "Success! The configuration is valid." | `terraform validate` |
| `04_terraform_plan.png` | Output of `terraform plan` showing plan to add KV namespace and Worker script with binding. | `terraform plan` |
| `05_terraform_apply.png` | Output of `terraform apply` displaying "Apply complete! Resources: 2 added." and outputs. | `terraform apply` |
| `06_cloudflare_worker.png` | Cloudflare Dashboard -> Workers & Pages showing `student-task-manager` created via Terraform. | Cloudflare Console |
| `07_workers_kv.png` | Cloudflare Dashboard -> Workers & Pages -> KV showing `student_tasks` namespace and keys. | Cloudflare Console |
| `08_working_web_app.png` | Browser view of the deployed application displaying header, statistics, and task cards. | Browser URL |
| `09_create_operation.png` | Demonstration of adding a new task (e.g. "Prepare Final Year Project Presentation"). | Web UI / Modal |
| `10_update_operation.png` | Demonstration of changing task status from "Pending" to "Completed". | Web UI / Toggle |
| `11_delete_operation.png` | Confirmation dialog and removal of a task from the list and KV storage. | Web UI / Modal |
| `12_github_repository.png` | GitHub repository page showing project structure, commits, and protected `.gitignore`. | GitHub Repo |
| `13_github_actions_execution.png` | GitHub Actions tab showing green checkmark for automated `deploy.yml` pipeline run. | GitHub Actions |
| `14_terraform_destroy.png` | Output of `terraform destroy` displaying "Destroy complete! Resources: 2 destroyed." | `terraform destroy` |
| `15_infrastructure_recreation.png` | Re-running `terraform apply` to prove reproducible infrastructure generation. | `terraform apply` |
