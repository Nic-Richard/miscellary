# Production infrastructure

Miscellary runs its web client on Vercel and its API in one ECS Fargate task. AWS also owns the
container registry, PostgreSQL database, media bucket, transactional email, runtime secrets, logs,
alarms, and deployment identity.

```text
miscellary.com       -> Vercel
api.miscellary.com   -> ALB -> ECS Fargate -> RDS PostgreSQL
                                      |----> S3
                                      |----> SES
                                      `----> CloudWatch
media.miscellary.com -> CloudFront -> S3 renders/*
```

The load balancer and Fargate task use two public subnets. The task receives a public IP for outbound
S3 and SES traffic but accepts port 8000 only from the load balancer security group. RDS uses two
private database subnets, is not publicly reachable, and accepts PostgreSQL only from the task
security group. This avoids a NAT gateway while keeping the database private.

Only immutable objects under `renders/*` are available through CloudFront. Uploaded source images
use 24-hour signed S3 GET URLs and are outside the CDN, so draft artwork is not permanently readable
from a leaked object key.

Terraform keeps this deliberately small: one 0.25 vCPU/1 GB task, one Single-AZ `db.t4g.micro`, one
bucket, one load balancer, and four basic alarms. There is no Kubernetes cluster, NAT gateway,
cache, queue, worker service, or multi-AZ database.

## Deployment order

1. Secure the AWS account, create the billing alerts, and configure short-lived AWS CLI access.
2. Review and apply the Terraform foundation with no API image tag.
3. Add the ACM and SES records in Namecheap, request SES production access, and fill the two runtime
   secrets.
4. Push the first API image, set its immutable tag in Terraform, and apply the ECS service.
5. Run migrations, create the first administrator, and verify the render state with one-off tasks.
6. Deploy the web client to Vercel and connect `miscellary.com`.
7. Complete the live auth, CORS, CSRF, cookie, upload, email, logging, alarm, and backup checks.
8. Build the Android preview APK against `https://api.miscellary.com` and test it on a real phone.
9. Enable and test GitHub's OIDC deployment after the first manual deployment is healthy.
10. Build an AAB for Play internal testing only after the APK pass is complete.

## Repository files

- `terraform/` describes the AWS resources.
- `../scripts/deploy-api.sh` builds an immutable image, runs migrations as a one-off task, updates
  the service, waits for stability, and checks the live health endpoint.
- `../scripts/run-api-task.sh` runs an explicit Django management command using the deployed task.
- `../.github/workflows/deploy-api.yml` performs the same deployment through GitHub OIDC.

Terraform state is local and ignored. It contains infrastructure details and must be backed up in an
encrypted location. Moving state to a locked remote backend is only worthwhile if another operator
starts changing the stack.

## Prerequisites

- Terraform 1.8 or newer
- AWS CLI 2.32 or newer
- Docker with Linux container support
- `jq`
- Bash through Linux, WSL, or Git Bash
- A clean, committed `main` branch

Use `us-east-1` consistently for ECS, ECR, RDS, S3, SES, ACM, and Secrets Manager.

## AWS account and billing safeguards

Before running Terraform:

- enable MFA on the root user, set account recovery and alternate contacts, and do not create root
  access keys;
- create an MFA-protected daily administrator and use `aws login --profile miscellary` for temporary
  local credentials instead of creating an access key;
- do not create an AWS Organization only to enable IAM Identity Center while new-account credits
  matter, because joining an organization expires those credits;
- create a monthly AWS Budget with actual and forecast email alerts at amounts you are comfortable
  paying, then confirm the notification address;
- enable billing alerts and review the Free Tier and Cost Explorer pages; and
- run `aws sts get-caller-identity` and confirm the account before every apply.

Set the profile region once, then export it before Terraform commands:

```bash
aws login --profile miscellary --region us-east-1
aws configure set region us-east-1 --profile miscellary
export AWS_PROFILE=miscellary
aws sts get-caller-identity
```

An organization instance of IAM Identity Center is the better multi-account option after the
credit-funded launch, but an account instance cannot provide AWS account or CLI access.

The load balancer and RDS instance are the main steady costs. Fargate, logs, S3, SES, Secrets Manager,
ECR, and CloudFront add smaller usage-based charges at this scale. CloudFront uses Price Class 100
for North America and Europe. The absence of a NAT gateway avoids another fixed hourly charge.

## First infrastructure apply

Copy the example variables and replace the bucket name, GitHub repository, immutable GitHub owner
and repository IDs, and alert address. The repository API response contains `id` and `owner.id`:

```text
https://api.github.com/repos/OWNER/REPOSITORY
```

```bash
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
terraform -chdir=infra/terraform init
terraform -chdir=infra/terraform plan
terraform -chdir=infra/terraform apply
```

Leave `api_image_tag` unset for this foundation apply. Terraform creates the network, database,
bucket, ECR repository, load balancer, certificate request, SES identity, secrets, IAM roles, log
group, and alarms, but not the task definition, listeners, or service.

The database and load balancer begin billing after this apply. RDS creates and manages its master
password in Secrets Manager.

## Namecheap DNS and SES

Read the DNS records Terraform generated:

```bash
terraform -chdir=infra/terraform output api_certificate_validation
terraform -chdir=infra/terraform output ses_verification_record
terraform -chdir=infra/terraform output ses_dkim_records
terraform -chdir=infra/terraform output -raw api_load_balancer_dns
```

Add the ACM validation CNAME, SES verification TXT, and three SES DKIM CNAME records in Namecheap.
Add `api` as a CNAME to the load-balancer hostname. Keep the web apex record separate for Vercel.
Use the host portion Namecheap asks for rather than duplicating `miscellary.com` in a record name.

Request SES production access in `us-east-1`. Create SES SMTP credentials and store them in the
`miscellary/ses-smtp` secret as:

```json
{ "username": "SES SMTP username", "password": "SES SMTP password" }
```

The SMTP IAM user must allow `ses:SendRawEmail` for any recipient while restricting the sender:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ses:SendRawEmail",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "ses:FromAddress": "no-reply@miscellary.com"
        }
      }
    }
  ]
}
```

Store application settings in `miscellary/app`:

```json
{
  "secret_key": "a long random Django secret",
  "initial_admin_email": "your email",
  "initial_admin_username": "your username",
  "initial_admin_password": "a unique temporary password"
}
```

Use the Secrets Manager console or `aws secretsmanager put-secret-value` with a local ignored JSON
file. Do not place these values in Terraform variables, shell history, GitHub variables, or the
repository. The initial administrator password is only needed for the first bootstrap task.

Create SPF and DMARC records before public email testing. SES remains restricted to verified
recipients until AWS approves production access.

## First image and service

Copy the local deployment environment and fill the account ID:

```bash
cp .env.deploy.example .env.deploy
PUSH_ONLY=1 bash scripts/deploy-api.sh
git rev-parse HEAD
```

Set `api_image_tag` in `infra/terraform/terraform.tfvars` to that full Git commit and apply again:

```bash
terraform -chdir=infra/terraform plan
terraform -chdir=infra/terraform apply
```

This apply waits for ACM validation, creates the HTTPS listener and HTTP redirect, registers the task
definition, and starts one Fargate task. Run the database and administrator setup explicitly:

```bash
bash scripts/run-api-task.sh migrate_locked
bash scripts/run-api-task.sh bootstrap_admin
bash scripts/run-api-task.sh bootstrap_catalogue
bash scripts/run-api-task.sh verify_renders
```

After confirming the administrator login, replace `initial_admin_password` in the application secret
with an unused random value while preserving the Django secret and admin identity fields. The
bootstrap command never changes the password of an administrator that already exists.

`bootstrap_catalogue` creates missing persistent catalogue entries and verifies existing published
entries without rewriting them. Run `refresh_demo_activity` separately when synthetic collections and
social activity should be replaced; pass `--include-trades` only when demo trade fixtures are wanted.
`reset_demo` is disabled outside development. Bake and import the catalogue renders,
then finish with `verify_renders`.

Build the shared surface and bake against the live API from a workstation with Chromium available:

```bash
pnpm --filter mobile surfaces:build
node apps/mobile/scripts/render-card-assets.mjs --api https://api.miscellary.com
bash scripts/import-production-renders.sh
bash scripts/run-api-task.sh verify_renders
```

The import helper uploads the local render directory under a private `staging/card-renders/*` prefix,
then gives that manifest to an ECS one-off task. Set `MEDIA_BUCKET` in `.env.deploy` first. Remove that
staging prefix after verification; the imported immutable files live under `renders/*` keys.

## Render CDN

CloudFront caches only immutable baked renders. Its S3 origin access is restricted to `renders/*`;
source uploads and private staging objects remain available only through the API's signed S3 URLs.

Roll out the CDN without interrupting existing render URLs:

1. Apply with both media CDN flags left false. Read
   `terraform -chdir=infra/terraform output media_certificate_validation`, add that CNAME in
   Namecheap, and wait for the certificate to validate.
2. Set `media_cdn_enabled = true`, plan, and apply. Read
   `terraform -chdir=infra/terraform output -raw media_cloudfront_domain`.
3. Add a Namecheap CNAME with host `media` and the CloudFront hostname as its value. Confirm an
   existing `https://media.miscellary.com/renders/...` URL returns successfully.
4. Set `media_cdn_cutover = true`, plan, and apply. This changes new API render URLs to the custom
   hostname and removes direct public S3 access to renders.
5. Deploy the API if the ECS service did not replace its task during the cutover apply. Confirm a
   fresh API response uses `media.miscellary.com`, the render returns a CloudFront cache header, a
   raw S3 render URL is denied, and a signed source URL still works.

## Vercel

Import the repository, set the root directory to `apps/web`, and confirm that source files outside
the root directory are included. Set:

```text
NEXT_PUBLIC_API_URL=https://api.miscellary.com
```

Attach `miscellary.com`, use the DNS records Vercel provides, and test from a clean browser session.
The API and web client share the same site, so the refresh cookie remains secure with `SameSite=Lax`.

## GitHub deployment

Create a GitHub environment named `Production`. Add approval protection if the repository plan
supports it, then add these environment variables:

```text
AWS_DEPLOY_ROLE_ARN   Terraform output github_deploy_role_arn
AWS_REGION            us-east-1
AWS_ACCOUNT_ID        the AWS account ID
ECR_REPOSITORY        miscellary-api
ECS_CLUSTER           miscellary-prod
ECS_SERVICE           miscellary-api
ECS_TASK_FAMILY       miscellary-api
```

The role trust policy accepts only that repository's `production` environment. GitHub exchanges its
OIDC token for temporary AWS credentials; no AWS access key is stored in GitHub.

Run the normal CI workflow on `main`, then start **Deploy API** manually. The workflow builds a
commit-tagged image, pushes it, registers a new task revision, runs locked migrations, rolls out the
service, waits for ECS stability, and checks `/api/v1/health/`.

## Operations and recovery

- ECS sends API output to `/ecs/miscellary-api` with 14-day retention.
- CloudWatch alarms cover API CPU, API availability, target 5xx responses, and low database storage.
- Confirm the SNS subscription email before relying on notifications.
- RDS is encrypted, has seven days of automated backups, storage autoscaling up to 100 GiB, deletion
  protection, and a timestamped final snapshot.
- S3 is encrypted and versioned; only `renders/*` is public and noncurrent versions expire after 30
  days.
- ECR scans pushed images and retains the twenty most recent images.
- Keep a periodic encrypted `pg_dump` outside AWS and retain the Docker/VPS procedure as the exit
  path when credits run down.

The normal API deployment does not run arbitrary commands. Use `bash scripts/run-api-task.sh`
deliberately and check CloudWatch logs after every maintenance task.
