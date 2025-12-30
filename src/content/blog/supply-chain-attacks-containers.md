---
title: 'Supply Chain Attacks in Container Ecosystems'
description: 'Understanding and mitigating risks from compromised base images, dependencies, and build pipelines'
pubDate: 'Dec 20 2024'
---

The container supply chain is vast and complex. A single `FROM ubuntu:latest` pulls in thousands of packages, each a potential attack vector.

## Attack Surface Analysis

### Base Image Poisoning

Attackers compromise popular base images or create typosquatted versions:

```dockerfile
FROM ubunu:latest  # Typo - malicious image
# vs
FROM ubuntu:latest  # Legitimate
```

**Real incident:** The `coa` npm package was typosquatted, leading to cryptocurrency theft when developers mistyped the package name.

### Layer Injection

Each Docker layer is an opportunity for code injection:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install  # <- Malicious dependencies here
COPY . .
CMD ["node", "server.js"]
```

## The Dependency Problem

Modern applications pull in hundreds of transitive dependencies. Attackers target these:

### Case Study: event-stream Backdoor

In 2018, the `event-stream` npm package (2M downloads/week) was compromised:
1. Attacker gained maintainer access
2. Added malicious dependency `flatmap-stream`
3. Code specifically targeted cryptocurrency wallets
4. Remained undetected for months

## Build Pipeline Compromise

CI/CD systems are high-value targets with access to secrets and deployment credentials.

### Attack Vector: Compromised GitHub Action
```yaml
# Malicious action exfiltrates secrets
name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: malicious-org/build-action@v1  # Backdoored
        env:
          AWS_SECRET: ${{ secrets.AWS_SECRET }}
```

## Defense: Image Signing and Verification

### Sigstore/Cosign

Sign container images to prove provenance:

```bash
# Sign image
cosign sign --key cosign.key \
  registry.io/myapp:v1.0.0

# Verify before deployment
cosign verify --key cosign.pub \
  registry.io/myapp:v1.0.0
```

### Admission Control

Block unsigned images using Kyverno:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-images
spec:
  validationFailureAction: enforce
  rules:
  - name: check-signature
    match:
      resources:
        kinds:
        - Pod
    verifyImages:
    - imageReferences:
      - "registry.io/*"
      attestors:
      - entries:
        - keys:
            publicKeys: |-
              -----BEGIN PUBLIC KEY-----
              ...
              -----END PUBLIC KEY-----
```

## SBOM: Software Bill of Materials

Generate and verify SBOMs to track dependencies:

```bash
# Generate SBOM with Syft
syft packages registry.io/myapp:v1.0.0 -o spdx-json > sbom.json

# Scan for vulnerabilities with Grype
grype sbom:sbom.json
```

## Minimal Base Images

Reduce attack surface by using distroless or scratch images:

```dockerfile
# Multi-stage build
FROM golang:1.21 AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o /app/server

# Distroless final image
FROM gcr.io/distroless/static-debian11
COPY --from=builder /app/server /server
CMD ["/server"]
```

Benefits:
- No shell (prevents reverse shells)
- No package manager (blocks lateral movement)
- Minimal CVE exposure

## Runtime Monitoring

Detect unexpected behavior with Falco:

```yaml
- rule: Unexpected outbound connection
  desc: Container making connection to unexpected IP
  condition: >
    outbound and container and
    not fd.sip in (allowed_ips) and
    not fd.sport in (allowed_ports)
  output: >
    Suspicious outbound connection
    (pod=%k8s.pod.name dest=%fd.rip:%fd.rport)
  priority: WARNING
```

## Best Practices Checklist

1. **Pin base image versions** - Use SHA256 digests, not tags
2. **Scan images in CI/CD** - Trivy, Grype, Snyk
3. **Sign and verify all images** - Cosign, Notation
4. **Generate and track SBOMs** - Know your dependencies
5. **Use minimal base images** - Distroless, Alpine, scratch
6. **Implement network policies** - Limit egress from containers
7. **Monitor for drift** - Detect unauthorized changes
8. **Regular dependency updates** - Automated Dependabot/Renovate

The supply chain is your weakest link. Verify everything, trust nothing.
