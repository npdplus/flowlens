# FlowLens Examples

These are the official synthetic examples for FlowLens V0.1. They use the native FlowLens Workflow Definition V0.1 and are safe to publish with the open-source repository.

- `simple-sequential.yaml` — Simple Sequential Workflow
- `purchase-approval.yaml` — Purchase Approval
- `ci-cd-deployment.yaml` — CI/CD Deployment
- `ai-agent-workflow.yaml` — AI Agent Workflow
- `incident-response.yaml` — Incident Response

The web application loads these YAML files directly as convenience inputs. They remain ordinary editable workflow definitions and pass through the same parse → structural validation → normalization → semantic validation → analysis → layout → renderer pipeline as user-authored input.
